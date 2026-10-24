import type { Pool } from 'pg';
import { openTestDb, resetDb } from '../helpers/db';
import { buildDbApp } from '../helpers/db-app';
import { buildVehicle } from '../helpers/factories';

describe('low-stock alerts', () => {
  let pool: Pool;
  let api: ReturnType<typeof buildDbApp>;
  let buyer: string;
  let adminCookie: string;
  let adminIds: string[];
  let buyerId: string;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(async () => {
    await resetDb(pool);
    api = buildDbApp(pool);
    const b = await api.login('user');
    buyer = b.cookie;
    buyerId = b.user.id;
    const first = await api.login('admin');
    const second = await api.login('admin');
    adminCookie = first.cookie;
    adminIds = [first.user.id, second.user.id].sort();
  });

  afterAll(() => pool.end());

  async function openAlerts(vehicleId: string) {
    const { rows } = await pool.query(
      `SELECT recipient_id, type, quantity FROM notifications
       WHERE vehicle_id = $1 AND resolved_at IS NULL ORDER BY type, recipient_id`,
      [vehicleId],
    );
    return rows as Array<{ recipient_id: string; type: string; quantity: number }>;
  }

  const buy = (id: string, quantity = 1) =>
    api.mutate('post', `/api/vehicles/${id}/purchase`, buyer).send({ quantity });
  const restock = (id: string, quantity: number) =>
    api.mutate('post', `/api/vehicles/${id}/restock`, adminCookie).send({ quantity });

  it('alerts every admin, and only admins, when a purchase leaves 3 or fewer', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 4 }));

    await buy(camry.id);

    expect(await openAlerts(camry.id)).toEqual(
      adminIds.map((id) => ({ recipient_id: id, type: 'LOW_STOCK', quantity: 3 })),
    );
    expect((await openAlerts(camry.id)).some((a) => a.recipient_id === buyerId)).toBe(false);
  });

  it('does not duplicate the alert as stock keeps falling', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 4 }));

    await buy(camry.id);
    await buy(camry.id);

    expect(await openAlerts(camry.id)).toHaveLength(2);
  });

  it('replaces the low-stock alert with an out-of-stock alert at zero', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 2 }));

    await buy(camry.id, 2);

    expect(await openAlerts(camry.id)).toEqual(
      adminIds.map((id) => ({ recipient_id: id, type: 'OUT_OF_STOCK', quantity: 0 })),
    );
  });

  it('resolves everything once a restock lifts stock above the threshold', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 1 }));
    await buy(camry.id);

    await restock(camry.id, 10);

    expect(await openAlerts(camry.id)).toEqual([]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM notifications WHERE resolved_at IS NOT NULL');
    expect(rows[0].n).toBe(2);
  });

  it('raises a fresh low-stock alert after a partial restock is bought down again', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 1 }));
    await buy(camry.id);
    await restock(camry.id, 2);

    expect(await openAlerts(camry.id)).toEqual([]);

    await buy(camry.id);

    expect((await openAlerts(camry.id)).map((a) => a.type)).toEqual(['LOW_STOCK', 'LOW_STOCK']);
  });

  it('stays quiet for purchases that leave plenty of stock', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 10 }));

    await buy(camry.id);

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM notifications');
    expect(rows[0].n).toBe(0);
  });

  it('creates exactly one open alert per admin when concurrent purchases cross the threshold', async () => {
    const camry = await api.vehicles.create(buildVehicle({ quantity: 6 }));

    const responses = await Promise.all(Array.from({ length: 4 }, () => buy(camry.id)));

    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(await openAlerts(camry.id)).toEqual(
      adminIds.map((id) => ({ recipient_id: id, type: 'LOW_STOCK', quantity: expect.any(Number) })),
    );
  });

  it('blocks duplicate open alerts at the database level', async () => {
    const camry = await api.vehicles.create(buildVehicle());
    const insert = () =>
      pool.query(
        `INSERT INTO notifications (recipient_id, type, vehicle_id, quantity) VALUES ($1, 'LOW_STOCK', $2, 2)`,
        [adminIds[0], camry.id],
      );
    await insert();

    await expect(insert()).rejects.toThrow(/duplicate key/);
  });
});
