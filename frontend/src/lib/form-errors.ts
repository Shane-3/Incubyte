import { ApiError } from '../api/client';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export interface MappedError<F extends string> {
  fields: FieldErrors<F>;
  /** Anything that does not belong to a single field. */
  form: string | null;
}

/**
 * Turns an API error into messages next to the fields they concern ("Password is too common"), falling back to a
 * form-level message for everything else.
 */
export function mapApiError<F extends string>(err: unknown, labels: Record<F, string>): MappedError<F> {
  if (!(err instanceof ApiError)) {
    return { fields: {}, form: 'Something went wrong. Try again.' };
  }
  if (err.code === 'EMAIL_TAKEN' && 'email' in labels) {
    return { fields: { email: 'An account with this email already exists' } as FieldErrors<F>, form: null };
  }

  const fields: FieldErrors<F> = {};
  const unplaced: string[] = [];
  for (const detail of err.details) {
    if (detail.field in labels) {
      fields[detail.field as F] ??= `${labels[detail.field as F]} ${detail.message}`;
    } else {
      unplaced.push(detail.message);
    }
  }
  const placedAny = Object.keys(fields).length > 0;
  return { fields, form: placedAny && unplaced.length === 0 ? null : err.message };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
