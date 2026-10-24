import { NotFoundError } from '../errors';
import type { INotificationInbox } from '../repositories/notification.repository';
import type { InboxOptions, NotificationView } from '../types/notification';

export class NotificationService {
  constructor(private readonly inbox: INotificationInbox) {}

  async list(recipientId: string, options: InboxOptions) {
    const [data, unreadCount] = await Promise.all([
      this.inbox.listFor(recipientId, options),
      this.inbox.unreadCount(recipientId),
    ]);
    return { data, unreadCount };
  }

  async markRead(recipientId: string, notificationId: string): Promise<NotificationView> {
    const notification = await this.inbox.markRead(recipientId, notificationId);
    if (!notification) {
      // Same answer for "missing" and "someone else's", so ids reveal nothing.
      throw new NotFoundError('Notification not found');
    }
    return notification;
  }

  async markAllRead(recipientId: string): Promise<number> {
    return this.inbox.markAllRead(recipientId);
  }
}
