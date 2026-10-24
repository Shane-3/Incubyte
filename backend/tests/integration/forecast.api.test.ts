import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

const NOW = new Date('2026-10-24T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('GET /api/vehicles/forecast', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let admin: { id: string; cookie: string };
  let user: string;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool, { clock: () => NOW });
    const a = await api.login('admin');
    admin = { id: a.user.id, cookie: a.cookie };
    user = (await api.login('user')).cookie;
  });

  afterAll(() => pool.end());

  async function sold(vehicleId: string, quantity: number, at: Date) {
    await pool.query(
      'INSERT INTO purchases (vehicle_id, user_id, quantity, unit_price, created_at) VALUES ($1, $2, $3, 1000, $4)',
      [vehicleId, admin.id, quantity, at],
    );
  }

  it('forecasts every vehicle from the last 30 days of sales', async () => {
    const camry = await api.vehicles.create(buildVehicle({ model: 'Camry', quantity: 2 }));
    const corolla = await api.vehicles.create(buildVehicle({ model: 'Corolla', quantity: 5 }));
    const rav4 = await api.vehicles.create(buildVehicle({ model: 'RAV4', quantity: 10 }));
    await sold(camry.id, 20, daysAgo(5));
    await sold(camry.id, 4, daysAgo(29.9));
    await sold(rav4.id, 6, daysAgo(10));
    await sold(rav4.id, 50, daysAgo(31)); // outside the window
    await sold(rav4.id, 9, new Date(NOW.getTime() + 60_000)); // after "now": ignored

    const res = await api.get('/api/vehicles/forecast', admin.cookie);

    expect(res.status).toBe(200);
    expect(res.body.windowDays).toBe(30);
    expect(res.body.atRiskDays).toBe(7);
    const byId = Object.fromEntries(res.body.data.map((f: { vehicleId: string }) => [f.vehicleId, f]));
    expect(Object.keys(byId)).toHaveLength(3);
    expect(byId[camry.id]).toEqual({
      vehicleId: camry.id,
      avgDailySales: 0.8,
      daysOfStockLeft: 2.5,
      atRisk: true,
      suggestedRestock: 22,
    });
    expect(byId[corolla.id]).toMatchObject({ daysOfStockLeft: null, atRisk: false, suggestedRestock: 0 });
    expect(byId[rav4.id]).toMatchObject({ avgDailySales: 0.2, daysOfStockLeft: 50, atRisk: false });
  });

  it('counts sales made through the purchase endpoint', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 5 }));
    await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user).send({ quantity: 3 });

    const realClock = buildDbApp(pool);
    const res = await realClock.get('/api/vehicles/forecast', admin.cookie);

    expect(res.body.data[0]).toMatchObject({ vehicleId: camry.id, avgDailySales: 0.1, daysOfStockLeft: 20 });
  });

  it('is admin-only, so regular users never see sales data', async () => {
    expect((await api.get('/api/vehicles/forecast', user)).status).toBe(403);
    expect((await api.get('/api/vehicles/forecast')).status).toBe(401);
  });

  it('keeps sales and forecast fields out of list and search responses', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 2 }));
    await sold(camry.id, 24, daysAgo(5));

    for (const path of ['/api/vehicles', '/api/vehicles/search?make=Toyota']) {
      const res = await api.get(path, user);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ['category', 'createdAt', 'id', 'isWatching', 'make', 'model', 'price', 'quantity', 'updatedAt'].sort(),
      );
    }
  });
});
