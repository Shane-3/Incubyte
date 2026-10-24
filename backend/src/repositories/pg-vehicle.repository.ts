import type { Pool } from 'pg';
import { isPgError, isUuid, PG_UNIQUE_VIOLATION } from '../db/errors';
import type { Queryable } from '../db/transaction';
import { DuplicateModelError } from '../errors';
import { baseSku } from '../services/sku';
import {
  type Category,
  type Colour,
  DEFAULT_COLOUR,
  type InventoryStats,
  type ListOptions,
  type NewVehicle,
  type Page,
  type SortField,
  type Vehicle,
  type VehicleChanges,
  type VehicleFilters,
  type VehicleView,
} from '../types/vehicle';
import type { IVehicleRepository } from './vehicle.repository';

export interface VehicleRow {
  id: string;
  sku: string;
  make: string;
  model: string;
  category: Category;
  price: string; // NUMERIC arrives as a string so no precision is lost in transit
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

interface ColourRow extends Colour {
  vehicle_id: string;
}

export const VEHICLE_COLUMNS = 'id, sku, make, model, category, price, quantity, created_at, updated_at';
const COLUMNS = VEHICLE_COLUMNS;

// Identifiers can't be bound as parameters, so sort columns come only from this fixed map.
const SORT_COLUMNS: Record<SortField, string> = {
  make: 'lower(make)',
  model: 'lower(model)',
  category: 'category',
  price: 'price',
  quantity: 'quantity',
  createdAt: 'created_at',
};

// Quantity is not here: stock only changes through the stock pipeline, colour by colour.
const UPDATABLE_COLUMNS = { make: 'make', model: 'model', category: 'category', price: 'price' } as const;
type UpdatableField = keyof typeof UPDATABLE_COLUMNS;

const MAX_SKU_ATTEMPTS = 5;

export function toVehicle(row: VehicleRow, colours: Colour[] = []): Vehicle {
  return {
    id: row.id,
    sku: row.sku,
    make: row.make,
    model: row.model,
    category: row.category,
    price: Number(row.price),
    quantity: row.quantity,
    colours,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Loads the colours of the given vehicles in one query, oldest first, and attaches them. */
export async function withColours<R extends VehicleRow>(
  db: Queryable,
  rows: R[],
): Promise<Array<R & { colours: Colour[] }>> {
  if (rows.length === 0) return [];
  const { rows: colours } = await db.query<ColourRow>(
    `SELECT id, vehicle_id, name, hex, quantity FROM vehicle_colours
     WHERE vehicle_id = ANY($1::uuid[]) ORDER BY created_at, id`,
    [rows.map((r) => r.id)],
  );
  const byVehicle = new Map<string, Colour[]>();
  for (const { vehicle_id, ...colour } of colours) {
    byVehicle.set(vehicle_id, [...(byVehicle.get(vehicle_id) ?? []), colour]);
  }
  return rows.map((row) => ({ ...row, colours: byVehicle.get(row.id) ?? [] }));
}

export async function loadVehicle(db: Queryable, where: string, params: unknown[]): Promise<Vehicle | null> {
  const { rows } = await db.query<VehicleRow>(`SELECT ${COLUMNS} FROM vehicles WHERE ${where}`, params);
  const [row] = await withColours(db, rows);
  return row ? toVehicle(row, row.colours) : null;
}

/** Escapes LIKE metacharacters so user input is matched literally (used with ESCAPE '\'). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function whereClause(filters: VehicleFilters, lowStockThreshold: number): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (condition: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    conditions.push(condition(`$${params.length}`));
  };

  if (filters.make !== undefined) add((p) => `make ILIKE ${p} ESCAPE '\\'`, `%${escapeLike(filters.make)}%`);
  if (filters.model !== undefined) add((p) => `model ILIKE ${p} ESCAPE '\\'`, `%${escapeLike(filters.model)}%`);
  if (filters.category !== undefined) add((p) => `lower(category) = lower(${p})`, filters.category);
  if (filters.minPrice !== undefined) add((p) => `price >= ${p}`, filters.minPrice);
  if (filters.maxPrice !== undefined) add((p) => `price <= ${p}`, filters.maxPrice);
  if (filters.stock === 'out') conditions.push('quantity = 0');
  if (filters.stock === 'in') conditions.push('quantity > 0');
  if (filters.stock === 'low') add((p) => `quantity BETWEEN 1 AND ${p}`, lowStockThreshold);
  if (filters.colour !== undefined) {
    add(
      (p) =>
        `EXISTS (SELECT 1 FROM vehicle_colours c WHERE c.vehicle_id = vehicles.id AND c.name ILIKE ${p} ESCAPE '\\')`,
      `%${escapeLike(filters.colour)}%`,
    );
  }

  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export class PgVehicleRepository implements IVehicleRepository {
  constructor(
    private readonly pool: Pool,
    private readonly lowStockThreshold = 3,
  ) {}

  async stats(): Promise<InventoryStats> {
    const { rows } = await this.pool.query<{
      models: number;
      units: number;
      inventory_value: string;
      out_of_stock: number;
      low_stock: number;
    }>(
      `SELECT count(*)::int AS models,
              COALESCE(sum(quantity), 0)::int AS units,
              COALESCE(sum(price * quantity), 0) AS inventory_value,
              count(*) FILTER (WHERE quantity = 0)::int AS out_of_stock,
              count(*) FILTER (WHERE quantity BETWEEN 1 AND $1)::int AS low_stock
       FROM vehicles`,
      [this.lowStockThreshold],
    );
    const row = rows[0]!;
    return {
      models: row.models,
      units: row.units,
      inventoryValue: Number(row.inventory_value),
      outOfStock: row.out_of_stock,
      lowStock: row.low_stock,
    };
  }

  /**
   * Inserts the model and its first colour together. The SKU gets the first free -2, -3... suffix; a concurrent
   * insert of the same SKU is retried. A duplicate make + model raises DuplicateModelError for the merge path.
   */
  async create({ make, model, category, price, quantity, colour = DEFAULT_COLOUR }: NewVehicle): Promise<Vehicle> {
    const base = baseSku(make, model);
    for (let attempt = 1; ; attempt++) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const sku = await this.freeSku(client, base);
        const { rows } = await client.query<VehicleRow>(
          `INSERT INTO vehicles (sku, make, model, category, price, quantity)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
          [sku, make, model, category, price, quantity],
        );
        await client.query('INSERT INTO vehicle_colours (vehicle_id, name, hex, quantity) VALUES ($1, $2, $3, $4)', [
          rows[0]!.id,
          colour.name,
          colour.hex,
          quantity,
        ]);
        const [created] = await withColours(client, rows);
        await client.query('COMMIT');
        return toVehicle(created!, created!.colours);
      } catch (err) {
        await client.query('ROLLBACK');
        if (isPgError(err, PG_UNIQUE_VIOLATION, 'vehicles_make_model_key')) throw new DuplicateModelError();
        if (isPgError(err, PG_UNIQUE_VIOLATION, 'vehicles_sku_key') && attempt < MAX_SKU_ATTEMPTS) continue;
        throw err;
      } finally {
        client.release();
      }
    }
  }

  private async freeSku(db: Queryable, base: string): Promise<string> {
    // SKUs only contain A-Z, 0-9 and '-', so the LIKE pattern needs no escaping.
    const { rows } = await db.query<{ sku: string }>(`SELECT sku FROM vehicles WHERE sku = $1 OR sku LIKE $1 || '-%'`, [
      base,
    ]);
    const taken = new Set(rows.map((r) => r.sku));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  findById(id: string): Promise<Vehicle | null> {
    if (!isUuid(id)) return Promise.resolve(null);
    return loadVehicle(this.pool, 'id = $1', [id]);
  }

  findByMakeModel(make: string, model: string): Promise<Vehicle | null> {
    return loadVehicle(this.pool, 'lower(make) = lower($1) AND lower(model) = lower($2)', [make, model]);
  }

  async search(filters: VehicleFilters, options: ListOptions, viewerId?: string): Promise<Page<VehicleView>> {
    const where = whereClause(filters, this.lowStockThreshold);
    const direction = options.order === 'desc' ? 'DESC' : 'ASC';
    const viewerAt = where.params.length + 1;

    const [page, total] = await Promise.all([
      this.pool.query<VehicleRow & { is_watching: boolean }>(
        `SELECT ${COLUMNS},
           EXISTS (SELECT 1 FROM watches w WHERE w.vehicle_id = vehicles.id AND w.user_id = $${viewerAt}::uuid)
             AS is_watching
         FROM vehicles ${where.sql}
         ORDER BY ${SORT_COLUMNS[options.sort]} ${direction}, id ASC
         LIMIT $${viewerAt + 1} OFFSET $${viewerAt + 2}`,
        [...where.params, viewerId ?? null, options.limit, options.offset],
      ),
      this.pool.query<{ count: string }>(`SELECT count(*) FROM vehicles ${where.sql}`, where.params),
    ]);
    const rows = await withColours(this.pool, page.rows);
    return {
      data: rows.map((row) => ({ ...toVehicle(row, row.colours), isWatching: row.is_watching })),
      count: Number(total.rows[0]!.count),
    };
  }

  async update(id: string, changes: VehicleChanges): Promise<Vehicle | null> {
    if (!isUuid(id)) return null;
    const entries = (Object.keys(UPDATABLE_COLUMNS) as UpdatableField[]).filter((key) => changes[key] !== undefined);
    const assignments = entries.map((key, i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`);
    try {
      const { rows } = await this.pool.query<VehicleRow>(
        `UPDATE vehicles SET ${[...assignments, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, ...entries.map((key) => changes[key])],
      );
      const [row] = await withColours(this.pool, rows);
      return row ? toVehicle(row, row.colours) : null;
    } catch (err) {
      if (isPgError(err, PG_UNIQUE_VIOLATION, 'vehicles_make_model_key')) throw new DuplicateModelError();
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const { rowCount } = await this.pool.query('DELETE FROM vehicles WHERE id = $1', [id]);
    return rowCount === 1;
  }
}
