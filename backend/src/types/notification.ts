export const NOTIFICATION_TYPES = ['LOW_STOCK', 'OUT_OF_STOCK', 'BACK_IN_STOCK'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Alerts that go to every admin and are resolved by a restock. */
export type AdminAlertType = Extract<NotificationType, 'LOW_STOCK' | 'OUT_OF_STOCK'>;

export interface AdminAlert {
  type: AdminAlertType;
  vehicleId: string;
  /** Stock level when the alert was raised. */
  quantity: number;
}
