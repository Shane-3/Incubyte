import type { Queryable } from '../db/transaction';
import type { Colour, ColourInput, Vehicle, VehicleChanges } from '../types/vehicle';
import type { IStockRepository, PurchaseRecord } from './stock.repository';

export class PgStockRepository implements IStockRepository {
  async lockVehicle(_tx: Queryable, _vehicleId: string): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async adjustColour(_tx: Queryable, _vehicleId: string, _colourId: string, _delta: number): Promise<Vehicle> {
    throw new Error('Not implemented');
  }

  async setStock(
    _tx: Queryable,
    _vehicleId: string,
    _colourId: string,
    _quantity: number,
    _fields: VehicleChanges,
  ): Promise<Vehicle> {
    throw new Error('Not implemented');
  }

  async addColour(_tx: Queryable, _vehicleId: string, _colour: ColourInput): Promise<Colour> {
    throw new Error('Not implemented');
  }

  async recordPurchase(_tx: Queryable, _purchase: PurchaseRecord): Promise<void> {
    throw new Error('Not implemented');
  }
}
