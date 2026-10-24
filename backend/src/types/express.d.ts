import type { Role } from './user';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware from a verified session token. */
      user?: { id: string; role: Role };
    }
  }
}

export {};
