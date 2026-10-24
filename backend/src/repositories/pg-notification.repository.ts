import type { Pool } from 'pg';
import type { Queryable } from '../db/transaction';
import type { AdminAlert, AdminAlertType } from '../types/notification';
import type { INotificationRepository } from './notification.repository';

export class PgNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async notifyAdmins(tx: Queryable, { type, vehicleId, quantity }: AdminAlert): Promise<void> {
    // The conflict target matches the partial unique index, so an alert that is already open is left alone.
    await tx.query(
      `INSERT INTO notifications (recipient_id, type, vehicle_id, quantity)
       SELECT id, $1, $2, $3 FROM users WHERE role = 'admin'
       ON CONFLICT (recipient_id, vehicle_id, type)
         WHERE resolved_at IS NULL AND type IN ('LOW_STOCK', 'OUT_OF_STOCK')
       DO NOTHING`,
      [type, vehicleId, quantity],
    );
  }

  async notifyWatchers(_tx: Queryable, _vehicleId: string, _quantity: number): Promise<number> {
    throw new Error('Not implemented');
  }

  async resolveAlerts(tx: Queryable, vehicleId: string, types: AdminAlertType[]): Promise<void> {
    await tx.query(
      `UPDATE notifications SET resolved_at = now()
       WHERE vehicle_id = $1 AND type = ANY($2::text[]) AND resolved_at IS NULL`,
      [vehicleId, types],
    );
  }
}
