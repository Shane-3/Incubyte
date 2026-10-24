import request from 'supertest';
import { buildTestApp, testConfig } from '../helpers/test-app';

const priya = { name: 'Priya Nair', email: 'priya.nair@example.com', password: 'S3curePass!' };

function parseSetCookie(header: string | string[] | undefined): string {
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const token = cookies.find((c) => c.startsWith('token='));
  if (!token) throw new Error(`no token cookie in ${JSON.stringify(header)}`);
  return decodeURIComponent(token);
}

describe('POST /api/auth/register', () => {
  it('creates a user and returns it without the password hash', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/register').send(priya);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), name: 'Priya Nair', email: 'priya.nair@example.com', role: 'user' },
    });
    expect(JSON.stringify(res.body)).not.toContain('hash');
  });

  it('returns field-level validation errors in the standard shape', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/register').send({ ...priya, email: 'nope', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { field: 'email', message: 'must be a valid email address' },
          { field: 'password', message: 'must be at least 8 characters' },
        ],
      },
    });
  });

  it('rejects a body that tries to set its own role', async () => {
    const { mutate, users } = buildTestApp();

    const res = await mutate('post', '/api/auth/register').send({ ...priya, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(users.size()).toBe(0);
  });

  it('returns 409 EMAIL_TAKEN for a registered email', async () => {
    const { mutate } = buildTestApp();
    await mutate('post', '/api/auth/register').send(priya);

    const res = await mutate('post', '/api/auth/register').send(priya);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'EMAIL_TAKEN', message: 'Email is already registered' });
  });
});

describe('POST /api/auth/login', () => {
  it('sets an httpOnly, SameSite=Strict session cookie scoped to /api and returns the user', async () => {
    const { mutate } = buildTestApp();
    await mutate('post', '/api/auth/register').send(priya);

    const res = await mutate('post', '/api/auth/login').send({ email: priya.email, password: priya.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: priya.email, role: 'user' });
    const cookie = parseSetCookie(res.headers['set-cookie']);
    expect(cookie).toMatch(/^token=token:[\w-]+:user;/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Strict/);
    expect(cookie).toMatch(/; Path=\/api/);
    expect(cookie).toMatch(/; Max-Age=3600/);
  });

  it('never puts the token in the response body', async () => {
    const { mutate } = buildTestApp();
    await mutate('post', '/api/auth/register').send(priya);

    const res = await mutate('post', '/api/auth/login').send({ email: priya.email, password: priya.password });

    expect(JSON.stringify(res.body)).not.toContain('token');
  });

  it('marks the cookie Secure in production', async () => {
    const { mutate } = buildTestApp({ config: testConfig({ env: 'production' }) });
    await mutate('post', '/api/auth/register').send(priya);

    const res = await mutate('post', '/api/auth/login').send({ email: priya.email, password: priya.password });

    expect(parseSetCookie(res.headers['set-cookie'])).toMatch(/; Secure/);
  });

  it('answers a wrong password and an unknown email with the same 401', async () => {
    const { mutate } = buildTestApp();
    await mutate('post', '/api/auth/register').send(priya);

    const wrongPassword = await mutate('post', '/api/auth/login').send({ email: priya.email, password: 'Wrong-pass1' });
    const unknownEmail = await mutate('post', '/api/auth/login').send({
      email: 'nobody@example.com',
      password: priya.password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' } });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });

  it('returns 400 for a malformed body', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/login').send({ email: priya.email });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'password', message: expect.any(String) }]);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid session', async () => {
    const { app, sessionCookieFor } = buildTestApp();
    const { user, cookie } = sessionCookieFor('admin');

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { id: user.id, name: user.name, email: user.email, role: 'admin' } });
  });

  it('returns 401 without a session cookie', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  });

  it('returns 401 for a forged token', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=forged.jwt.value');

    expect(res.status).toBe(401);
  });

  it('returns 401 when the token belongs to a user that no longer exists', async () => {
    const { app, tokens } = buildTestApp();
    const ghost = tokens.sign({ sub: '00000000-0000-4000-8000-000000000000', role: 'user' });

    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${ghost}`);

    expect(res.status).toBe(401);
  });

  it('is never cached', async () => {
    const { app, sessionCookieFor } = buildTestApp();

    const res = await request(app).get('/api/auth/me').set('Cookie', sessionCookieFor().cookie);

    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and returns 204', async () => {
    const { mutate, sessionCookieFor } = buildTestApp();

    const res = await mutate('post', '/api/auth/logout').set('Cookie', sessionCookieFor().cookie);

    expect(res.status).toBe(204);
    const cleared = parseSetCookie(res.headers['set-cookie']);
    expect(cleared).toMatch(/^token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cleared).toMatch(/; Path=\/api/);
  });

  it('returns 401 without a session', async () => {
    const { mutate } = buildTestApp();

    const res = await mutate('post', '/api/auth/logout');

    expect(res.status).toBe(401);
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error shape', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
