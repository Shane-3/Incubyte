import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

export interface Limit {
  windowMs: number;
  limit: number;
}

export interface RateLimits {
  /** Everything under /api, per IP. */
  api: Limit;
  /** POST /api/auth/login, per IP and separately per email. */
  login: Limit;
  /** POST /api/auth/register, per IP. */
  register: Limit;
  /** Watch and read-all, per IP. */
  sensitive: Limit;
}

const MINUTE = 60_000;

/** security.md section 9. */
export const DEFAULT_RATE_LIMITS: RateLimits = {
  api: { windowMs: MINUTE, limit: 100 },
  login: { windowMs: MINUTE, limit: 5 },
  register: { windowMs: 60 * MINUTE, limit: 10 },
  sensitive: { windowMs: MINUTE, limit: 30 },
};

/** Effectively off; for test suites that are not about rate limiting. */
export const UNLIMITED: RateLimits = {
  api: { windowMs: MINUTE, limit: 1_000_000 },
  login: { windowMs: MINUTE, limit: 1_000_000 },
  register: { windowMs: MINUTE, limit: 1_000_000 },
  sensitive: { windowMs: MINUTE, limit: 1_000_000 },
};

function limiter({ windowMs, limit }: Limit, keyGenerator?: (req: Request) => string): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (_req, res, _next, options) => {
      res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } });
    },
  });
}

/** Per-email key for login, so credential stuffing spread across many IPs is still throttled. */
function loginEmailKey(req: Request): string {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? `email:${email.trim().toLowerCase()}` : `ip:${req.ip}`;
}

/**
 * Builds a fresh set of limiters (in-memory, so per process; see security.md section 13).
 * Each call has its own counters, so every app instance starts clean.
 */
export function createRateLimiters(limits: RateLimits) {
  return {
    api: limiter(limits.api),
    login: [limiter(limits.login), limiter(limits.login, loginEmailKey)],
    register: limiter(limits.register),
    /** A factory: each abuse-prone endpoint gets its own counter. */
    sensitive: () => limiter(limits.sensitive),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
