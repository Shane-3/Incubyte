import type { Pool } from 'pg';
import { isUuid } from '../db/errors';
import type {
  Category,
  InventoryStats,
  ListOptions,
  NewVehicle,
  Page,
  SortField,
  Vehicle,
  VehicleChanges,
  VehicleFilters,
  VehicleView,
} from '../types/vehicle';
import type { IVehicleRepository } from './vehicle.repository';

export interface VehicleRow {
  id: string;
  make: string;
  model: string;
  category: Category;
  price: string; // NUMERIC arrives as a string so no precision is lost in transit
  quantity: number;
  created_at: Date;
  updated_at: Date;
}

export const VEHICLE_COLUMNS = 'id, make, model, category, price, quantity, created_at, updated_at';
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

const UPDATABLE_COLUMNS: Record<keyof VehicleChanges, string> = {
  make: 'make',
  model: 'model',
  category: 'category',
  price: 'price',
  quantity: 'quantity',
};

export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    category: row.category,
    price: Number(row.price),
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Escapes LIKE metacharacters so user input is matched literally (used with ESCAPE '\'). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function whereClause(filters: VehicleFilters): { sql: string; params: unknown[] } {
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

  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export class PgVehicleRepository implements IVehicleRepository {
  constructor(
    private readonly pool: Pool,
    private readonly lowStockThreshold = 3,
  ) {}

  async stats(): Promise<InventoryStats> {
    throw new Error('Not implemented');
  }

  async create({ make, model, category, price, quantity }: NewVehicle): Promise<Vehicle> {
    const { rows } = await this.pool.query<VehicleRow>(
      `INSERT INTO vehicles (make, model, category, price, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [make, model, category, price, quantity],
    );
    return toVehicle(rows[0]!);
  }

  async findById(id: string): Promise<Vehicle | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.pool.query<VehicleRow>(`SELECT ${COLUMNS} FROM vehicles WHERE id = $1`, [id]);
    return rows[0] ? toVehicle(rows[0]) : null;
  }

  async search(filters: VehicleFilters, options: ListOptions, viewerId?: string): Promise<Page<VehicleView>> {
    const where = whereClause(filters);
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
    return {
      data: page.rows.map((row) => ({ ...toVehicle(row), isWatching: row.is_watching })),
      count: Number(total.rows[0]!.count),
    };
  }

  async update(id: string, changes: VehicleChanges): Promise<Vehicle | null> {
    if (!isUuid(id)) return null;
    const entries = (Object.keys(UPDATABLE_COLUMNS) as Array<keyof VehicleChanges>).filter(
      (key) => changes[key] !== undefined,
    );
    const assignments = entries.map((key, i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`);
    const { rows } = await this.pool.query<VehicleRow>(
      `UPDATE vehicles SET ${[...assignments, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, ...entries.map((key) => changes[key])],
    );
    return rows[0] ? toVehicle(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const { rowCount } = await this.pool.query('DELETE FROM vehicles WHERE id = $1', [id]);
    return rowCount === 1;
  }
}
