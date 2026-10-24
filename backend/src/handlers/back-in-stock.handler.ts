import type { Queryable } from '../db/transaction';
import type { IWatcherNotifier } from '../repositories/notification.repository';
import type { IStockChangeHandler, StockChangeEvent } from '../types/stock';

export class BackInStockHandler implements IStockChangeHandler {
  constructor(private readonly watchers: IWatcherNotifier) {}

  async handle(_event: StockChangeEvent, _tx: Queryable): Promise<void> {
    throw new Error('Not implemented');
  }
}
