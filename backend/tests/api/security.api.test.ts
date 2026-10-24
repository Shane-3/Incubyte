import request from 'supertest';
import { InMemoryUserRepository } from '../helpers/fakes';
import { buildTestApp, FRONTEND_ORIGIN, testConfig } from '../helpers/test-app';

const credentials = { email: 'priya.nair@example.com', password: 'S3curePass!' };

describe('CSRF defences on state-changing requests', () => {
  it('rejects a request from a foreign Origin with 403', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Content-Type', 'application/json')
      .send(credentials);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a request with neither Origin nor Referer', async () => {
    const { app } = buildTestApp();

    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(credentials);

    expect(res.status).toBe(403);
  });

  it('accepts a matching Referer when Origin is absent', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Referer', `${FRONTEND_ORIGIN}/login`)
      .set('Content-Type', 'application/json')
      .send(credentials);

    expect(res.status).toBe(401);
  });

  it('rejects a foreign Referer', async () => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Referer', 'https://localhost:5173.evil.example/login')
      .set('Content-Type', 'application/json')
      .send(credentials);

    expect(res.status).toBe(403);
  });

  it('checks every mutating method before routing', async () => {
    const { app } = buildTestApp();

    for (const method of ['put', 'patch', 'delete'] as const) {
      const res = await request(app)[method]('/api/anything').set('Origin', 'https://evil.example');
      expect(res.status, method).toBe(403);
    }
  });

  it('does not require an Origin on reads', async () => {
    const { app, sessionCookieFor } = buildTestApp();

    const res = await request(app).get('/api/auth/me').set('Cookie', sessionCookieFor().cookie);

    expect(res.status).toBe(200);
  });

  it.each([
    ['text/plain', JSON.stringify(credentials)],
    ['application/x-www-form-urlencoded', 'email=a%40b.com&password=x'],
    ['multipart/form-data; boundary=x', '--x--'],
  ])('rejects a %s body with 415', async (contentType, body) => {
    const { app } = buildTestApp();

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Content-Type', contentType)
      .send(body);

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

describe('security headers', () => {
  it('sets a locked-down CSP and anti-sniffing, framing and referrer headers', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.headers['content-security-policy']?.split(/;\s*/)).toEqual([
      "default-src 'none'",
      "frame-ancestors 'none'",
    ]);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });

  it('only sends HSTS in production', async () => {
    const dev = await request(buildTestApp().app).get('/api/auth/me');
    const prod = await request(
      buildTestApp({ config: testConfig({ env: 'production' }) }).app,
    ).get('/api/auth/me');

    expect(dev.headers['strict-transport-security']).toBeUndefined();
    expect(prod.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });
});

describe('request limits and failure modes', () => {
  it('rejects a body over 10 KB with 413', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/register').send({ name: 'x'.repeat(11 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects malformed JSON with 400', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/login').send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers unexpected failures with a generic 500 that leaks nothing', async () => {
    const users = new InMemoryUserRepository();
    users.findByEmail = async () => {
      throw new Error('connect ECONNREFUSED postgres://app:s3cret@db:5432');
    };
    const { mutate } = buildTestApp({ users });

    const res = await mutate('post', '/api/auth/login').send(credentials);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message', 'requestId']);
    expect(JSON.stringify(res.body)).not.toMatch(/s3cret|ECONNREFUSED|at /);
  });
});
