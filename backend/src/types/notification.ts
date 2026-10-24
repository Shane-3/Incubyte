export const NOTIFICATION_TYPES = ['LOW_STOCK', 'OUT_OF_STOCK', 'BACK_IN_STOCK'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Alerts that go to every admin and are resolved by a restock. */
export type AdminAlertType = Extract<NotificationType, 'LOW_STOCK' | 'OUT_OF_STOCK'>;

/** A notification as its recipient sees it. No free text is stored; the client words it from these fields. */
export interface NotificationView {
  id: string;
  type: NotificationType;
  vehicle: { id: string; make: string; model: string };
  quantity: number;
  readAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface InboxOptions {
  unreadOnly: boolean;
  limit: number;
}

export interface AdminAlert {
  type: AdminAlertType;
  vehicleId: string;
  /** Stock level when the alert was raised. */
  quantity: number;
}
