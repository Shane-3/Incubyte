import type { Pool } from 'pg';
import type { ListOptions, NewVehicle, Page, Vehicle, VehicleChanges, VehicleFilters } from '../types/vehicle';
import type { IVehicleRepository } from './vehicle.repository';

export class PgVehicleRepository implements IVehicleRepository {
  constructor(private readonly pool: Pool) {}

  async create(_input: NewVehicle): Promise<Vehicle> {
    throw new Error('Not implemented');
  }

  async findById(_id: string): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async search(_filters: VehicleFilters, _options: ListOptions): Promise<Page<Vehicle>> {
    throw new Error('Not implemented');
  }

  async update(_id: string, _changes: VehicleChanges): Promise<Vehicle | null> {
    throw new Error('Not implemented');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
