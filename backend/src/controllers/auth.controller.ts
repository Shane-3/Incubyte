import type { CookieOptions, Request, Response } from 'express';
import type { Config } from '../config';
import { SESSION_COOKIE } from '../middleware/authenticate';
import type { AuthService } from '../services/auth.service';
import type { LoginBody, RegisterBody } from '../validators/auth.schemas';

type CookieConfig = Pick<Config, 'env' | 'jwtExpiresInSeconds'>;

function sessionCookieOptions(config: CookieConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.env === 'production',
    path: '/api',
  };
}

/** Translates HTTP to AuthService calls. The token only ever travels in the httpOnly cookie. */
export function createAuthController(auth: AuthService, config: CookieConfig) {
  return {
    async register(req: Request, res: Response) {
      const user = await auth.register(req.body as RegisterBody);
      res.status(201).json({ user });
    },

    async login(req: Request, res: Response) {
      const { user, token } = await auth.login(req.body as LoginBody);
      res.cookie(SESSION_COOKIE, token, {
        ...sessionCookieOptions(config),
        maxAge: config.jwtExpiresInSeconds * 1000,
      });
      res.json({ user });
    },

    logout(_req: Request, res: Response) {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
      res.status(204).end();
    },

    async me(req: Request, res: Response) {
      const user = await auth.getCurrentUser(req.user!.id);
      res.json({ user });
    },
  };
}
