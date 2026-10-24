import type { Queryable } from '../db/transaction';

/** Watch storage. Every method runs on the caller's transaction. */
export interface IWatchRepository {
  /** Serialises one user's watch changes so concurrent requests cannot exceed the cap. */
  lockWatcher(tx: Queryable, userId: string): Promise<void>;
  /** Current stock, read under a share lock so a concurrent restock cannot slip in between; null if missing. */
  vehicleStock(tx: Queryable, vehicleId: string): Promise<number | null>;
  isWatching(tx: Queryable, userId: string, vehicleId: string): Promise<boolean>;
  countFor(tx: Queryable, userId: string): Promise<number>;
  add(tx: Queryable, userId: string, vehicleId: string): Promise<void>;
  remove(tx: Queryable, userId: string, vehicleId: string): Promise<void>;
}
