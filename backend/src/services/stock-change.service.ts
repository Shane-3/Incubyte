import type { Queryable, ITransactionRunner } from '../db/transaction';
import { OutOfStockError, VehicleNotFoundError } from '../errors';
import type { IStockRepository } from '../repositories/stock.repository';
import type { IStockChangeHandler, StockChange } from '../types/stock';
import type { Vehicle } from '../types/vehicle';

/**
 * The single path for every change to a vehicle's quantity. The stock write, the purchase record and every
 * handler (alerts, back-in-stock) share one transaction, so they can never disagree.
 */
export class StockChangeService {
  constructor(
    private readonly transactions: ITransactionRunner,
    private readonly stock: IStockRepository,
    private readonly handlers: IStockChangeHandler[],
  ) {}

  apply(vehicleId: string, change: StockChange): Promise<Vehicle> {
    return this.transactions.run(async (tx) => {
      const { vehicle, before } =
        change.kind === 'purchase'
          ? await this.purchase(tx, vehicleId, change)
          : change.kind === 'restock'
            ? await this.restock(tx, vehicleId, change.quantity)
            : await this.set();

      for (const handler of this.handlers) {
        await handler.handle({ change, vehicle, before, after: vehicle.quantity }, tx);
      }
      return vehicle;
    });
  }

  private async purchase(tx: Queryable, vehicleId: string, change: Extract<StockChange, { kind: 'purchase' }>) {
    const vehicle = await this.stock.decrement(tx, vehicleId, change.quantity);
    if (!vehicle) {
      // The conditional update matched nothing: find out whether the vehicle is missing or just short.
      const current = await this.stock.findById(tx, vehicleId);
      throw current ? new OutOfStockError(current.quantity) : new VehicleNotFoundError();
    }
    await this.stock.recordPurchase(tx, {
      vehicleId,
      userId: change.userId,
      quantity: change.quantity,
      unitPrice: vehicle.price,
    });
    return { vehicle, before: vehicle.quantity + change.quantity };
  }

  private async set(): Promise<{ vehicle: Vehicle; before: number }> {
    throw new Error('Not implemented');
  }

  private async restock(tx: Queryable, vehicleId: string, quantity: number) {
    const vehicle = await this.stock.increment(tx, vehicleId, quantity);
    if (!vehicle) {
      throw new VehicleNotFoundError();
    }
    return { vehicle, before: vehicle.quantity - quantity };
  }
}
