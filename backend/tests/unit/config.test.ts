import { ConfigError, loadConfig } from '../../src/config';

const STRONG_SECRET = 'a'.repeat(16) + 'B'.repeat(16) + 'c'.repeat(16);

const baseEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://app:pw@localhost:5432/dealership',
  JWT_SECRET: 'dev-secret',
};

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const config = loadConfig(baseEnv);

    expect(config).toMatchObject({
      env: 'development',
      port: 4000,
      jwtExpiresInSeconds: 3600,
      bcryptRounds: 12,
      lowStockThreshold: 3,
      forecastWindowDays: 30,
      forecastAtRiskDays: 7,
      maxWatchesPerUser: 50,
      corsOrigin: 'http://localhost:5173',
      trustProxy: false,
    });
  });

  it('reads overrides and parses durations', () => {
    const config = loadConfig({
      ...baseEnv,
      PORT: '8080',
      JWT_EXPIRES_IN: '15m',
      BCRYPT_ROUNDS: '10',
      TRUST_PROXY: '1',
    });

    expect(config.port).toBe(8080);
    expect(config.jwtExpiresInSeconds).toBe(900);
    expect(config.bcryptRounds).toBe(10);
    expect(config.trustProxy).toBe(1);
  });

  it.each([
    ['DATABASE_URL', { DATABASE_URL: undefined }],
    ['JWT_SECRET', { JWT_SECRET: undefined }],
    ['BCRYPT_ROUNDS', { BCRYPT_ROUNDS: 'twelve' }],
    ['JWT_EXPIRES_IN', { JWT_EXPIRES_IN: 'forever' }],
    ['TRUST_PROXY', { TRUST_PROXY: 'everyone' }],
  ])('refuses to start when %s is missing or invalid', (name, override) => {
    expect(() => loadConfig({ ...baseEnv, ...override })).toThrow(new RegExp(name));
  });

  describe('in production', () => {
    const prod = { ...baseEnv, NODE_ENV: 'production', JWT_SECRET: STRONG_SECRET };

    it('accepts a secret of at least 32 bytes', () => {
      expect(loadConfig(prod).env).toBe('production');
    });

    it('refuses a secret shorter than 32 bytes', () => {
      expect(() => loadConfig({ ...prod, JWT_SECRET: 'short-but-not-empty' })).toThrow(ConfigError);
    });

    it('refuses the placeholder secret from .env.example, even when padded to length', () => {
      expect(() => loadConfig({ ...prod, JWT_SECRET: 'change-me-change-me-change-me-change-me' })).toThrow(ConfigError);
    });
  });
});
