import request from 'supertest';
import { DEFAULT_RATE_LIMITS } from '../../src/middleware/rate-limit';
import { buildTestApp, FRONTEND_ORIGIN, testConfig } from '../helpers/test-app';

function appWithSpecLimits() {
  return buildTestApp({ rateLimits: DEFAULT_RATE_LIMITS, config: testConfig({ trustProxy: true }) });
}

function login(app: Parameters<typeof request>[0], email: string, ip = '203.0.113.10') {
  return request(app)
    .post('/api/auth/login')
    .set('Origin', FRONTEND_ORIGIN)
    .set('Content-Type', 'application/json')
    .set('X-Forwarded-For', ip)
    .send({ email, password: 'Wrong-pass1' });
}

describe('rate limiting', () => {
  it('allows 5 login attempts a minute from one IP, then answers 429 in the standard shape', async () => {
    const { app } = appWithSpecLimits();

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await login(app, `user${i}@example.com`)).status);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    const limited = await login(app, 'another@example.com');
    expect(limited.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('limits attempts against one email even when they come from many IPs', async () => {
    const { app } = appWithSpecLimits();

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await login(app, 'Target@Example.com', `198.51.100.${i}`)).status);

    expect(statuses.at(-1)).toBe(429);
    expect((await login(app, 'someone.else@example.com', '198.51.100.99')).status).toBe(401);
  });

  it('keeps other IPs unaffected', async () => {
    const { app } = appWithSpecLimits();
    for (let i = 0; i < 6; i++) await login(app, `user${i}@example.com`, '203.0.113.10');

    expect((await login(app, 'fresh@example.com', '203.0.113.20')).status).toBe(401);
  });

  it('allows 10 registrations per hour from one IP', async () => {
    const { app } = appWithSpecLimits();

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', FRONTEND_ORIGIN)
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', '203.0.113.30')
        .send({ name: 'Priya Nair', email: `priya${i}@example.com`, password: 'S3curePass!' });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('caps all other API traffic at 100 requests a minute per IP', async () => {
    const { app } = appWithSpecLimits();

    let lastStatus = 0;
    for (let i = 0; i < 101; i++) {
      lastStatus = (await request(app).get('/api/auth/me').set('X-Forwarded-For', '203.0.113.40')).status;
    }

    expect(lastStatus).toBe(429);
  });

  it('ignores X-Forwarded-For unless the app is configured to trust a proxy', async () => {
    const { app } = buildTestApp({ rateLimits: DEFAULT_RATE_LIMITS });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await login(app, `user${i}@example.com`, `192.0.2.${i}`)).status);

    expect(statuses.at(-1)).toBe(429);
  });
});
