import type { Pool } from 'pg';
import { DEFAULT_RATE_LIMITS } from '../../src/middleware/rate-limit';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

describe('rate limits on abuse-prone endpoints', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(() => resetDb(pool));

  afterAll(() => pool.end());

  it('allows 30 watch requests a minute', async () => {
    const api = buildDbApp(pool, { rateLimits: DEFAULT_RATE_LIMITS });
    const { cookie } = await api.login('user');
    const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await api.mutate('post', `/api/vehicles/${soldOut.id}/watch`, cookie)).status);
    }

    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('allows 30 mark-all-read requests a minute', async () => {
    const api = buildDbApp(pool, { rateLimits: DEFAULT_RATE_LIMITS });
    const { cookie } = await api.login('user');

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push((await api.mutate('post', '/api/notifications/read-all', cookie)).status);
    }

    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
