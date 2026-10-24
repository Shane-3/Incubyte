import { isUuid } from '../db/errors';
import type { Queryable } from '../db/transaction';
import type { IWatchRepository } from './watch.repository';

export class PgWatchRepository implements IWatchRepository {
  async lockWatcher(tx: Queryable, userId: string): Promise<void> {
    await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
  }

  async vehicleStock(tx: Queryable, vehicleId: string): Promise<number | null> {
    if (!isUuid(vehicleId)) return null;
    const { rows } = await tx.query<{ quantity: number }>('SELECT quantity FROM vehicles WHERE id = $1 FOR SHARE', [
      vehicleId,
    ]);
    return rows[0]?.quantity ?? null;
  }

  async isWatching(tx: Queryable, userId: string, vehicleId: string): Promise<boolean> {
    const { rowCount } = await tx.query('SELECT 1 FROM watches WHERE user_id = $1 AND vehicle_id = $2', [
      userId,
      vehicleId,
    ]);
    return rowCount === 1;
  }

  async countFor(tx: Queryable, userId: string): Promise<number> {
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM watches WHERE user_id = $1', [
      userId,
    ]);
    return rows[0]!.n;
  }

  async add(tx: Queryable, userId: string, vehicleId: string): Promise<void> {
    await tx.query('INSERT INTO watches (user_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      userId,
      vehicleId,
    ]);
  }

  async remove(tx: Queryable, userId: string, vehicleId: string): Promise<void> {
    await tx.query('DELETE FROM watches WHERE user_id = $1 AND vehicle_id = $2', [userId, vehicleId]);
  }
}
