import type { ITransactionRunner } from '../db/transaction';
import { InStockError, VehicleNotFoundError, WatchLimitReachedError } from '../errors';
import type { IWatchRepository } from '../repositories/watch.repository';

/** One-shot "notify me when it's back" subscriptions on out-of-stock vehicles. */
export class WatchService {
  constructor(
    private readonly transactions: ITransactionRunner,
    private readonly watches: IWatchRepository,
    private readonly maxWatches: number,
  ) {}

  watch(userId: string, vehicleId: string): Promise<void> {
    return this.transactions.run(async (tx) => {
      await this.watches.lockWatcher(tx, userId);

      const stock = await this.watches.vehicleStock(tx, vehicleId);
      if (stock === null) throw new VehicleNotFoundError();
      if (stock > 0) throw new InStockError();
      if (await this.watches.isWatching(tx, userId, vehicleId)) return;

      if ((await this.watches.countFor(tx, userId)) >= this.maxWatches) {
        throw new WatchLimitReachedError(this.maxWatches);
      }
      await this.watches.add(tx, userId, vehicleId);
    });
  }

  unwatch(userId: string, vehicleId: string): Promise<void> {
    return this.transactions.run(async (tx) => {
      if ((await this.watches.vehicleStock(tx, vehicleId)) === null) {
        throw new VehicleNotFoundError();
      }
      await this.watches.remove(tx, userId, vehicleId);
    });
  }
}
