/** Postgres SQLSTATE codes the repositories translate into domain errors. */
export const PG_UNIQUE_VIOLATION = '23505';

export function isPgError(err: unknown, code: string, constraint?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const pg = err as { code?: unknown; constraint?: unknown };
  return pg.code === code && (constraint === undefined || pg.constraint === constraint);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
