import { z } from 'zod';

// bcrypt only uses the first 72 bytes, so longer passwords are refused rather than silently truncated.
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;

// A short blocklist of the most common passwords that satisfy the length rule.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'sunshine1',
  'letmein1',
  'football1',
  'baseball1',
  'welcome1',
  'admin123',
  'abc12345',
  '11111111',
  '00000000',
]);

const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;

const email = z
  .string()
  .trim()
  .max(255)
  .pipe(z.email({ message: 'must be a valid email address' }));

const passwordWithinBcryptLimit = z.string().refine((value) => Buffer.byteLength(value) <= MAX_PASSWORD_BYTES, {
  message: `must be at most ${MAX_PASSWORD_BYTES} bytes`,
});

export const registerSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, { message: 'is required', abort: true })
    .max(100)
    .regex(NAME_PATTERN, 'may only contain letters, spaces, apostrophes, hyphens and dots'),
  email,
  password: passwordWithinBcryptLimit
    .refine((value) => value.length >= MIN_PASSWORD_LENGTH, {
      message: `must be at least ${MIN_PASSWORD_LENGTH} characters`,
      abort: true,
    })
    .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), { message: 'is too common' }),
});

export const loginSchema = z.strictObject({
  email,
  password: passwordWithinBcryptLimit.refine((value) => value.length > 0, { message: 'is required' }),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
