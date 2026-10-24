import type { Queryable } from '../db/transaction';
import type { Colour, ColourInput, Vehicle, VehicleChanges } from '../types/vehicle';

export interface PurchaseRecord {
  vehicleId: string;
  colourId: string;
  userId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Stock writes, always on the caller's transaction. A sale touches two rows (the colour and the model total), so
 * callers lock the model first; the CHECK constraints on both rows remain the last line of defence.
 */
export interface IStockRepository {
  /** Locks the model row for the rest of the transaction and returns it with its colours; null if missing. */
  lockVehicle(tx: Queryable, vehicleId: string): Promise<Vehicle | null>;
  /** Adds delta (negative to sell) to one colour and to the model total. */
  adjustColour(tx: Queryable, vehicleId: string, colourId: string, delta: number): Promise<Vehicle>;
  /** Sets one colour's stock (the model total follows) together with other model fields. */
  setStock(tx: Queryable, vehicleId: string, colourId: string, quantity: number, fields: VehicleChanges): Promise<Vehicle>;
  /** Adds a colour with no stock. */
  addColour(tx: Queryable, vehicleId: string, colour: ColourInput): Promise<Colour>;
  recordPurchase(tx: Queryable, purchase: PurchaseRecord): Promise<void>;
}
