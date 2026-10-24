import type { ITransactionRunner, Queryable } from '../../src/db/transaction';
import { OutOfStockError, ValidationError, VehicleNotFoundError } from '../../src/errors';
import type { IStockRepository, PurchaseRecord } from '../../src/repositories/stock.repository';
import { StockChangeService } from '../../src/services/stock-change.service';
import type { IStockChangeHandler, StockChangeEvent } from '../../src/types/stock';
import type { Colour, Vehicle, VehicleChanges } from '../../src/types/vehicle';

const TX = { query: vi.fn() } as unknown as Queryable;

/** Records whether work ran inside the transaction, and whether it committed. */
class FakeTransactionRunner implements ITransactionRunner {
  committed = 0;
  rolledBack = 0;

  async run<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    try {
      const result = await fn(TX);
      this.committed += 1;
      return result;
    } catch (err) {
      this.rolledBack += 1;
      throw err;
    }
  }
}

/** In-memory model of the Postgres stock repository: colours hold stock, the model total follows. */
class FakeStockRepository implements IStockRepository {
  readonly purchases: PurchaseRecord[] = [];
  readonly txSeen: Queryable[] = [];
  readonly locked: string[] = [];

  constructor(private readonly vehicles: Map<string, Vehicle>) {}

  private snapshot(v: Vehicle): Vehicle {
    return { ...v, colours: v.colours.map((c) => ({ ...c })) };
  }

  private recount(v: Vehicle) {
    v.quantity = v.colours.reduce((sum, c) => sum + c.quantity, 0);
  }

  async lockVehicle(tx: Queryable, id: string) {
    this.txSeen.push(tx);
    this.locked.push(id);
    const v = this.vehicles.get(id);
    return v ? this.snapshot(v) : null;
  }

  async adjustColour(tx: Queryable, vehicleId: string, colourId: string, delta: number) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(vehicleId)!;
    const colour = v.colours.find((c) => c.id === colourId)!;
    colour.quantity += delta;
    if (colour.quantity < 0) throw new Error('check constraint violated');
    this.recount(v);
    return this.snapshot(v);
  }

  async setStock(tx: Queryable, vehicleId: string, colourId: string, quantity: number, fields: VehicleChanges) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(vehicleId)!;
    Object.assign(v, fields);
    v.colours.find((c) => c.id === colourId)!.quantity = quantity;
    this.recount(v);
    return this.snapshot(v);
  }

  async addColour(tx: Queryable, vehicleId: string, colour: { name: string; hex: string }) {
    this.txSeen.push(tx);
    const created: Colour = { id: `c-${colour.name.toLowerCase()}`, ...colour, quantity: 0 };
    this.vehicles.get(vehicleId)!.colours.push(created);
    return { ...created };
  }

  async recordPurchase(tx: Queryable, purchase: PurchaseRecord) {
    this.txSeen.push(tx);
    this.purchases.push(purchase);
  }
}

class RecordingHandler implements IStockChangeHandler {
  readonly events: Array<{ event: StockChangeEvent; tx: Queryable }> = [];

  async handle(event: StockChangeEvent, tx: Queryable) {
    this.events.push({ event, tx });
  }
}

const RED = 'c-red';
const WHITE = 'c-white';

