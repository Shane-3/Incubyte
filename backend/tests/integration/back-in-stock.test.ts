import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

describe('back-in-stock notifications', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let admin: string;
  let watchers: Array<{ id: string; cookie: string }>;
  let bystander: { id: string; cookie: string };

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    admin = (await api.login('admin')).cookie;
    watchers = [];
    for (let i = 0; i < 2; i++) {
      const w = await api.login('user');
      watchers.push({ id: w.user.id, cookie: w.cookie });
    }
    const b = await api.login('user');
    bystander = { id: b.user.id, cookie: b.cookie };
  });

  afterAll(() => pool.end());

  async function soldOutAndWatched() {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 0 }));
    for (const w of watchers) {
      await api.mutate('post', `/api/vehicles/${camry.id}/watch`, w.cookie);
    }
    return camry;
  }

  async function backInStockFor(vehicleId: string) {
    const { rows } = await pool.query(
      `SELECT recipient_id, quantity FROM notifications
       WHERE type = 'BACK_IN_STOCK' AND vehicle_id = $1 ORDER BY recipient_id`,
      [vehicleId],
    );
    return rows as Array<{ recipient_id: string; quantity: number }>;
  }

  async function watchCount() {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM watches');
    return rows[0].n as number;
  }

  it('notifies each watcher once on restock and clears their watches', async () => {
    const camry = await soldOutAndWatched();

    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 4 });

    expect(await backInStockFor(camry.id)).toEqual(
      watchers.map((w) => ({ recipient_id: w.id, quantity: 4 })).sort((a, b) => a.recipient_id.localeCompare(b.recipient_id)),
    );
    expect(await watchCount()).toBe(0);
  });

  it('does not notify again on a second restock', async () => {
    const camry = await soldOutAndWatched();

    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 4 });
    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 4 });

    expect(await backInStockFor(camry.id)).toHaveLength(2);
  });

  it('notifies watchers when an edit sets the quantity above zero, applying the other edits too', async () => {
    const camry = await soldOutAndWatched();

    const res = await api
      .mutate('put', `/api/vehicles/${camry.id}`, bystander.cookie)
      .send({ quantity: 3, price: 25999 });

    expect(res.status).toBe(200);
    expect(res.body.vehicle).toMatchObject({ quantity: 3, price: 25999 });
    expect(await backInStockFor(camry.id)).toHaveLength(2);
    expect(await watchCount()).toBe(0);
  });

  it('notifies nobody when stock was already available', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 2 }));

    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 3 });
    await api.mutate('put', `/api/vehicles/${camry.id}`, admin).send({ quantity: 9 });

    expect(await backInStockFor(camry.id)).toEqual([]);
  });

  it('never notifies users who were not watching', async () => {
    const camry = await soldOutAndWatched();

    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 1 });

    expect((await backInStockFor(camry.id)).map((n) => n.recipient_id)).not.toContain(bystander.id);
  });

  it('lets a user watch again after being notified, once the vehicle sells out again', async () => {
    const camry = await soldOutAndWatched();
    await api.mutate('post', `/api/vehicles/${camry.id}/restock`, admin).send({ quantity: 1 });
    await api.mutate('post', `/api/vehicles/${camry.id}/purchase`, bystander.cookie);

    const res = await api.mutate('post', `/api/vehicles/${camry.id}/watch`, watchers[0]!.cookie);

    expect(res.status).toBe(200);
    expect(await watchCount()).toBe(1);
  });

  it('runs edits that lower stock through the low-stock rules as well', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 10 }));

    await api.mutate('put', `/api/vehicles/${camry.id}`, admin).send({ quantity: 2 });

    const { rows } = await pool.query(
      `SELECT type, quantity FROM notifications WHERE vehicle_id = $1 AND resolved_at IS NULL`,
      [camry.id],
    );
    expect(rows).toEqual([{ type: 'LOW_STOCK', quantity: 2 }]);
  });

  it('returns 404 when editing the quantity of an unknown vehicle', async () => {
    const res = await api
      .mutate('put', '/api/vehicles/00000000-0000-4000-8000-000000000000', admin)
      .send({ quantity: 3 });

    expect(res.status).toBe(404);
  });
});
