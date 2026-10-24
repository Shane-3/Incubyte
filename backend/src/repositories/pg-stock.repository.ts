import { isUuid } from '../db/errors';
import type { Queryable } from '../db/transaction';
import type { Vehicle, VehicleChanges } from '../types/vehicle';
import { toVehicle, VEHICLE_COLUMNS, type VehicleRow } from './pg-vehicle.repository';
import type { IStockRepository, PurchaseRecord } from './stock.repository';

// Fixed column map: identifiers are never built from input.
const EDITABLE_COLUMNS = { make: 'make', model: 'model', category: 'category', price: 'price' } as const;
const QUALIFIED_COLUMNS = VEHICLE_COLUMNS.split(', ')
  .map((c) => `v.${c}`)
  .join(', ');

export class PgStockRepository implements IStockRepository {
  async decrement(tx: Queryable, vehicleId: string, quantity: number): Promise<Vehicle | null> {
    if (!isUuid(vehicleId)) return null;
    // One conditional statement: no read-modify-write race, and stock can never go below zero.
    const { rows } = await tx.query<VehicleRow>(
      `UPDATE vehicles SET quantity = quantity - $2, updated_at = now()
       WHERE id = $1 AND quantity >= $2
       RETURNING ${VEHICLE_COLUMNS}`,
      [vehicleId, quantity],
    );
    return rows[0] ? toVehicle(rows[0]) : null;
  }

  async increment(tx: Queryable, vehicleId: string, quantity: number): Promise<Vehicle | null> {
    if (!isUuid(vehicleId)) return null;
    const { rows } = await tx.query<VehicleRow>(
      `UPDATE vehicles SET quantity = quantity + $2, updated_at = now() WHERE id = $1 RETURNING ${VEHICLE_COLUMNS}`,
      [vehicleId, quantity],
    );
    return rows[0] ? toVehicle(rows[0]) : null;
  }

  async set(
    tx: Queryable,
    vehicleId: string,
    quantity: number,
    fields: VehicleChanges,
  ): Promise<{ vehicle: Vehicle; before: number } | null> {
    if (!isUuid(vehicleId)) return null;
    const { quantity: _ignored, ...others } = fields;
    const columns = (Object.keys(EDITABLE_COLUMNS) as Array<keyof typeof EDITABLE_COLUMNS>).filter(
      (key) => others[key] !== undefined,
    );
    const assignments = columns.map((key, i) => `${EDITABLE_COLUMNS[key]} = $${i + 3}`);
    // The row lock in the subquery makes the read of the old quantity and the write one atomic step.
    const { rows } = await tx.query<VehicleRow & { before: number }>(
      `UPDATE vehicles v SET ${['quantity = $2', ...assignments, 'updated_at = now()'].join(', ')}
       FROM (SELECT id, quantity AS before FROM vehicles WHERE id = $1 FOR UPDATE) old
       WHERE v.id = old.id
       RETURNING ${QUALIFIED_COLUMNS}, old.before`,
      [vehicleId, quantity, ...columns.map((key) => others[key])],
    );
    return rows[0] ? { vehicle: toVehicle(rows[0]), before: rows[0].before } : null;
  }

  async findById(tx: Queryable, vehicleId: string): Promise<Vehicle | null> {
    if (!isUuid(vehicleId)) return null;
    const { rows } = await tx.query<VehicleRow>(`SELECT ${VEHICLE_COLUMNS} FROM vehicles WHERE id = $1`, [vehicleId]);
    return rows[0] ? toVehicle(rows[0]) : null;
  }

  async recordPurchase(tx: Queryable, { vehicleId, userId, quantity, unitPrice }: PurchaseRecord): Promise<void> {
    await tx.query('INSERT INTO purchases (vehicle_id, user_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [
      vehicleId,
      userId,
      quantity,
      unitPrice,
    ]);
  }
}
