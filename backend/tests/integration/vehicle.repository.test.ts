import type { Pool } from 'pg';
import { PgVehicleRepository } from '../../src/repositories/pg-vehicle.repository';
import type { ListOptions, VehicleFilters } from '../../src/types/vehicle';
import { openTestDb, resetDb } from '../helpers/db';
import { buildVehicle, LOT } from '../helpers/factories';

const defaults: ListOptions = { sort: 'make', order: 'asc', limit: 25, offset: 0 };

describe('PgVehicleRepository', () => {
  let pool: Pool;
  let repo: PgVehicleRepository;

  beforeAll(async () => {
    pool = await openTestDb();
    repo = new PgVehicleRepository(pool, 3);
  });

  beforeEach(() => resetDb(pool));

  afterAll(() => pool.end());

  async function seedLot() {
    for (const v of LOT) await repo.create(v);
  }

  async function names(filters: VehicleFilters, options: Partial<ListOptions> = {}) {
    const page = await repo.search(filters, { ...defaults, ...options });
    return page.data.map((v) => `${v.make} ${v.model}`);
  }

  describe('create and find', () => {
    it('stores a vehicle and returns money as a number', async () => {
      const created = await repo.create(buildVehicle({ price: 38999.99 }));

      expect(created).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        make: 'Toyota',
        model: 'Camry',
        category: 'Sedan',
        price: 38999.99,
        quantity: 5,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(await repo.findById(created.id)).toEqual(created);
    });

    it('returns null for an unknown or malformed id', async () => {
      expect(await repo.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(await repo.findById("1' OR '1'='1")).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(seedLot);

    it('lists everything sorted by make, with the total count', async () => {
      const page = await repo.search({}, defaults);

      expect(page.count).toBe(6);
      expect(page.data.map((v) => v.make)).toEqual(['Ford', 'Honda', 'Tesla', 'Toyota', 'Toyota', 'Toyota']);
    });

    it('matches make and model case-insensitively and partially', async () => {
      expect(await names({ make: 'toy' }, { sort: 'model' })).toEqual([
        'Toyota Camry',
        'Toyota Corolla',
        'Toyota RAV4',
      ]);
      expect(await names({ model: 'CIV' })).toEqual(['Honda Civic']);
    });

    it('matches category exactly', async () => {
      expect(await names({ category: 'Truck' })).toEqual(['Ford F-150']);
    });

    it('filters by an inclusive price range', async () => {
      expect(await names({ minPrice: 24650, maxPrice: 31500 }, { sort: 'price' })).toEqual([
        'Honda Civic',
        'Toyota Camry',
        'Toyota RAV4',
      ]);
    });

    it('combines filters (make=Toyota, 10,000 to 30,000)', async () => {
      expect(await names({ make: 'Toyota', minPrice: 10000, maxPrice: 30000 }, { sort: 'price' })).toEqual([
        'Toyota Corolla',
        'Toyota Camry',
      ]);
    });

    it('sorts descending by any allow-listed field', async () => {
      expect(await names({}, { sort: 'price', order: 'desc', limit: 2 })).toEqual(['Tesla Model 3', 'Ford F-150']);
      expect(await names({}, { sort: 'quantity', order: 'desc', limit: 1 })).toEqual(['Honda Civic']);
    });

    it('paginates with a stable order and reports the full count', async () => {
      const first = await repo.search({ make: 'Toyota' }, { ...defaults, limit: 2, offset: 0 });
      const second = await repo.search({ make: 'Toyota' }, { ...defaults, limit: 2, offset: 2 });

      expect(first.count).toBe(3);
      expect(second.count).toBe(3);
      expect(first.data).toHaveLength(2);
      expect(second.data).toHaveLength(1);
      expect(new Set([...first.data, ...second.data].map((v) => v.id)).size).toBe(3);
    });

    it('treats LIKE wildcards in the input literally', async () => {
      await repo.create(buildVehicle({ make: 'Odd_Make', model: '100% Electric' }));

      expect(await names({ make: '%' })).toEqual([]);
      expect(await names({ make: '_' })).toEqual(['Odd_Make 100% Electric']);
      expect(await names({ model: '100%' })).toEqual(['Odd_Make 100% Electric']);
      expect(await names({ make: '\\' })).toEqual([]);
    });

    it.each(["' OR '1'='1", "'; DROP TABLE vehicles; --", '" OR ""="', '1; SELECT pg_sleep(5)'])(
      'matches the injection payload %j literally and leaves the table intact',
      async (payload) => {
        const started = Date.now();

        expect(await names({ make: payload })).toEqual([]);
        expect(await names({ model: payload })).toEqual([]);
        expect(Date.now() - started).toBeLessThan(2000);
        expect((await repo.search({}, defaults)).count).toBe(6);
      },
    );
  });

  describe('stock status filter (threshold 3)', () => {
    beforeEach(seedLot);

    it('finds sold-out vehicles', async () => {
      expect(await names({ stock: 'out' })).toEqual(['Toyota Corolla']);
    });

    it('finds low-stock vehicles: 1 to the threshold', async () => {
      expect(await names({ stock: 'low' })).toEqual(['Ford F-150', 'Toyota RAV4']);
    });

    it('finds everything in stock', async () => {
      expect(await names({ stock: 'in' })).not.toContain('Toyota Corolla');
      expect((await repo.search({ stock: 'in' }, defaults)).count).toBe(5);
    });
  });

  describe('stats', () => {
    it('summarises the whole inventory', async () => {
      await seedLot();

      expect(await repo.stats()).toEqual({
        models: 6,
        units: 21,
        inventoryValue: 662504.97,
        outOfStock: 1,
        lowStock: 2,
      });
    });

    it('reports zeros for an empty lot', async () => {
      expect(await repo.stats()).toEqual({ models: 0, units: 0, inventoryValue: 0, outOfStock: 0, lowStock: 0 });
    });
  });

  describe('update and delete', () => {
    it('applies a partial update and bumps updatedAt', async () => {
      const created = await repo.create(buildVehicle());
      await new Promise((resolve) => setTimeout(resolve, 5)); // Date has millisecond resolution

      const updated = await repo.update(created.id, { price: 26500.5, model: 'Camry Hybrid' });

      expect(updated).toMatchObject({ id: created.id, model: 'Camry Hybrid', price: 26500.5, make: 'Toyota' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
      expect(updated!.createdAt).toEqual(created.createdAt);
    });

    it('returns null when updating an unknown vehicle', async () => {
      expect(await repo.update('00000000-0000-4000-8000-000000000000', { price: 1 })).toBeNull();
    });

    it('deletes a vehicle and reports whether it existed', async () => {
      const created = await repo.create(buildVehicle());

      expect(await repo.delete(created.id)).toBe(true);
      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.delete(created.id)).toBe(false);
    });
  });

  describe('database invariants', () => {
    it.each([
      [
        'negative stock',
        `INSERT INTO vehicles (make, model, category, price, quantity) VALUES ('A', 'B', 'Sedan', 1, -1)`,
      ],
      [
        'negative price',
        `INSERT INTO vehicles (make, model, category, price, quantity) VALUES ('A', 'B', 'Sedan', -1, 1)`,
      ],
    ])('rejects %s', async (_, sql) => {
      await expect(pool.query(sql)).rejects.toThrow(/check constraint/);
    });

    it('refuses to decrement stock below zero', async () => {
      const created = await repo.create(buildVehicle({ quantity: 1 }));

      await expect(
        pool.query('UPDATE vehicles SET quantity = quantity - 2 WHERE id = $1', [created.id]),
      ).rejects.toThrow(/check constraint/);
    });
  });
});
