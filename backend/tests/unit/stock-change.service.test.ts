import { OutOfStockError, VehicleNotFoundError } from '../../src/errors';
import type { ITransactionRunner, Queryable } from '../../src/db/transaction';
import type { IStockRepository, PurchaseRecord } from '../../src/repositories/stock.repository';
import { StockChangeService } from '../../src/services/stock-change.service';
import type { IStockChangeHandler, StockChangeEvent } from '../../src/types/stock';
import type { Vehicle, VehicleChanges } from '../../src/types/vehicle';

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

class FakeStockRepository implements IStockRepository {
  readonly purchases: PurchaseRecord[] = [];
  readonly txSeen: Queryable[] = [];

  constructor(private readonly vehicles: Map<string, Vehicle>) {}

  async decrement(tx: Queryable, id: string, quantity: number) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(id);
    if (!v || v.quantity < quantity) return null;
    v.quantity -= quantity;
    return { ...v };
  }

  async increment(tx: Queryable, id: string, quantity: number) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(id);
    if (!v) return null;
    v.quantity += quantity;
    return { ...v };
  }

  async set(tx: Queryable, id: string, quantity: number, fields: VehicleChanges) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(id);
    if (!v) return null;
    const before = v.quantity;
    Object.assign(v, fields, { quantity });
    return { vehicle: { ...v }, before };
  }

  async findById(tx: Queryable, id: string) {
    this.txSeen.push(tx);
    const v = this.vehicles.get(id);
    return v ? { ...v } : null;
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

function setup(quantity = 5) {
  const camry: Vehicle = {
    id: 'camry',
    make: 'Toyota',
    model: 'Camry',
    category: 'Sedan',
    price: 27999.99,
    quantity,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const runner = new FakeTransactionRunner();
  const stock = new FakeStockRepository(new Map([[camry.id, camry]]));
  const handler = new RecordingHandler();
  const service = new StockChangeService(runner, stock, [handler]);
  return { runner, stock, handler, service };
}

describe('StockChangeService', () => {
  describe('purchase', () => {
    it('decrements stock and records the purchase at the current price', async () => {
      const { stock, service } = setup(5);

      const vehicle = await service.apply('camry', { kind: 'purchase', quantity: 2, userId: 'priya' });

      expect(vehicle.quantity).toBe(3);
      expect(stock.purchases).toEqual([{ vehicleId: 'camry', userId: 'priya', quantity: 2, unitPrice: 27999.99 }]);
    });

    it('tells every handler the before and after quantities', async () => {
      const { handler, service } = setup(5);

      await service.apply('camry', { kind: 'purchase', quantity: 2, userId: 'priya' });

      expect(handler.events).toHaveLength(1);
      expect(handler.events[0]!.event).toMatchObject({ before: 5, after: 3, change: { kind: 'purchase' } });
      expect(handler.events[0]!.event.vehicle.quantity).toBe(3);
    });

    it('does all of it in one transaction', async () => {
      const { runner, stock, handler, service } = setup(5);

      await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' });

      expect(runner.committed).toBe(1);
      expect(new Set([...stock.txSeen, ...handler.events.map((e) => e.tx)])).toEqual(new Set([TX]));
    });

    it('rejects a purchase of an out-of-stock vehicle with OutOfStockError', async () => {
      const { stock, handler, service } = setup(0);

      const err = await service.apply('camry', { kind: 'purchase', quantity: 1, userId: 'priya' }).catch((e) => e);

      expect(err).toBeInstanceOf(OutOfStockError);
      expect(err.message).toBe('Vehicle is out of stock');
      expect(stock.purchases).toEqual([]);
      expect(handler.events).toEqual([]);
    });

    it('rejects buying more than is left, saying how many remain', async () => {
      const { service } = setup(2);

      const err = await service.apply('camry', { kind: 'purchase', quantity: 3, userId: 'priya' }).catch((e) => e);

      expect(err).toBeInstanceOf(OutOfStockError);
      expect(err.message).toBe('Only 2 left in stock');
    });

    it('rejects an unknown vehicle with VehicleNotFoundError', async () => {
      const { service } = setup();

      await expect(service.apply('ghost', { kind: 'purchase', quantity: 1, userId: 'priya' })).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });

  describe('restock', () => {
    it('increments stock and notifies handlers without recording a purchase', async () => {
      const { stock, handler, service } = setup(0);

      const vehicle = await service.apply('camry', { kind: 'restock', quantity: 10 });

      expect(vehicle.quantity).toBe(10);
      expect(stock.purchases).toEqual([]);
      expect(handler.events[0]!.event).toMatchObject({ before: 0, after: 10 });
    });

    it('rejects an unknown vehicle', async () => {
      const { service } = setup();

      await expect(service.apply('ghost', { kind: 'restock', quantity: 1 })).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });
  });

  it('rolls the whole change back when a handler fails', async () => {
    const { runner, stock } = setup(5);
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

describe('StockChangeService set (edits that change quantity)', () => {
  it('sets the quantity with the other edited fields and reports before and after', async () => {
    const { stock, handler, service } = setup(0);

    const vehicle = await service.apply('camry', { kind: 'set', quantity: 7, fields: { price: 25999 } });

    expect(vehicle).toMatchObject({ quantity: 7, price: 25999 });
    expect(stock.purchases).toEqual([]);
    expect(handler.events[0]!.event).toMatchObject({ before: 0, after: 7, change: { kind: 'set' } });
  });

  it('rejects an unknown vehicle', async () => {
    const { service } = setup();

    await expect(service.apply('ghost', { kind: 'set', quantity: 1, fields: {} })).rejects.toBeInstanceOf(
      VehicleNotFoundError,
    );
  });
});
