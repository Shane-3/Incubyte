import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { type ErrorDetail, ValidationError } from '../errors';

export function toErrorDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
  }));
}

/** Replaces req.body with the parsed (trimmed, allow-listed) value, or rejects with field-level errors. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      throw new ValidationError(toErrorDetails(result.error));
    }
    req.body = result.data;
    next();
  };
}
