import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle, LOT } from '../helpers/factories';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('vehicles API', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let user: string;
  let admin: string;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    user = (await api.login('user')).cookie;
    admin = (await api.login('admin')).cookie;
  });

  afterAll(() => pool.end());

  async function seedLot() {
    return Promise.all(LOT.map((v) => api.vehicles.create(v)));
  }

  describe('POST /api/vehicles', () => {
    it('lets any signed-in user add a vehicle', async () => {
      const res = await api.mutate('post', '/api/vehicles', user).send({ ...buildVehicle(), category: 'suv' });

      expect(res.status).toBe(201);
      expect(res.body.vehicle).toEqual({
        id: expect.any(String),
        make: 'Toyota',
        model: 'Camry',
        category: 'SUV',
        price: 27999,
        quantity: 5,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(await api.vehicles.findById(res.body.vehicle.id)).not.toBeNull();
    });

    it('returns field-level errors for an invalid vehicle', async () => {
      const res = await api.mutate('post', '/api/vehicles', user).send(buildVehicle({ price: -1, quantity: -2 }));

      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['price', 'quantity']);
    });

    it('rejects markup in the make with 400 and stores nothing', async () => {
      const res = await api
        .mutate('post', '/api/vehicles', user)
        .send(buildVehicle({ make: '<script>alert(1)</script>' }));

      expect(res.status).toBe(400);
      expect((await api.vehicles.search({}, { sort: 'make', order: 'asc', limit: 25, offset: 0 })).count).toBe(0);
    });

    it('rejects a client-supplied id', async () => {
      const res = await api.mutate('post', '/api/vehicles', user).send({ ...buildVehicle(), id: UNKNOWN_ID });

      expect(res.status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await api.mutate('post', '/api/vehicles').send(buildVehicle())).status).toBe(401);
    });
  });

  describe('GET /api/vehicles', () => {
    it('lists vehicles sorted by make with a total count', async () => {
      await seedLot();

      const res = await api.get('/api/vehicles', user);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(6);
      expect(res.body.data.map((v: { make: string }) => v.make)).toEqual([
        'Ford',
        'Honda',
        'Tesla',
        'Toyota',
        'Toyota',
        'Toyota',
      ]);
    });

    it('returns an empty list when there is no stock', async () => {
      const res = await api.get('/api/vehicles', user);

      expect(res.body).toEqual({ data: [], count: 0 });
    });

    it('supports sorting and pagination', async () => {
      await seedLot();

      const res = await api.get('/api/vehicles?sort=price&order=desc&limit=2&offset=1', user);

      expect(res.body.count).toBe(6);
      expect(res.body.data.map((v: { model: string }) => v.model)).toEqual(['F-150', 'RAV4']);
    });

    it('rejects a page size over 100', async () => {
      expect((await api.get('/api/vehicles?limit=100000', user)).status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await api.get('/api/vehicles')).status).toBe(401);
    });
  });

  describe('GET /api/vehicles/search', () => {
    it('returns only Toyotas priced 10,000 to 30,000', async () => {
      await seedLot();

      const res = await api.get('/api/vehicles/search?make=Toyota&minPrice=10000&maxPrice=30000&sort=price', user);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.data.map((v: { model: string }) => v.model)).toEqual(['Corolla', 'Camry']);
    });

    it('filters by model and category', async () => {
      await seedLot();

      const res = await api.get('/api/vehicles/search?model=f-1&category=truck', user);

      expect(res.body.data.map((v: { model: string }) => v.model)).toEqual(['F-150']);
    });

    it('rejects a minimum price above the maximum', async () => {
      const res = await api.get('/api/vehicles/search?minPrice=30000&maxPrice=10000', user);

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'minPrice', message: 'must not be greater than maxPrice' }]);
    });

    it('rejects an unknown sort column', async () => {
      expect((await api.get('/api/vehicles/search?sort=password_hash', user)).status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await api.get('/api/vehicles/search?make=Toyota')).status).toBe(401);
    });
  });

  describe('PUT /api/vehicles/:id', () => {
    it('updates the given fields', async () => {
      const [camry] = await seedLot();

      const res = await api.mutate('put', `/api/vehicles/${camry!.id}`, user).send({ price: 26999.5 });

      expect(res.status).toBe(200);
      expect(res.body.vehicle).toMatchObject({ id: camry!.id, model: 'Camry', price: 26999.5 });
    });

    it('returns 404 for an unknown vehicle', async () => {
      const res = await api.mutate('put', `/api/vehicles/${UNKNOWN_ID}`, user).send({ price: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Vehicle not found' });
    });

    it('returns 400 for a malformed id', async () => {
      const res = await api.mutate('put', `/api/vehicles/not-a-uuid`, user).send({ price: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'id', message: 'must be a valid id' }]);
    });

    it('validates the changes', async () => {
      const [camry] = await seedLot();

      const res = await api.mutate('put', `/api/vehicles/${camry!.id}`, user).send({ quantity: 1.5 });

      expect(res.status).toBe(400);
    });

    it('requires a session', async () => {
      expect((await api.mutate('put', `/api/vehicles/${UNKNOWN_ID}`).send({ price: 1 })).status).toBe(401);
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    it('lets an admin delete a vehicle', async () => {
      const [camry] = await seedLot();

      const res = await api.mutate('delete', `/api/vehicles/${camry!.id}`, admin);

      expect(res.status).toBe(204);
      expect(await api.vehicles.findById(camry!.id)).toBeNull();
    });

    it('forbids a regular user and keeps the vehicle', async () => {
      const [camry] = await seedLot();

      const res = await api.mutate('delete', `/api/vehicles/${camry!.id}`, user);

      expect(res.status).toBe(403);
      expect(await api.vehicles.findById(camry!.id)).not.toBeNull();
    });

    it('returns 404 for an unknown vehicle', async () => {
      const res = await api.mutate('delete', `/api/vehicles/${UNKNOWN_ID}`, admin);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Vehicle not found');
    });

    it('requires a session', async () => {
      expect((await api.mutate('delete', `/api/vehicles/${UNKNOWN_ID}`)).status).toBe(401);
    });
  });
});
