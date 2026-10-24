import type { Queryable } from '../db/transaction';
import type { Vehicle, VehicleChanges } from '../types/vehicle';

export interface PurchaseRecord {
  vehicleId: string;
  userId: string;
  quantity: number;
  unitPrice: number;
}

/** Stock writes. Every method runs on the caller's transaction. */
export interface IStockRepository {
  /** Atomic conditional decrement; null when the vehicle is missing or has too little stock. */
  decrement(tx: Queryable, vehicleId: string, quantity: number): Promise<Vehicle | null>;
  /** Null when the vehicle is missing. */
  increment(tx: Queryable, vehicleId: string, quantity: number): Promise<Vehicle | null>;
  /** Sets the quantity (and other fields) and returns the previous quantity; null when the vehicle is missing. */
  set(
    tx: Queryable,
    vehicleId: string,
    quantity: number,
    fields: VehicleChanges,
  ): Promise<{ vehicle: Vehicle; before: number } | null>;
  findById(tx: Queryable, vehicleId: string): Promise<Vehicle | null>;
  recordPurchase(tx: Queryable, purchase: PurchaseRecord): Promise<void>;
}
