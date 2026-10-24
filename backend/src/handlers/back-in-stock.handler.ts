import type { Queryable } from '../db/transaction';
import type { IWatcherNotifier } from '../repositories/notification.repository';
import type { IStockChangeHandler, StockChangeEvent } from '../types/stock';

/** Tells watchers a sold-out vehicle is available again; their watches are one-shot and cleared. */
export class BackInStockHandler implements IStockChangeHandler {
  constructor(private readonly watchers: IWatcherNotifier) {}

  async handle({ vehicle, before, after }: StockChangeEvent, tx: Queryable): Promise<void> {
    if (before === 0 && after > 0) {
      await this.watchers.notifyWatchers(tx, vehicle.id, after);
    }
  }
}
