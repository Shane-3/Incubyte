import request from 'supertest';
import { createApp, type AppDeps } from '../../src/app';
import type { Role } from '../../src/types/user';
import { FakePasswordHasher, FakeTokenService, InMemoryUserRepository } from './fakes';

export const FRONTEND_ORIGIN = 'http://localhost:5173';

export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  const users = new InMemoryUserRepository();
  const tokens = new FakeTokenService();
  const deps: AppDeps = {
    users,
    hasher: new FakePasswordHasher(),
    tokens,
    config: { env: 'test', corsOrigin: FRONTEND_ORIGIN, jwtExpiresInSeconds: 3600 },
    ...overrides,
  };
  const app = createApp(deps);

  /** Session cookie for a seeded user, as the browser would send it. */
  function sessionCookieFor(role: Role = 'user') {
    const user = users.seed({ email: `${role}-${users.size()}@example.com`, role });
    return { user, cookie: `token=${tokens.sign({ sub: user.id, role })}` };
  }

  /** A same-origin JSON mutation, the only kind the API accepts from browsers. */
  function mutate(method: 'post' | 'put' | 'delete', path: string) {
    return request(app)[method](path).set('Origin', FRONTEND_ORIGIN).set('Content-Type', 'application/json');
  }

  return { app, users, tokens, deps, sessionCookieFor, mutate };
}
