import { isUuid } from '../db/errors';
import type { Queryable } from '../db/transaction';
import type { Colour, ColourInput, Vehicle, VehicleChanges } from '../types/vehicle';
import { loadVehicle } from './pg-vehicle.repository';
import type { IStockRepository, PurchaseRecord } from './stock.repository';

// Fixed column map: identifiers are never built from input.
const EDITABLE_COLUMNS = { make: 'make', model: 'model', category: 'category', price: 'price' } as const;
type EditableField = keyof typeof EDITABLE_COLUMNS;

export class PgStockRepository implements IStockRepository {
  lockVehicle(tx: Queryable, vehicleId: string): Promise<Vehicle | null> {
    if (!isUuid(vehicleId)) return Promise.resolve(null);
    // Serialises every stock change on this model until the transaction ends.
    return loadVehicle(tx, 'id = $1 FOR UPDATE', [vehicleId]);
  }

  async adjustColour(tx: Queryable, vehicleId: string, colourId: string, delta: number): Promise<Vehicle> {
    // Both rows carry CHECK (quantity >= 0), so a bad delta fails rather than going negative.
    await tx.query('UPDATE vehicle_colours SET quantity = quantity + $3 WHERE id = $2 AND vehicle_id = $1', [
      vehicleId,
      colourId,
      delta,
    ]);
    await tx.query('UPDATE vehicles SET quantity = quantity + $2, updated_at = now() WHERE id = $1', [
      vehicleId,
      delta,
    ]);
    return (await loadVehicle(tx, 'id = $1', [vehicleId]))!;
  }

  async setStock(
    tx: Queryable,
    vehicleId: string,
    colourId: string,
    quantity: number,
    fields: VehicleChanges,
  ): Promise<Vehicle> {
    const { rows } = await tx.query<{ before: number }>(
      `UPDATE vehicle_colours c SET quantity = $3
       FROM (SELECT quantity AS before FROM vehicle_colours WHERE id = $2 AND vehicle_id = $1) old
       WHERE c.id = $2 AND c.vehicle_id = $1
       RETURNING old.before`,
      [vehicleId, colourId, quantity],
    );
    const delta = quantity - rows[0]!.before;

    const columns = (Object.keys(EDITABLE_COLUMNS) as EditableField[]).filter((key) => fields[key] !== undefined);
    const assignments = columns.map((key, i) => `${EDITABLE_COLUMNS[key]} = $${i + 3}`);
    await tx.query(
      `UPDATE vehicles SET ${['quantity = quantity + $2', ...assignments, 'updated_at = now()'].join(', ')} WHERE id = $1`,
      [vehicleId, delta, ...columns.map((key) => fields[key])],
    );
    return (await loadVehicle(tx, 'id = $1', [vehicleId]))!;
  }

  async addColour(tx: Queryable, vehicleId: string, { name, hex }: ColourInput): Promise<Colour> {
    const { rows } = await tx.query<Colour>(
      'INSERT INTO vehicle_colours (vehicle_id, name, hex) VALUES ($1, $2, $3) RETURNING id, name, hex, quantity',
      [vehicleId, name, hex],
    );
    return rows[0]!;
  }

  async recordPurchase(tx: Queryable, { vehicleId, colourId, userId, quantity, unitPrice }: PurchaseRecord) {
    await tx.query(
      'INSERT INTO purchases (vehicle_id, colour_id, user_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)',
      [vehicleId, colourId, userId, quantity, unitPrice],
    );
  }
}
