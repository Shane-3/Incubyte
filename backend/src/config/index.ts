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

export function loadConfig(_env: Env): Config {
  throw new ConfigError('Not implemented');
}
