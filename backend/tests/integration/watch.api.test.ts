import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';
import { testConfig } from '../helpers/test-app';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('watch API', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let user: { id: string; cookie: string };

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    const u = await api.login('user');
    user = { id: u.user.id, cookie: u.cookie };
  });

  afterAll(() => pool.end());

  async function watchRows() {
    const { rows } = await pool.query('SELECT user_id, vehicle_id FROM watches');
    return rows;
  }

  const watch = (id: string, cookie = user.cookie, app = api) =>
    app.mutate('post', `/api/vehicles/${id}/watch`, cookie);

  describe('POST /api/vehicles/:id/watch', () => {
    it('watches an out-of-stock vehicle', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      const res = await watch(soldOut.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ watching: true });
      expect(await watchRows()).toEqual([{ user_id: user.id, vehicle_id: soldOut.id }]);
    });

    it('returns 409 IN_STOCK for a vehicle with stock', async () => {
      const inStock = await api.vehicles.create(buildVehicle({ quantity: 2 }));

      const res = await watch(inStock.id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('IN_STOCK');
      expect(await watchRows()).toEqual([]);
    });

    it('is idempotent', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      await watch(soldOut.id);
      const again = await watch(soldOut.id);

      expect(again.status).toBe(200);
      expect(await watchRows()).toHaveLength(1);
    });

    it('rejects the 51st watch', async () => {
      const vehicles = await Promise.all(
        Array.from({ length: 51 }, (_, i) => api.vehicles.create(buildVehicle({ model: `Model ${i}`, quantity: 0 }))),
      );
      for (const v of vehicles.slice(0, 50)) {
        expect((await watch(v.id)).status).toBe(200);
      }

      const res = await watch(vehicles[50]!.id);

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({ code: 'WATCH_LIMIT_REACHED', message: 'You can watch at most 50 vehicles' });
    });

    it('holds the cap under concurrent requests', async () => {
      const capped = buildDbApp(pool, { config: testConfig({ maxWatchesPerUser: 3 }) });
      const { cookie } = await capped.login('user');
      const vehicles = await Promise.all(
        Array.from({ length: 6 }, (_, i) => capped.vehicles.create(buildVehicle({ model: `Model ${i}`, quantity: 0 }))),
      );

      const responses = await Promise.all(vehicles.map((v) => watch(v.id, cookie, capped)));

      expect(responses.filter((r) => r.status === 200)).toHaveLength(3);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(3);
    });

    it('rejects client-supplied fields such as another user id', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      const res = await watch(soldOut.id).send({ userId: UNKNOWN_ID });

      expect(res.status).toBe(400);
      expect(await watchRows()).toEqual([]);
    });

    it('returns 404 for an unknown vehicle, 400 for a malformed id and 401 without a session', async () => {
      expect((await watch(UNKNOWN_ID)).status).toBe(404);
      expect((await watch('nope')).status).toBe(400);
      expect((await api.mutate('post', `/api/vehicles/${UNKNOWN_ID}/watch`)).status).toBe(401);
    });
  });

  describe('DELETE /api/vehicles/:id/watch', () => {
    it('stops watching', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));
      await watch(soldOut.id);

      const res = await api.mutate('delete', `/api/vehicles/${soldOut.id}/watch`, user.cookie);

      expect(res.status).toBe(204);
      expect(await watchRows()).toEqual([]);
    });

    it('returns 204 when the user was not watching', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      expect((await api.mutate('delete', `/api/vehicles/${soldOut.id}/watch`, user.cookie)).status).toBe(204);
    });

    it('only removes the caller’s own watch', async () => {
      const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));
      const other = await api.login('user');
      await watch(soldOut.id, other.cookie);

      await api.mutate('delete', `/api/vehicles/${soldOut.id}/watch`, user.cookie);

      expect(await watchRows()).toEqual([{ user_id: other.user.id, vehicle_id: soldOut.id }]);
    });

    it('returns 404 for an unknown vehicle and 401 without a session', async () => {
      const unknown = await api.mutate('delete', `/api/vehicles/${UNKNOWN_ID}/watch`, user.cookie);
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.message).toBe('Vehicle not found');
      expect((await api.mutate('delete', `/api/vehicles/${UNKNOWN_ID}/watch`)).status).toBe(401);
    });
  });

  it('drops watches when the vehicle is deleted', async () => {
    const soldOut = await api.vehicles.create(buildVehicle({ quantity: 0 }));
    await watch(soldOut.id);
    const admin = await api.login('admin');

    await api.mutate('delete', `/api/vehicles/${soldOut.id}`, admin.cookie);

    expect(await watchRows()).toEqual([]);
  });
});
