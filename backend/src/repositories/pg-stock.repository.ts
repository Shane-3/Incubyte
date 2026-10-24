import type { Queryable } from '../db/transaction';
import type { Vehicle } from '../types/vehicle';
import type { IStockRepository, PurchaseRecord } from './stock.repository';

export class PgStockRepository implements IStockRepository {
  async decrement(_tx: Queryable, _vehicleId: string, _quantity: number): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async increment(_tx: Queryable, _vehicleId: string, _quantity: number): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async findById(_tx: Queryable, _vehicleId: string): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async recordPurchase(_tx: Queryable, _purchase: PurchaseRecord): Promise<void> {
    throw new Error('Not implemented');
  }
}
