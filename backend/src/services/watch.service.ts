import type { ITransactionRunner } from '../db/transaction';
import type { IWatchRepository } from '../repositories/watch.repository';

export class WatchService {
  constructor(
    private readonly transactions: ITransactionRunner,
    private readonly watches: IWatchRepository,
    private readonly maxWatches: number,
  ) {}

  async watch(_userId: string, _vehicleId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async unwatch(_userId: string, _vehicleId: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
