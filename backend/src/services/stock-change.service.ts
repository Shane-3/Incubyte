import type { ITransactionRunner, Queryable } from '../db/transaction';
import { OutOfStockError, ValidationError, VehicleNotFoundError } from '../errors';
import type { IStockRepository } from '../repositories/stock.repository';
import type { IStockChangeHandler, StockChange } from '../types/stock';
import type { Colour, Vehicle } from '../types/vehicle';

type Change<K extends StockChange['kind']> = Extract<StockChange, { kind: K }>;

const notThisVehicle = () => new ValidationError([{ field: 'colourId', message: 'is not a colour of this vehicle' }]);

/**
 * The single path for every change to a vehicle's stock. The model row is locked first, then the colour and the
 * model total change together with the purchase record and every handler (alerts, back-in-stock), all in one
 * transaction, so they can never disagree. Handlers see model totals.
 */
export class StockChangeService {
  constructor(
    private readonly transactions: ITransactionRunner,
    private readonly stock: IStockRepository,
    private readonly handlers: IStockChangeHandler[],
  ) {}

  apply(vehicleId: string, change: StockChange): Promise<Vehicle> {
    return this.transactions.run(async (tx) => {
      const current = await this.stock.lockVehicle(tx, vehicleId);
      if (!current) throw new VehicleNotFoundError();

      const vehicle = await this.write(tx, current, change);
      for (const handler of this.handlers) {
        await handler.handle({ change, vehicle, before: current.quantity, after: vehicle.quantity }, tx);
      }
      return vehicle;
    });
  }

  private write(tx: Queryable, current: Vehicle, change: StockChange): Promise<Vehicle> {
    switch (change.kind) {
      case 'purchase':
        return this.purchase(tx, current, change);
      case 'restock':
        return this.stock.adjustColour(
          tx,
          current.id,
          this.colourToStock(current, change.colourId).id,
          change.quantity,
        );
      case 'set':
        return this.set(tx, current, change);
      case 'receive':
        return this.receive(tx, current, change);
    }
  }

  private async purchase(tx: Queryable, current: Vehicle, change: Change<'purchase'>) {
    const colour = change.colourId === undefined ? this.bestStocked(current) : this.colourOf(current, change.colourId);

    if (colour.quantity < change.quantity) {
      // Without a chosen colour the message stays about the model, as it was before colours existed.
      if (change.colourId === undefined) throw new OutOfStockError(colour.quantity);
      throw new OutOfStockError(colour.quantity, colour.name);
    }

    const vehicle = await this.stock.adjustColour(tx, current.id, colour.id, -change.quantity);
    await this.stock.recordPurchase(tx, {
      vehicleId: current.id,
      colourId: colour.id,
      userId: change.userId,
      quantity: change.quantity,
      unitPrice: current.price,
    });
    return vehicle;
  }

  private set(tx: Queryable, current: Vehicle, change: Change<'set'>) {
    const [only, ...others] = current.colours;
    if (!only || others.length > 0) {
      throw new ValidationError([
        { field: 'quantity', message: 'must be changed per colour for a model with several colours' },
      ]);
    }
    return this.stock.setStock(tx, current.id, only.id, change.quantity, change.fields);
  }

  private async receive(tx: Queryable, current: Vehicle, change: Change<'receive'>) {
    const name = change.colour.name.toLowerCase();
    const colour =
      current.colours.find((c) => c.name.toLowerCase() === name) ??
      (await this.stock.addColour(tx, current.id, change.colour));
    return this.stock.adjustColour(tx, current.id, colour.id, change.quantity);
  }

  private colourOf(vehicle: Vehicle, colourId: string): Colour {
    const colour = vehicle.colours.find((c) => c.id === colourId);
    if (!colour) throw notThisVehicle();
    return colour;
  }

  /** The colour with the most stock; the oldest wins a tie. */
  private bestStocked(vehicle: Vehicle): Colour {
    return vehicle.colours.reduce((best, c) => (c.quantity > best.quantity ? c : best));
  }

  /** A restock names its colour, unless there is only one. */
  private colourToStock(vehicle: Vehicle, colourId?: string): Colour {
    if (colourId !== undefined) return this.colourOf(vehicle, colourId);
    if (vehicle.colours.length !== 1) {
      throw new ValidationError([{ field: 'colourId', message: 'is required when the model has several colours' }]);
    }
    return vehicle.colours[0]!;
  }
}
