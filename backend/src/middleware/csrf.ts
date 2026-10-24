import type { Request, RequestHandler } from 'express';
import { ForbiddenError, UnsupportedMediaTypeError } from '../errors';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originOf(req: Request): string | undefined {
  const origin = req.get('Origin');
  if (origin) return origin;

  const referer = req.get('Referer');
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

function hasBody(req: Request): boolean {
  const length = req.get('Content-Length');
  return req.get('Transfer-Encoding') !== undefined || (length !== undefined && length !== '0');
}

/** Mutations must come from the allow-listed frontend origin (Origin header, falling back to Referer). */
export function requireTrustedOrigin(allowedOrigin: string): RequestHandler {
  const allowed = new URL(allowedOrigin).origin;
  return (req, _res, next) => {
    if (MUTATING_METHODS.has(req.method) && originOf(req) !== allowed) {
      throw new ForbiddenError('Request origin is not allowed');
    }
    next();
  };
}

/** Mutation bodies must be JSON, which cross-site HTML forms cannot send without a (denied) preflight. */
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  if (MUTATING_METHODS.has(req.method) && hasBody(req) && !req.is('application/json')) {
    throw new UnsupportedMediaTypeError();
  }
  next();
};
