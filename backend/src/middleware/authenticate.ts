import type { RequestHandler } from 'express';
import { UnauthenticatedError } from '../errors';
import type { ITokenService } from '../services/token.service';

export const SESSION_COOKIE = 'token';

/** Verifies the session cookie and attaches { id, role } to req.user. Rejects with 401 otherwise. */
export function authenticate(tokens: ITokenService): RequestHandler {
  return (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthenticatedError();
    }
    const { sub, role } = tokens.verify(token);
    req.user = { id: sub, role };
    next();
  };
}
