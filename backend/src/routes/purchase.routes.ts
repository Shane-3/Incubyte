import { type Request, type RequestHandler, type Response, Router } from 'express';
import { validateQuery } from '../middleware/validate';
import type { PurchaseService } from '../services/purchase.service';
import { type PurchasesQuery, purchasesQuerySchema } from '../validators/purchase.schemas';

interface Guards {
  authenticate: RequestHandler;
  adminOnly: RequestHandler;
}

/** Sales data is business-sensitive, like the forecast: admins only, never cached. */
export function purchaseRoutes(purchases: PurchaseService, guards: Guards) {
  const router = Router();
  router.use(guards.authenticate, guards.adminOnly, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', validateQuery(purchasesQuerySchema), async (_req: Request, res: Response) => {
    res.json(await purchases.feed(res.locals.query as PurchasesQuery));
  });
  return router;
}
