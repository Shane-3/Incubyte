import type { Pool } from 'pg';
import type { Queryable } from '../db/transaction';
import { isUuid } from '../db/errors';
import type {
  AdminAlert,
  AdminAlertType,
  InboxOptions,
  NotificationType,
  NotificationView,
} from '../types/notification';
import type { INotificationRepository } from './notification.repository';

interface InboxRow {
  id: string;
  type: NotificationType;
  vehicle_id: string;
  make: string;
  model: string;
  quantity: number;
  read_at: Date | null;
  resolved_at: Date | null;
  created_at: Date;
}

const INBOX_COLUMNS =
  'n.id, n.type, n.vehicle_id, v.make, v.model, n.quantity, n.read_at, n.resolved_at, n.created_at';

function toView(row: InboxRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    vehicle: { id: row.vehicle_id, make: row.make, model: row.model },
    quantity: row.quantity,
    readAt: row.read_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

export class PgNotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  // Every inbox query filters on recipient_id from the verified session, so another user's ids simply match nothing.

  async listFor(recipientId: string, { unreadOnly, limit }: InboxOptions): Promise<NotificationView[]> {
    const { rows } = await this.pool.query<InboxRow>(
      `SELECT ${INBOX_COLUMNS}
       FROM notifications n JOIN vehicles v ON v.id = n.vehicle_id
       WHERE n.recipient_id = $1 AND ($2::boolean = false OR n.read_at IS NULL)
       ORDER BY n.created_at DESC, n.id
       LIMIT $3`,
      [recipientId, unreadOnly, limit],
    );
    return rows.map(toView);
  }

  async unreadCount(recipientId: string): Promise<number> {
    const { rows } = await this.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM notifications WHERE recipient_id = $1 AND read_at IS NULL',
      [recipientId],
    );
    return rows[0]!.n;
  }

  async markRead(recipientId: string, notificationId: string): Promise<NotificationView | null> {
    if (!isUuid(notificationId)) return null;
    const { rows } = await this.pool.query<InboxRow>(
      `WITH marked AS (
         UPDATE notifications SET read_at = COALESCE(read_at, now())
         WHERE id = $1 AND recipient_id = $2
         RETURNING *
       )
       SELECT ${INBOX_COLUMNS} FROM marked n JOIN vehicles v ON v.id = n.vehicle_id`,
      [notificationId, recipientId],
    );
    return rows[0] ? toView(rows[0]) : null;
  }

  async markAllRead(recipientId: string): Promise<number> {
    const { rowCount } = await this.pool.query(
      'UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL',
      [recipientId],
    );
    return rowCount ?? 0;
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
