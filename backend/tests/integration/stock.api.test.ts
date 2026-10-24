import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('stock API', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let user: { id: string; cookie: string };
  let admin: string;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    const u = await api.login('user');
    user = { id: u.user.id, cookie: u.cookie };
    admin = (await api.login('admin')).cookie;
  });

  afterAll(() => pool.end());

  async function quantityOf(id: string) {
    return (await api.vehicles.findById(id))!.quantity;
  }

  async function purchaseRows() {
    const { rows } = await pool.query('SELECT vehicle_id, user_id, quantity, unit_price FROM purchases');
    return rows;
  }

  describe('POST /api/vehicles/:id/purchase', () => {
    it('buys one unit by default and records the sale at the current price', async () => {
      const camry = await api.vehicles.create(buildVehicle({ price: 27999.5, quantity: 5 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie);

      expect(res.status).toBe(200);
      expect(res.body.vehicle).toMatchObject({ id: camry.id, quantity: 4 });
      expect(await purchaseRows()).toEqual([
        { vehicle_id: camry.id, user_id: user.id, quantity: 1, unit_price: '27999.50' },
      ]);
    });

    it('buys the requested quantity', async () => {
      const camry = await api.vehicles.create(buildVehicle({ quantity: 5 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie).send({ quantity: 3 });

      expect(res.body.vehicle.quantity).toBe(2);
    });

    it('returns 409 OUT_OF_STOCK at zero and changes nothing', async () => {
      const camry = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({ code: 'OUT_OF_STOCK', message: 'Vehicle is out of stock' });
      expect(await quantityOf(camry.id)).toBe(0);
      expect(await purchaseRows()).toEqual([]);
    });

    it('returns 409 when asking for more than is left', async () => {
      const camry = await api.vehicles.create(buildVehicle({ quantity: 2 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie).send({ quantity: 3 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Only 2 left in stock');
      expect(await quantityOf(camry.id)).toBe(2);
    });

    it('returns 404 for an unknown vehicle and 400 for a malformed id', async () => {
      expect((await api.mutate('post', `/api/vehicles/${UNKNOWN_ID}/purchase`, user.cookie)).status).toBe(404);
      expect((await api.mutate('post', '/api/vehicles/42/purchase', user.cookie)).status).toBe(400);
    });

    it.each([{ quantity: 0 }, { quantity: 11 }, { quantity: 1.5 }, { quantity: '1' }, { quantity: 1, price: 0 }])(
      'rejects the body %j',
      async (body) => {
        const camry = await api.vehicles.create(buildVehicle({ quantity: 20 }));

        const res = await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie).send(body);

        expect(res.status).toBe(400);
        expect(await quantityOf(camry.id)).toBe(20);
      },
    );

    it('requires a session', async () => {
      expect((await api.mutate('post', `/api/vehicles/${UNKNOWN_ID}/purchase`)).status).toBe(401);
    });

    it('sells the last unit exactly once under concurrent purchases', async () => {
      const lastOne = await api.vehicles.create(buildVehicle({ quantity: 1 }));

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => api.mutate('post', `/api/vehicles/${lastOne.id}/purchase`, user.cookie)),
      );

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
      expect(await quantityOf(lastOne.id)).toBe(0);
      expect(await purchaseRows()).toHaveLength(1);
    });

    it('never oversells when concurrent buyers outnumber the stock', async () => {
      const rav4 = await api.vehicles.create(buildVehicle({ quantity: 5 }));

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => api.mutate('post', `/api/vehicles/${rav4.id}/purchase`, user.cookie)),
      );

      expect(responses.filter((r) => r.status === 200)).toHaveLength(5);
      expect(await quantityOf(rav4.id)).toBe(0);
    });

    it('rolls back the stock change and the sale when a handler fails', async () => {
      const failing = buildDbApp(pool, {
        stockHandlers: [{ handle: async () => Promise.reject(new Error('alert insert failed')) }],
      });
      const { cookie } = await failing.login('user');
      const camry = await failing.vehicles.create(buildVehicle({ quantity: 5 }));

      const res = await failing.mutate('post', `/api/vehicles/${camry.id}/purchase`, cookie);

      expect(res.status).toBe(500);
      expect(await quantityOf(camry.id)).toBe(5);
      expect(await purchaseRows()).toEqual([]);
    });
  });

  describe('POST /api/vehicles/:id/restock', () => {
    it('lets an admin add stock', async () => {
      const camry = await api.vehicles.create(buildVehicle({ quantity: 0 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.vehicle.quantity).toBe(10);
    });

    it('forbids a regular user and changes nothing', async () => {
      const camry = await api.vehicles.create(buildVehicle({ quantity: 1 }));

      const res = await api.mutate('post', `/api/vehicles/${camry.id}/restock`, user.cookie).send({ quantity: 10 });

      expect(res.status).toBe(403);
      expect(await quantityOf(camry.id)).toBe(1);
    });

    it.each([{ quantity: 0 }, { quantity: -5 }, { quantity: 2.5 }, {}, { quantity: 100_001 }])(
      'rejects the body %j',
      async (body) => {
        const camry = await api.vehicles.create(buildVehicle({ quantity: 1 }));

        const res = await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send(body);

        expect(res.status).toBe(400);
      },
    );

    it('returns 404 for an unknown vehicle', async () => {
      const res = await api.mutate('post', `/api/vehicles/${UNKNOWN_ID}/restock`, admin).send({ quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Vehicle not found');
    });

    it('requires a session', async () => {
      expect((await api.mutate('post', `/api/vehicles/${UNKNOWN_ID}/restock`).send({ quantity: 1 })).status).toBe(401);
    });
  });

  it('removes a vehicle together with its sales history', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 5 }));
    await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, user.cookie);

    expect((await api.mutate('delete', `/api/vehicles/${camry.id}`, admin)).status).toBe(204);
    expect(await purchaseRows()).toEqual([]);
  });
});