/** Camry in one colour (Standard) by default, or several when given. */
function setup(colours: Array<[string, string, number]> = [['c-standard', 'Standard', 5]]) {
  const camry: Vehicle = {
    id: 'camry',
    sku: 'TOY-CAMRY',
    make: 'Toyota',
    model: 'Camry',
    category: 'Sedan',
    price: 27999.99,
    quantity: colours.reduce((sum, [, , q]) => sum + q, 0),
    colours: colours.map(([id, name, quantity]) => ({ id, name, hex: '#112233', quantity })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const runner = new FakeTransactionRunner();
  const stock = new FakeStockRepository(new Map([[camry.id, camry]]));
  const handler = new RecordingHandler();
  const service = new StockChangeService(runner, stock, [handler]);
  return { runner, stock, handler, service };
}

const twoColours = (): Array<[string, string, number]> => [
  [RED, 'Supersonic Red', 1],
  [WHITE, 'Wind Chill Pearl', 4],
];

describe('StockChangeService', () => {
  describe('purchase', () => {
    it('takes stock from the colour, records the sale with its colour and price', async () => {
      const { stock, service } = setup(twoColours());

      const vehicle = await service.apply('camry', { kind: 'purchase', quantity: 2, userId: 'priya', colourId: WHITE });

      expect(vehicle.quantity).toBe(3);
      expect(vehicle.colours.find((c) => c.id === WHITE)!.quantity).toBe(2);
      expect(stock.purchases).toEqual([
        { vehicleId: 'camry', colourId: WHITE, userId: 'priya', quantity: 2, unitPrice: 27999.99 },
      ]);
    });

    it('takes from the best-stocked colour when none is chosen', async () => {
      const { stock, service } = setup(twoColours());

      await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' });

      expect(stock.purchases[0]!.colourId).toBe(WHITE);
    });

    it('locks the model before reading its stock', async () => {
      const { stock, service } = setup();

      await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' });

      expect(stock.locked).toEqual(['camry']);
    });

    it('tells every handler the model total before and after', async () => {
      const { handler, service } = setup(twoColours());

      await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya', colourId: RED });

      expect(handler.events).toHaveLength(1);
      expect(handler.events[0]!.event).toMatchObject({ before: 5, after: 4, change: { kind: 'purchase' } });
    });

    it('does all of it in one transaction', async () => {
      const { runner, stock, handler, service } = setup();

      await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' });

      expect(runner.committed).toBe(1);
      expect(new Set([...stock.txSeen, ...handler.events.map((e) => e.tx)])).toEqual(new Set([TX]));
    });

    it('rejects a purchase of a sold-out vehicle', async () => {
      const { stock, handler, service } = setup([['c-standard', 'Standard', 0]]);

      const err = await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' }).catch((e) => e);

      expect(err).toBeInstanceOf(OutOfStockError);
      expect(err.message).toBe('Vehicle is out of stock');
      expect(stock.purchases).toEqual([]);
      expect(handler.events).toEqual([]);
    });

    it('says how many remain when buying more than is left', async () => {
      const { service } = setup([['c-standard', 'Standard', 2]]);

      const err = await service.apply('camry', { kind: 'purchase', quantity: 3, userId: 'priya' }).catch((e) => e);

      expect(err).toBeInstanceOf(OutOfStockError);
      expect(err.message).toBe('Only 2 left in stock');
    });

    it('names the colour when a chosen colour is short', async () => {
      const { service } = setup(twoColours());

      const short = await service
        .apply('camry', { kind: 'purchase', quantity: 2, userId: 'priya', colourId: RED })
        .catch((e) => e);

      expect(short).toBeInstanceOf(OutOfStockError);
      expect(short.message).toBe('Only 1 left in Supersonic Red');
    });

    it('rejects a colour that does not belong to the vehicle', async () => {
      const { service } = setup(twoColours());

      const err = await service
        .apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya', colourId: 'c-other' })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toEqual([{ field: 'colourId', message: 'is not a colour of this vehicle' }]);
    });

    it('rejects an unknown vehicle', async () => {
      const { service } = setup();

      await expect(service.apply('ghost', { kind: 'purchase', quantity: 1, userId: 'priya' })).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });

  describe('restock', () => {
    it('adds stock to the only colour without being told which', async () => {
      const { stock, handler, service } = setup([['c-standard', 'Standard', 0]]);

      const vehicle = await service.apply('camry', { kind: 'restock', quantity: 10 });

      expect(vehicle.quantity).toBe(10);
      expect(stock.purchases).toEqual([]);
      expect(handler.events[0]!.event).toMatchObject({ before: 0, after: 10 });
    });

    it('adds stock to the chosen colour', async () => {
      const { service } = setup(twoColours());

      const vehicle = await service.apply('camry', { kind: 'restock', quantity: 3, colourId: RED });

      expect(vehicle.colours.find((c) => c.id === RED)!.quantity).toBe(4);
      expect(vehicle.quantity).toBe(8);
    });

    it('requires a colour when the model has several', async () => {
      const { service } = setup(twoColours());

      const err = await service.apply('camry', { kind: 'restock', quantity: 3 }).catch((e) => e);

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toEqual([{ field: 'colourId', message: 'is required when the model has several colours' }]);
    });

    it('rejects an unknown vehicle', async () => {
      const { service } = setup();

      await expect(service.apply('ghost', { kind: 'restock', quantity: 1 })).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });

  describe('receive (adding a colour, or units of it, to an existing model)', () => {
    it('adds a new colour with its units', async () => {
      const { handler, service } = setup([['c-standard', 'Standard', 0]]);

      const vehicle = await service.apply('camry', {
        kind: 'receive',
        quantity: 3,
        colour: { name: 'Supersonic Red', hex: '#a3161a' },
      });

      expect(vehicle.colours.map((c) => [c.name, c.quantity])).toEqual([
        ['Standard', 0],
        ['Supersonic Red', 3],
      ]);
      expect(handler.events[0]!.event).toMatchObject({ before: 0, after: 3 });
    });

    it('adds units to a colour that already exists, matching its name case-insensitively', async () => {
      const { service } = setup(twoColours());

      const vehicle = await service.apply('camry', {
        kind: 'receive',
        quantity: 2,
        colour: { name: 'supersonic red', hex: '#a3161a' },
      });

      expect(vehicle.colours).toHaveLength(2);
      expect(vehicle.colours.find((c) => c.id === RED)!.quantity).toBe(3);
    });
  });

  describe('set (edits that change quantity)', () => {
    it('sets the stock of a single-colour model with the other edited fields', async () => {
      const { stock, handler, service } = setup([['c-standard', 'Standard', 0]]);

      const vehicle = await service.apply('camry', { kind: 'set', quantity: 7, fields: { price: 25999 } });

      expect(vehicle).toMatchObject({ quantity: 7, price: 25999 });
      expect(stock.purchases).toEqual([]);
      expect(handler.events[0]!.event).toMatchObject({ before: 0, after: 7, change: { kind: 'set' } });
    });

    it('refuses a single total for a model with several colours', async () => {
      const { service } = setup(twoColours());

      const err = await service.apply('camry', { kind: 'set', quantity: 7, fields: {} }).catch((e) => e);

      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toEqual([
        { field: 'quantity', message: 'must be changed per colour for a model with several colours' },
      ]);
    });

    it('rejects an unknown vehicle', async () => {
      const { service } = setup();

      await expect(service.apply('ghost', { kind: 'set', quantity: 1, fields: {} })).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });

  it('rolls the whole change back when a handler fails', async () => {
    const { runner, stock } = setup();
    const failing = new StockChangeService(runner, stock, [
      { handle: async () => Promise.reject(new Error('alert insert failed')) },
    ]);

    await expect(failing.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' })).rejects.toThrow(
      'alert insert failed',
    );
    expect(runner.rolledBack).toBe(1);
    expect(runner.committed).toBe(0);
  });
});
