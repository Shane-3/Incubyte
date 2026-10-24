import { type RequestHandler, Router } from 'express';
import type { createNotificationController } from '../controllers/notification.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { inboxQuerySchema, notificationIdSchema } from '../validators/notification.schemas';
import { emptyBodySchema } from '../validators/vehicle.schemas';

interface Guards {
  authenticate: RequestHandler;
  /** Per-IP limit for the bulk read-all write. */
  throttle: RequestHandler;
}

export function notificationRoutes(controller: ReturnType<typeof createNotificationController>, guards: Guards) {
  const router = Router();
  router.use(guards.authenticate);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', validateQuery(inboxQuerySchema), controller.list);
  router.post('/read-all', guards.throttle, validateBody(emptyBodySchema), controller.markAllRead);
  router.post('/:id/read', validateParams(notificationIdSchema), validateBody(emptyBodySchema), controller.markRead);
  return router;
}
