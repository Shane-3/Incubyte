import { type RequestHandler, Router } from 'express';
import type { createAuthController } from '../controllers/auth.controller';
import type { RateLimiters } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.schemas';

const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function authRoutes(
  controller: ReturnType<typeof createAuthController>,
  authenticate: RequestHandler,
  limiters: Pick<RateLimiters, 'login' | 'register'>,
) {
  const router = Router();
  router.use(noStore);
  router.post('/register', limiters.register, validateBody(registerSchema), controller.register);
  router.post('/login', ...limiters.login, validateBody(loginSchema), controller.login);
  router.post('/logout', authenticate, controller.logout);
  router.get('/me', authenticate, controller.me);
  return router;
}
