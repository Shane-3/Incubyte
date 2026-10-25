import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

const NOW = new Date('2026-10-24T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('GET /api/purchases (admins)', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let admin: string;
  let buyer: { id: string; name: string; email: string; cookie: string };

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool, { clock: () => NOW });
    admin = (await api.login('admin')).cookie;
    const b = await api.login('user');
    buyer = { id: b.user.id, name: b.user.name, email: b.user.email, cookie: b.cookie };
  });

  afterAll(() => pool.end());

  async function sale(vehicleId: string, colourId: string | null, quantity: number, unitPrice: number, at: Date) {
    await pool.query(
      `INSERT INTO purchases (vehicle_id, colour_id, user_id, quantity, unit_price, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [vehicleId, colourId, buyer.id, quantity, unitPrice, at],
    );
  }

  async function camry() {
    const res = await api
      .mutate('post', '/api/vehicles', admin)
      .send({ ...buildVehicle({ price: 28400, quantity: 5 }), colour: { name: 'Supersonic Red', hex: '#a3161a' } });
    return res.body.vehicle as { id: string; colours: Array<{ id: string }> };
  }

  it('lists recent sales newest first, with the vehicle, colour, buyer and totals', async () => {
    const v = await camry();
    await sale(v.id, v.colours[0]!.id, 1, 28400, daysAgo(3));
    await sale(v.id, v.colours[0]!.id, 2, 27999.5, daysAgo(1));

    const res = await api.get('/api/purchases', admin);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      quantity: 2,
      unitPrice: 27999.5,
      total: 55999,
      createdAt: daysAgo(1).toISOString(),
      vehicle: { id: v.id, make: 'Toyota', model: 'Camry', sku: 'TOY-CAMRY', category: 'Sedan' },
      colour: { name: 'Supersonic Red', hex: '#a3161a' },
      buyer: { id: buyer.id, name: buyer.name, email: buyer.email },
    });
    expect(res.body.data[1].quantity).toBe(1);
  });

  it('summarises orders, units and revenue for the period', async () => {
    const v = await camry();
    await sale(v.id, v.colours[0]!.id, 1, 28400, daysAgo(3));
    await sale(v.id, v.colours[0]!.id, 2, 27999.5, daysAgo(1));

    const res = await api.get('/api/purchases', admin);

    expect(res.body.summary).toEqual({ orders: 2, units: 3, revenue: 84399 });
    expect(res.body.days).toBe(30);
  });

  it('keeps to the chosen period', async () => {
    const v = await camry();
    await sale(v.id, null, 1, 28400, daysAgo(3));
    await sale(v.id, null, 1, 28400, daysAgo(20));
    await sale(v.id, null, 1, 28400, daysAgo(60));
    await sale(v.id, null, 9, 28400, new Date(NOW.getTime() + 60_000)); // after "now"

    expect((await api.get('/api/purchases?days=7', admin)).body.count).toBe(1);
    expect((await api.get('/api/purchases?days=30', admin)).body.count).toBe(2);
    expect((await api.get('/api/purchases?days=90', admin)).body.summary.units).toBe(3);
  });

  it('pages through the results', async () => {
    const v = await camry();
    for (let i = 1; i <= 5; i++) await sale(v.id, null, i, 1000, daysAgo(i));

    const res = await api.get('/api/purchases?limit=2&offset=2', admin);

    expect(res.body.count).toBe(5);
    expect(res.body.data.map((p: { quantity: number }) => p.quantity)).toEqual([3, 4]);
  });

  it('shows sales whose colour is unknown or was removed', async () => {
    const v = await camry();
    await sale(v.id, null, 1, 28400, daysAgo(1));

    const res = await api.get('/api/purchases', admin);

    expect(res.body.data[0].colour).toBeNull();
  });

  it('includes purchases made through the app', async () => {
    const v = await camry();
    const live = buildDbApp(pool);
    await live.mutate('post', `/api/vehicles/${v.id}/purchase`, buyer.cookie).send({ quantity: 2 });

    const res = await live.get('/api/purchases', admin);

    expect(res.body.data[0]).toMatchObject({ quantity: 2, buyer: { id: buyer.id }, colour: { name: 'Supersonic Red' } });
  });

  it.each([
    ['days', 'days=14'],
    ['limit', 'limit=1000'],
    ['offset', 'offset=-1'],
  ])('rejects a bad %s', async (_field, query) => {
    expect((await api.get(`/api/purchases?${query}`, admin)).status).toBe(400);
  });

  it('is for admins only', async () => {
    expect((await api.get('/api/purchases', buyer.cookie)).status).toBe(403);
    expect((await api.get('/api/purchases')).status).toBe(401);
  });

  it('is never cached', async () => {
    const res = await api.get('/api/purchases', admin);

    expect(res.headers['cache-control']).toBe('no-store');
  });
});
