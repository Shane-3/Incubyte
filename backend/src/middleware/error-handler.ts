import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError } from '../errors';

interface BodyParserError {
  type: string;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return typeof err === 'object' && err !== null && typeof (err as BodyParserError).type === 'string';
}

export const notFound: RequestHandler = () => {
  throw new NotFoundError('Route not found');
};

/** Maps every error to the standard { error: { code, message, details? } } shape. Never leaks internals. */
export function errorHandler(log: (err: unknown) => void): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
      });
      return;
    }

    if (isBodyParserError(err) && err.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
      return;
    }
    if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
      return;
    }

    log(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  };
}
