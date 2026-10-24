import type { Queryable } from '../db/transaction';
import type { AdminAlert, AdminAlertType, InboxOptions, NotificationView } from '../types/notification';

/** All notification storage: the inbox reader plus the writers used inside stock-change transactions. */
export interface INotificationRepository extends INotificationInbox, IAlertWriter, IWatcherNotifier {}

/** Every method is scoped to one recipient, taken from the verified session, never from client input. */
export interface INotificationInbox {
  listFor(recipientId: string, options: InboxOptions): Promise<NotificationView[]>;
  unreadCount(recipientId: string): Promise<number>;
  /** Null when the notification does not exist or belongs to someone else. Keeps the first read time. */
  markRead(recipientId: string, notificationId: string): Promise<NotificationView | null>;
  /** Returns how many notifications changed. */
  markAllRead(recipientId: string): Promise<number>;
}

/** Back-in-stock fan-out, used inside stock-change transactions. */
export interface IWatcherNotifier {
  /** Sends BACK_IN_STOCK to everyone watching the vehicle and removes their (one-shot) watches. Returns the count. */
  notifyWatchers(tx: Queryable, vehicleId: string, quantity: number): Promise<number>;
}

/** The write side used inside stock-change transactions. */
export interface IAlertWriter {
  /** One alert per admin; an alert that is already open for that admin, vehicle and type is not duplicated. */
  notifyAdmins(tx: Queryable, alert: AdminAlert): Promise<void>;
  /** Marks open alerts of the given types for the vehicle as resolved. */
  resolveAlerts(tx: Queryable, vehicleId: string, types: AdminAlertType[]): Promise<void>;
}
