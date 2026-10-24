import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

const RED = { name: 'Supersonic Red', hex: '#a3161a' };
const WHITE = { name: 'Wind Chill Pearl', hex: '#edede8' };

interface ColourBody {
  id: string;
  name: string;
  hex: string;
  quantity: number;
}

describe('colour variants', () => {
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

  const add = (body: object, cookie = user) => api.mutate('post', '/api/vehicles', cookie).send(body);

  async function camryInRedAndWhite(red = 1, white = 4) {
    const created = await add({ ...buildVehicle({ quantity: red }), colour: RED });
    await add({ ...buildVehicle({ quantity: white }), colour: WHITE });
    const vehicle = await api.vehicles.findById(created.body.vehicle.id);
    const colourId = (name: string) => vehicle!.colours.find((c) => c.name === name)!.id;
    return { id: vehicle!.id, redId: colourId(RED.name), whiteId: colourId(WHITE.name) };
  }

  async function totalsAgree() {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS mismatches FROM vehicles v
       WHERE v.quantity <> (SELECT COALESCE(sum(c.quantity), 0) FROM vehicle_colours c WHERE c.vehicle_id = v.id)`,
    );
    return rows[0].mismatches === 0;
  }

  describe('adding vehicles', () => {
    it('creates a model with its SKU and first colour', async () => {
      const res = await add({ ...buildVehicle({ quantity: 2 }), colour: RED });

      expect(res.status).toBe(201);
      expect(res.body.merged).toBe(false);
      expect(res.body.vehicle).toMatchObject({
        sku: 'TOY-CAMRY',
        quantity: 2,
        colours: [{ id: expect.any(String), ...RED, quantity: 2 }],
      });
    });

    it('adds a new colour to an existing model instead of creating a second one', async () => {
      await add({ ...buildVehicle({ quantity: 2 }), colour: RED });

      const res = await add({ ...buildVehicle({ make: 'toyota', model: 'CAMRY', quantity: 3 }), colour: WHITE });

      expect(res.status).toBe(200);
      expect(res.body.merged).toBe(true);
      expect(res.body.vehicle.quantity).toBe(5);
      expect(res.body.vehicle.colours.map((c: ColourBody) => [c.name, c.quantity])).toEqual([
        [RED.name, 2],
        [WHITE.name, 3],
      ]);
      expect((await api.get('/api/vehicles', user)).body.count).toBe(1);
    });

    it('adds units to a colour the model already has', async () => {
      await add({ ...buildVehicle({ quantity: 2 }), colour: RED });

      const res = await add({ ...buildVehicle({ quantity: 3 }), colour: { ...RED, name: 'supersonic red' } });

      expect(res.body.vehicle.colours).toEqual([{ id: expect.any(String), ...RED, quantity: 5 }]);
    });

    it.each([
      ['price', { price: 1 }, 'is $27,999 for this model'],
      ['category', { category: 'SUV' }, 'is Sedan for this model'],
    ])('refuses a different %s for an existing model and changes nothing', async (field, change, message) => {
      await add({ ...buildVehicle({ quantity: 2 }), colour: RED });

      const res = await add({ ...buildVehicle({ quantity: 3 }), ...change, colour: WHITE });

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'MODEL_EXISTS',
        message: 'Toyota Camry is already listed. Edit the model to change its price or category.',
        details: [{ field, message }],
      });
      const [only] = (await api.get('/api/vehicles', user)).body.data;
      expect(only.colours).toHaveLength(1);
      expect(only.quantity).toBe(2);
    });

    it('tells watchers when an added colour brings a sold-out model back', async () => {
      const created = await add({ ...buildVehicle({ quantity: 0 }), colour: RED });
      const watcher = await api.login('user');
      await api.mutate('post', `/api/vehicles/${created.body.vehicle.id}/watch`, watcher.cookie);

      await add({ ...buildVehicle({ quantity: 2 }), colour: WHITE });

      const { rows } = await pool.query(`SELECT recipient_id FROM notifications WHERE type = 'BACK_IN_STOCK'`);
      expect(rows).toEqual([{ recipient_id: watcher.user.id }]);
    });

    it('creates a model with several colours in one request', async () => {
      const res = await add({
        ...buildVehicle({ quantity: 5 }),
        colours: [
          { ...RED, quantity: 2 },
          { ...WHITE, quantity: 3 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.vehicle.quantity).toBe(5);
      expect(res.body.vehicle.colours.map((c: ColourBody) => [c.name, c.quantity])).toEqual([
        [RED.name, 2],
        [WHITE.name, 3],
      ]);
      expect(await totalsAgree()).toBe(true);
    });

    it('merges several colours into an existing model as one change, notifying watchers once', async () => {
      const created = await add({ ...buildVehicle({ quantity: 0 }), colour: RED });
      const watcher = await api.login('user');
      await api.mutate('post', `/api/vehicles/${created.body.vehicle.id}/watch`, watcher.cookie);

      const res = await add({
        ...buildVehicle({ quantity: 6 }),
        colours: [
          { ...RED, quantity: 1 },
          { ...WHITE, quantity: 2 },
          { name: 'Blueprint', hex: '#1f3a5f', quantity: 3 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.merged).toBe(true);
      expect(res.body.vehicle.colours.map((c: ColourBody) => [c.name, c.quantity])).toEqual([
        [RED.name, 1],
        [WHITE.name, 2],
        ['Blueprint', 3],
      ]);
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'BACK_IN_STOCK'`);
      expect(rows[0].n).toBe(1);
      expect(await totalsAgree()).toBe(true);
    });

    it('rejects a quantity that is not the total of the colours', async () => {
      const res = await add({ ...buildVehicle({ quantity: 9 }), colours: [{ ...RED, quantity: 2 }] });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { field: 'quantity', message: 'must equal the total of the colours (2)' },
      ]);
    });

    it('ends with one model when the same new model is added twice at once', async () => {
      const [a, b] = await Promise.all([
        add({ ...buildVehicle({ quantity: 1 }), colour: RED }),
        add({ ...buildVehicle({ quantity: 2 }), colour: WHITE }),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      const list = (await api.get('/api/vehicles', user)).body;
      expect(list.count).toBe(1);
      expect(list.data[0].quantity).toBe(3);
      expect(await totalsAgree()).toBe(true);
    });
  });

  describe('purchasing by colour', () => {
    it('sells from the chosen colour and records it', async () => {
      const { id, whiteId } = await camryInRedAndWhite();

      const res = await api
        .mutate('post', `/api/vehicles/${id}/purchase`, user)
        .send({ quantity: 2, colourId: whiteId });

      expect(res.status).toBe(200);
      expect(res.body.vehicle.quantity).toBe(3);
      expect(res.body.vehicle.colours.find((c: ColourBody) => c.id === whiteId).quantity).toBe(2);
      const { rows } = await pool.query('SELECT colour_id, quantity FROM purchases');
      expect(rows).toEqual([{ colour_id: whiteId, quantity: 2 }]);
    });

    it('names the colour when it is short', async () => {
      const { id, redId } = await camryInRedAndWhite(1, 4);

      const res = await api.mutate('post', `/api/vehicles/${id}/purchase`, user).send({ quantity: 2, colourId: redId });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Only 1 left in Supersonic Red');
    });

    it('sells from the best-stocked colour when none is chosen', async () => {
      const { id, whiteId } = await camryInRedAndWhite(1, 4);

      await api.mutate('post', `/api/vehicles/${id}/purchase`, user);

      const { rows } = await pool.query('SELECT colour_id FROM purchases');
      expect(rows).toEqual([{ colour_id: whiteId }]);
    });

    it('rejects a colour of another vehicle', async () => {
      const { id } = await camryInRedAndWhite();
      const other = await add({ ...buildVehicle({ make: 'Honda', model: 'Civic', quantity: 3 }), colour: RED });

      const res = await api
        .mutate('post', `/api/vehicles/${id}/purchase`, user)
        .send({ colourId: other.body.vehicle.colours[0].id });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'colourId', message: 'is not a colour of this vehicle' }]);
    });

    it('never oversells across colours under concurrent purchases, and totals stay in step', async () => {
      const { id } = await camryInRedAndWhite(1, 1);

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => api.mutate('post', `/api/vehicles/${id}/purchase`, user)),
      );

      expect(responses.filter((r) => r.status === 200)).toHaveLength(2);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(4);
      const vehicle = await api.vehicles.findById(id);
      expect(vehicle!.quantity).toBe(0);
      expect(vehicle!.colours.map((c) => c.quantity)).toEqual([0, 0]);
      expect(await totalsAgree()).toBe(true);
    });
  });

  describe('restocking and editing by colour', () => {
    it('restocks the chosen colour', async () => {
      const { id, redId } = await camryInRedAndWhite(1, 4);

      const res = await api.mutate('post', `/api/vehicles/${id}/restock`, admin).send({ quantity: 5, colourId: redId });

      expect(res.status).toBe(200);
      expect(res.body.vehicle.quantity).toBe(10);
      expect(res.body.vehicle.colours.find((c: ColourBody) => c.id === redId).quantity).toBe(6);
    });

    it('restocks several colours in one request, notifying watchers once', async () => {
      const created = await add({
        ...buildVehicle({ quantity: 0 }),
        colours: [
          { ...RED, quantity: 0 },
          { ...WHITE, quantity: 0 },
        ],
      });
      const [red, white] = created.body.vehicle.colours as ColourBody[];
      const watcher = await api.login('user');
      await api.mutate('post', `/api/vehicles/${created.body.vehicle.id}/watch`, watcher.cookie);

      const res = await api.mutate('post', `/api/vehicles/${created.body.vehicle.id}/restock`, admin).send({
        quantity: 7,
        colours: [
          { colourId: red!.id, quantity: 4 },
          { colourId: white!.id, quantity: 3 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.vehicle.quantity).toBe(7);
      expect(res.body.vehicle.colours.map((c: ColourBody) => c.quantity)).toEqual([4, 3]);
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM notifications WHERE type = 'BACK_IN_STOCK'`);
      expect(rows[0].n).toBe(1);
      expect(await totalsAgree()).toBe(true);
    });

    it('refuses a restock naming a colour of another vehicle and changes nothing', async () => {
      const { id, redId } = await camryInRedAndWhite(1, 4);
      const civic = await add({ ...buildVehicle({ make: 'Honda', model: 'Civic', quantity: 1 }), colour: RED });

      const res = await api.mutate('post', `/api/vehicles/${id}/restock`, admin).send({
        quantity: 2,
        colours: [
          { colourId: redId, quantity: 1 },
          { colourId: civic.body.vehicle.colours[0].id, quantity: 1 },
        ],
      });

      expect(res.status).toBe(400);
      expect((await api.vehicles.findById(id))!.quantity).toBe(5);
    });

    it('requires a colour to restock a model with several', async () => {
      const { id } = await camryInRedAndWhite();

      const res = await api.mutate('post', `/api/vehicles/${id}/restock`, admin).send({ quantity: 5 });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { field: 'colourId', message: 'is required when the model has several colours' },
      ]);
    });

    it('refuses a single stock total for a model with several colours', async () => {
      const { id } = await camryInRedAndWhite();

      const res = await api.mutate('put', `/api/vehicles/${id}`, user).send({ quantity: 9 });

      expect(res.status).toBe(400);
      expect(await totalsAgree()).toBe(true);
    });
  });

  it('finds vehicles by colour', async () => {
    await camryInRedAndWhite();
    await add({
      ...buildVehicle({ make: 'Honda', model: 'Civic', quantity: 3 }),
      colour: { name: 'Crystal Black', hex: '#111214' },
    });

    const res = await api.get('/api/vehicles/search?colour=pearl', user);

    expect(res.body.data.map((v: { model: string }) => v.model)).toEqual(['Camry']);
  });
});
