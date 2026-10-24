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
