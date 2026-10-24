import type { ITransactionRunner } from '../db/transaction';
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

  async apply(_vehicleId: string, _change: StockChange): Promise<Vehicle> {
    throw new Error('Not implemented');
  }
}
