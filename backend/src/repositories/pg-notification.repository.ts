import type { Pool } from 'pg';
import type { Queryable } from '../db/transaction';
import type { AdminAlert, AdminAlertType, InboxOptions, NotificationView } from '../types/notification';
import type { INotificationRepository } from './notification.repository';

export class PgNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async listFor(_recipientId: string, _options: InboxOptions): Promise<NotificationView[]> {
    throw new Error('Not implemented');
  }

  async unreadCount(_recipientId: string): Promise<number> {
    throw new Error('Not implemented');
  }

  async markRead(_recipientId: string, _notificationId: string): Promise<NotificationView | null> {
    throw new Error('Not implemented');
  }

  async markAllRead(_recipientId: string): Promise<number> {
    throw new Error('Not implemented');
  }

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

  async notifyWatchers(tx: Queryable, vehicleId: string, quantity: number): Promise<number> {
    // Deleting and notifying in one statement means each watch produces exactly one notice.
    const { rowCount } = await tx.query(
      `WITH released AS (DELETE FROM watches WHERE vehicle_id = $1 RETURNING user_id)
       INSERT INTO notifications (recipient_id, type, vehicle_id, quantity)
       SELECT user_id, 'BACK_IN_STOCK', $1, $2 FROM released`,
      [vehicleId, quantity],
    );
    return rowCount ?? 0;
  }

  async resolveAlerts(tx: Queryable, vehicleId: string, types: AdminAlertType[]): Promise<void> {
    await tx.query(
      `UPDATE notifications SET resolved_at = now()
       WHERE vehicle_id = $1 AND type = ANY($2::text[]) AND resolved_at IS NULL`,
      [vehicleId, types],
    );
  }
}
