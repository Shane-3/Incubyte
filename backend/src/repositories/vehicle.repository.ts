import type { ListOptions, NewVehicle, Page, Vehicle, VehicleChanges, VehicleFilters } from '../types/vehicle';

export interface IVehicleRepository {
  create(input: NewVehicle): Promise<Vehicle>;
  findById(id: string): Promise<Vehicle | null>;
  search(filters: VehicleFilters, options: ListOptions): Promise<Page<Vehicle>>;
  /** Returns null when the vehicle does not exist. */
  update(id: string, changes: VehicleChanges): Promise<Vehicle | null>;
  /** Returns false when the vehicle did not exist. */
  delete(id: string): Promise<boolean>;
}
