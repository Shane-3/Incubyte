import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { type ErrorDetail, ValidationError } from '../errors';

export function toErrorDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(body)',
    message: issue.message,
  }));
}

function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(toErrorDetails(result.error));
  }
  return result.data;
}

/** Replaces req.body with the parsed (trimmed, allow-listed) value, or rejects with field-level errors. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}

/** Parses req.query into res.locals.query (Express 5 makes req.query read-only). */
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals.query = parseOrThrow(schema, req.query);
    next();
  };
}

/** Parses route params into res.locals.params. */
export function validateParams(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals.params = parseOrThrow(schema, req.params);
    next();
  };
}
