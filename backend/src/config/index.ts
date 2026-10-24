import { z } from 'zod';

export type Env = Record<string, string | undefined>;

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  bcryptRounds: number;
  lowStockThreshold: number;
  forecastWindowDays: number;
  forecastAtRiskDays: number;
  maxWatchesPerUser: number;
  corsOrigin: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const MIN_PRODUCTION_SECRET_BYTES = 32;
const PLACEHOLDER_SECRET = 'change-me';
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** "3600", "90s", "15m", "1h" or "7d" to seconds. */
const duration = z
  .string()
  .regex(/^\d+[smhd]?$/, 'must be seconds or a number with s, m, h or d')
  .transform((value) => {
    const unit = /[smhd]$/.test(value) ? value.slice(-1) : 's';
    return Number.parseInt(value, 10) * (DURATION_UNITS[unit] ?? 1);
  });

const int = (fallback: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(4000, 1, 65535),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: duration.default(3600),
  BCRYPT_ROUNDS: int(12, 4, 15),
  LOW_STOCK_THRESHOLD: int(3, 0, 1000),
  FORECAST_WINDOW_DAYS: int(30, 1, 365),
  FORECAST_AT_RISK_DAYS: int(7, 1, 365),
  MAX_WATCHES_PER_USER: int(50, 1, 1000),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
});

export function loadConfig(env: Env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new ConfigError(`Invalid environment: ${problems.join('; ')}`);
  }

  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    assertStrongSecret(e.JWT_SECRET);
  }

  return {
    env: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    jwtExpiresInSeconds: e.JWT_EXPIRES_IN,
    bcryptRounds: e.BCRYPT_ROUNDS,
    lowStockThreshold: e.LOW_STOCK_THRESHOLD,
    forecastWindowDays: e.FORECAST_WINDOW_DAYS,
    forecastAtRiskDays: e.FORECAST_AT_RISK_DAYS,
    maxWatchesPerUser: e.MAX_WATCHES_PER_USER,
    corsOrigin: e.CORS_ORIGIN,
  };
}

function assertStrongSecret(secret: string): void {
  if (Buffer.byteLength(secret) < MIN_PRODUCTION_SECRET_BYTES) {
    throw new ConfigError(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_BYTES} bytes in production`);
  }
  if (secret.includes(PLACEHOLDER_SECRET)) {
    throw new ConfigError('JWT_SECRET is still the placeholder from .env.example');
  }
}
