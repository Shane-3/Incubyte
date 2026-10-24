import { isUuid } from '../db/errors';
import type { Queryable } from '../db/transaction';
import type { Vehicle } from '../types/vehicle';
import { toVehicle, VEHICLE_COLUMNS, type VehicleRow } from './pg-vehicle.repository';
import type { IStockRepository, PurchaseRecord } from './stock.repository';

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
