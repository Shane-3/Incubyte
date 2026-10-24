import type { Pool } from 'pg';
import { seedDemoData } from '../../src/db/seed-demo';
import { PgSalesRepository } from '../../src/repositories/pg-sales.repository';
import { forecastVehicle } from '../../src/services/forecast.service';
import { openTestDb, resetDb } from '../helpers/db';

const NOW = new Date('2026-10-24T12:00:00Z');

describe('seedDemoData', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await openTestDb();
  });

  beforeEach(() => resetDb(pool));

  afterAll(() => pool.end());

  async function count(table: string) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0].n as number;
  }

  it('loads about 30 realistic vehicles, including sold-out and low-stock ones', async () => {
    await seedDemoData(pool, { now: NOW });

    const { rows } = await pool.query('SELECT make, model, category, price::float AS price, quantity FROM vehicles');
    expect(rows.length).toBeGreaterThanOrEqual(28);
    expect(rows.filter((v) => v.quantity === 0).length).toBeGreaterThanOrEqual(2);
    expect(rows.filter((v) => v.quantity > 0 && v.quantity <= 3).length).toBeGreaterThanOrEqual(3);
    expect(new Set(rows.map((v) => v.category)).size).toBeGreaterThanOrEqual(6);
    expect(rows.every((v) => v.price >= 15000 && v.price <= 150000)).toBe(true);
  });

  it('backdates sales over the last 30 days so the forecast has signal', async () => {
    await seedDemoData(pool, { now: NOW });

    const { rows } = await pool.query(
      `SELECT min(created_at) AS first, max(created_at) AS last, count(*)::int AS n FROM purchases`,
    );
    expect(rows[0].n).toBeGreaterThan(30);
    expect(NOW.getTime() - rows[0].first.getTime()).toBeLessThanOrEqual(30 * 86_400_000);
    expect(rows[0].last.getTime()).toBeLessThanOrEqual(NOW.getTime());

    const from = new Date(NOW.getTime() - 30 * 86_400_000);
    const forecasts = (await new PgSalesRepository(pool).summarise(from, NOW)).map((s) =>
      forecastVehicle(s, { windowDays: 30, atRiskDays: 7 }),
    );
    expect(forecasts.filter((f) => f.atRisk).length).toBeGreaterThanOrEqual(2);
    expect(forecasts.some((f) => f.daysOfStockLeft === null)).toBe(true);
  });

  it('paints the lot in real factory colours, with stock split across them and every sale tied to a colour', async () => {
    await seedDemoData(pool, { now: NOW });

    const { rows: perModel } = await pool.query(
      `SELECT v.quantity, count(c.id)::int AS colours, COALESCE(sum(c.quantity), 0)::int AS colour_units
       FROM vehicles v LEFT JOIN vehicle_colours c ON c.vehicle_id = v.id GROUP BY v.id`,
    );
    expect(perModel.every((v) => v.colours >= 1)).toBe(true);
    expect(perModel.filter((v) => v.colours >= 3).length).toBeGreaterThanOrEqual(10);
    expect(perModel.every((v) => v.quantity === v.colour_units)).toBe(true);

    const { rows: untagged } = await pool.query('SELECT count(*)::int AS n FROM purchases WHERE colour_id IS NULL');
    expect(untagged[0].n).toBe(0);

    const { rows: names } = await pool.query(`SELECT count(*)::int AS n FROM vehicle_colours WHERE name = 'Standard'`);
    expect(names[0].n).toBe(0);
  });

  it('is deterministic', async () => {
    await seedDemoData(pool, { now: NOW });
    const first = await pool.query('SELECT make, model, quantity FROM vehicles ORDER BY make, model');
    const firstSales = await count('purchases');
    await resetDb(pool);

    await seedDemoData(pool, { now: NOW });

    expect((await pool.query('SELECT make, model, quantity FROM vehicles ORDER BY make, model')).rows).toEqual(
      first.rows,
    );
    expect(await count('purchases')).toBe(firstSales);
  });

  it('replaces an existing lot when asked to, keeping user accounts', async () => {
    await seedDemoData(pool, { now: NOW });
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Dana Okafor', 'dana@example.com', 'h', 'admin')`,
    );

    await seedDemoData(pool, { now: NOW, replace: true });

    expect(await count('vehicles')).toBeLessThan(40);
    expect(await count('vehicles')).toBeGreaterThanOrEqual(28);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM users WHERE email = 'dana@example.com'`);
    expect(rows[0].n).toBe(1);
  });

  it('refuses to run against a database that already has vehicles', async () => {
    await seedDemoData(pool, { now: NOW });

    await expect(seedDemoData(pool, { now: NOW })).rejects.toThrow(/already has vehicles/);
    expect(await count('vehicles')).toBeLessThan(40);
  });
});
