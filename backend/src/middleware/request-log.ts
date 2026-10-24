import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../logging/logger';

// Auth failures and throttling are what an operator watches for (security.md section 10).
const WARN_STATUSES = new Set([401, 403, 429]);

/**
 * Assigns a server-generated request id (client values are ignored so they cannot be forged or injected) and
 * writes one access-log entry per request. Only allow-listed fields are logged: no query string, headers,
 * cookies or bodies.
 */
export function requestLog(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    const path = req.originalUrl.split('?')[0];
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const status = res.statusCode;
      const entry = {
        msg: 'request',
        requestId,
        method: req.method,
        path,
        status,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
        ...(req.user && { userId: req.user.id }),
      };
      if (status >= 500) logger.error(entry);
      else if (WARN_STATUSES.has(status)) logger.warn(entry);
      else logger.info(entry);
    });
    next();
  };
}
