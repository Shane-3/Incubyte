import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

type Role = 'anon' | 'user' | 'admin';
type Method = 'get' | 'post' | 'put' | 'delete';

interface Context {
  vehicleId: string;
  notificationId: string;
}

interface Row {
  endpoint: string;
  method: Method;
  path: (ctx: Context) => string;
  body?: object;
  /** Out-of-stock vehicle, for watch endpoints. */
  soldOut?: boolean;
  expected: Record<Role, number>;
}

// security.md section 11.1: every endpoint against every kind of caller.
const MATRIX: Row[] = [
  {
    endpoint: 'GET /api/auth/me',
    method: 'get',
    path: () => '/api/auth/me',
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'POST /api/auth/logout',
    method: 'post',
    path: () => '/api/auth/logout',
    expected: { anon: 401, user: 204, admin: 204 },
  },
  {
    endpoint: 'GET /api/vehicles',
    method: 'get',
    path: () => '/api/vehicles',
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'GET /api/vehicles/search',
    method: 'get',
    path: () => '/api/vehicles/search?make=Toyota',
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'POST /api/vehicles',
    method: 'post',
    path: () => '/api/vehicles',
    body: buildVehicle(),
    expected: { anon: 401, user: 201, admin: 201 },
  },
  {
    endpoint: 'PUT /api/vehicles/:id',
    method: 'put',
    path: (c) => `/api/vehicles/${c.vehicleId}`,
    body: { price: 1 },
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'POST /api/vehicles/:id/purchase',
    method: 'post',
    path: (c) => `/api/vehicles/${c.vehicleId}/purchase`,
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'DELETE /api/vehicles/:id',
    method: 'delete',
    path: (c) => `/api/vehicles/${c.vehicleId}`,
    expected: { anon: 401, user: 403, admin: 204 },
  },
  {
    endpoint: 'POST /api/vehicles/:id/restock',
    method: 'post',
    path: (c) => `/api/vehicles/${c.vehicleId}/restock`,
    body: { quantity: 1 },
    expected: { anon: 401, user: 403, admin: 200 },
  },
  {
    endpoint: 'GET /api/vehicles/forecast',
    method: 'get',
    path: () => '/api/vehicles/forecast',
    expected: { anon: 401, user: 403, admin: 200 },
  },
  {
    endpoint: 'POST /api/vehicles/:id/watch',
    method: 'post',
    path: (c) => `/api/vehicles/${c.vehicleId}/watch`,
    soldOut: true,
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'DELETE /api/vehicles/:id/watch',
    method: 'delete',
    path: (c) => `/api/vehicles/${c.vehicleId}/watch`,
    soldOut: true,
    expected: { anon: 401, user: 204, admin: 204 },
  },
  {
    endpoint: 'GET /api/notifications',
    method: 'get',
    path: () => '/api/notifications',
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'POST /api/notifications/:id/read',
    method: 'post',
    path: (c) => `/api/notifications/${c.notificationId}/read`,
    expected: { anon: 401, user: 200, admin: 200 },
  },
  {
    endpoint: 'POST /api/notifications/read-all',
    method: 'post',
    path: () => '/api/notifications/read-all',
    expected: { anon: 401, user: 200, admin: 200 },
  },
];

const CASES = MATRIX.flatMap((row) =>
  (['anon', 'user', 'admin'] as const).map((role) => ({ ...row, role, status: row.expected[role] })),
);

describe('authorization matrix', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  afterAll(() => pool.end());

  it.each(CASES)('$endpoint as $role → $status', async ({ method, path, body, soldOut, role, status }) => {
    await resetDb(pool);
    const api = buildDbApp(pool);
    const vehicle = await api.vehicles.create(buildVehicle({ quantity: soldOut ? 0 : 5 }));
    const session = role === 'anon' ? undefined : await api.login(role);
    const owner = session?.user.id ?? (await api.login('user')).user.id;
    const { rows } = await pool.query(
      `INSERT INTO notifications (recipient_id, type, vehicle_id, quantity) VALUES ($1, 'BACK_IN_STOCK', $2, 1) RETURNING id`,
      [owner, vehicle.id],
    );
    const url = path({ vehicleId: vehicle.id, notificationId: rows[0].id });

    const req = method === 'get' ? api.get(url, session?.cookie) : api.mutate(method, url, session?.cookie);
    const res = body ? await req.send(body) : await req;

    expect(res.status).toBe(status);
  });
});
