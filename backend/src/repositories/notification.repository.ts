import type { Queryable } from '../db/transaction';
import type { AdminAlert, AdminAlertType } from '../types/notification';

/** All notification storage. Reader methods arrive with the notifications API. */
export interface INotificationRepository extends IAlertWriter, IWatcherNotifier {}

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
