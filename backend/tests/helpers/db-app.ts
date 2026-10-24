import type { Pool } from 'pg';
import request from 'supertest';
import { type AppDeps, createApp } from '../../src/app';
import { PgTransactionRunner } from '../../src/db/transaction';
import { UNLIMITED } from '../../src/middleware/rate-limit';
import { PgNotificationRepository } from '../../src/repositories/pg-notification.repository';
import { PgSalesRepository } from '../../src/repositories/pg-sales.repository';
import { PgStockRepository } from '../../src/repositories/pg-stock.repository';
import { PgUserRepository } from '../../src/repositories/pg-user.repository';
import { PgWatchRepository } from '../../src/repositories/pg-watch.repository';
import { PgVehicleRepository } from '../../src/repositories/pg-vehicle.repository';
import type { Role } from '../../src/types/user';
import { FakePasswordHasher, FakeTokenService } from './fakes';
import { FRONTEND_ORIGIN, testConfig } from './test-app';

/** The real app on the test database. Only hashing and token signing are faked, for speed and readability. */
export function buildDbApp(pool: Pool, overrides: Partial<AppDeps> = {}) {
  const users = new PgUserRepository(pool);
  const vehicles = new PgVehicleRepository(pool, 3);
  const tokens = new FakeTokenService();
  const app = createApp({
    users,
    vehicles,
    stock: new PgStockRepository(),
    transactions: new PgTransactionRunner(pool),
    notifications: new PgNotificationRepository(pool),
    sales: new PgSalesRepository(pool),
    watches: new PgWatchRepository(),
    hasher: new FakePasswordHasher(),
    tokens,
    config: testConfig(),
    rateLimits: UNLIMITED,
    ...overrides,
  });

  let counter = 0;
  async function login(role: Role = 'user') {
    counter += 1;
    const user = await users.create({
      name: role === 'admin' ? 'Dana Okafor' : 'Priya Nair',
      email: `${role}${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      passwordHash: 'hashed:Passw0rd!',
      role,
    });
    return { user, cookie: `token=${tokens.sign({ sub: user.id, role })}` };
  }

  function mutate(method: 'post' | 'put' | 'delete', path: string, cookie?: string) {
    const req = request(app)[method](path).set('Origin', FRONTEND_ORIGIN).set('Content-Type', 'application/json');
    return cookie ? req.set('Cookie', cookie) : req;
  }

  function get(path: string, cookie?: string) {
    const req = request(app).get(path);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  return { app, users, vehicles, login, mutate, get };
}
