import type { Queryable } from '../db/transaction';
import type { IWatchRepository } from './watch.repository';

export class PgWatchRepository implements IWatchRepository {
  async lockWatcher(_tx: Queryable, _userId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async vehicleStock(_tx: Queryable, _vehicleId: string): Promise<number | null> {
    throw new Error('Not implemented');
  }

  async isWatching(_tx: Queryable, _userId: string, _vehicleId: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async countFor(_tx: Queryable, _userId: string): Promise<number> {
    throw new Error('Not implemented');
  }

  async add(_tx: Queryable, _userId: string, _vehicleId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async remove(_tx: Queryable, _userId: string, _vehicleId: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
