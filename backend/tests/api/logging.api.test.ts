import request from 'supertest';
import type { LogEntry, Logger } from '../../src/logging/logger';
import { InMemoryUserRepository } from '../helpers/fakes';
import { buildTestApp } from '../helpers/test-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class RecordingLogger implements Logger {
  readonly entries: Array<LogEntry & { level: string }> = [];
  info(entry: LogEntry) {
    this.entries.push({ level: 'info', ...entry });
  }
  warn(entry: LogEntry) {
    this.entries.push({ level: 'warn', ...entry });
  }
  error(entry: LogEntry) {
    this.entries.push({ level: 'error', ...entry });
  }
  text() {
    return JSON.stringify(this.entries);
  }
}

function setup(overrides = {}) {
  const logger = new RecordingLogger();
  return { logger, ...buildTestApp({ logger, ...overrides }) };
}

describe('request logging', () => {
  it('tags every response with a request id', async () => {
    const { app, sessionCookieFor } = setup();

    const ok = await request(app).get('/api/auth/me').set('Cookie', sessionCookieFor().cookie);
    const missing = await request(app).get('/api/nowhere');

    expect(ok.headers['x-request-id']).toMatch(UUID);
    expect(missing.headers['x-request-id']).toMatch(UUID);
    expect(ok.headers['x-request-id']).not.toBe(missing.headers['x-request-id']);
  });

  it('ignores a client-supplied request id', async () => {
    const { app } = setup();

    const res = await request(app).get('/api/auth/me').set('X-Request-Id', 'forged-by-client');

    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.headers['x-request-id']).not.toBe('forged-by-client');
  });

  it('logs successful requests at info with method, path, status, duration and user', async () => {
    const { app, logger, sessionCookieFor } = setup();
    const { user, cookie } = sessionCookieFor();

    const res = await request(app).get('/api/auth/me?debug=1').set('Cookie', cookie);

    expect(logger.entries).toEqual([
      {
        level: 'info',
        msg: 'request',
        requestId: res.headers['x-request-id'],
        method: 'GET',
        path: '/api/auth/me',
        status: 200,
        durationMs: expect.any(Number),
        userId: user.id,
      },
    ]);
  });

  it('logs failed logins and other 401s and 403s as warnings', async () => {
    const { mutate, logger, sessionCookieFor } = setup();

    await mutate('post', '/api/auth/login').send({ email: 'priya@example.com', password: 'S3curePass!' });
    await mutate('delete', '/api/vehicles/00000000-0000-4000-8000-000000000000').set(
      'Cookie',
      sessionCookieFor('user').cookie,
    );

    expect(logger.entries.map((e) => [e.level, e.status])).toEqual([
      ['warn', 401],
      ['warn', 403],
    ]);
  });

  it('never writes passwords, emails, cookies or tokens to the log', async () => {
    const { mutate, logger, sessionCookieFor, app } = setup();
    const { cookie } = sessionCookieFor();

    await mutate('post', '/api/auth/register').send({ name: 'Priya Nair', email: 'priya@example.com', password: 'S3curePass!' });
    await mutate('post', '/api/auth/login').send({ email: 'priya@example.com', password: 'S3curePass!' });
    await request(app).get('/api/auth/me').set('Cookie', cookie).set('Authorization', 'Bearer secret-bearer');

    const text = logger.text();
    expect(text).not.toContain('S3curePass!');
    expect(text).not.toContain('priya@example.com');
    expect(text).not.toContain(cookie.split('=')[1]!);
    expect(text).not.toContain('secret-bearer');
  });

  it('returns only a request id for unexpected errors and logs the cause against it', async () => {
    const users = new InMemoryUserRepository();
    users.findByEmail = async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
    };
    const { mutate, logger } = setup({ users });

    const res = await mutate('post', '/api/auth/login').send({ email: 'priya@example.com', password: 'S3curePass!' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: res.headers['x-request-id'] },
    });
    const failure = logger.entries.find((e) => e.level === 'error');
    expect(failure).toMatchObject({
      msg: 'unhandled error',
      requestId: res.headers['x-request-id'],
      error: expect.stringContaining('ECONNREFUSED'),
    });
  });
});
