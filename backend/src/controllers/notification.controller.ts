import type { Request, Response } from 'express';
import type { NotificationService } from '../services/notification.service';
import type { InboxQuery } from '../validators/notification.schemas';

/** The recipient is always the session's user; no endpoint accepts a recipient from the client. */
export function createNotificationController(notifications: NotificationService) {
  return {
    async list(req: Request, res: Response) {
      const { unread, limit } = res.locals.query as InboxQuery;
      res.json(await notifications.list(req.user!.id, { unreadOnly: unread, limit }));
    },

    async markRead(req: Request, res: Response) {
      const { id } = res.locals.params as { id: string };
      res.json({ notification: await notifications.markRead(req.user!.id, id) });
    },

    async markAllRead(req: Request, res: Response) {
      res.json({ updated: await notifications.markAllRead(req.user!.id) });
    },
  };
}
