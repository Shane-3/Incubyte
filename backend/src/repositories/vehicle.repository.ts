import type {
  InventoryStats,
  ListOptions,
  NewVehicle,
  Page,
  Vehicle,
  VehicleChanges,
  VehicleFilters,
  VehicleView,
} from '../types/vehicle';

export interface IVehicleRepository {
  create(input: NewVehicle): Promise<Vehicle>;
  findById(id: string): Promise<Vehicle | null>;
  /** Case-insensitive; make + model identifies a model. */
  findByMakeModel(make: string, model: string): Promise<Vehicle | null>;
  /** isWatching is computed for viewerId (false for everything when omitted). */
  search(filters: VehicleFilters, options: ListOptions, viewerId?: string): Promise<Page<VehicleView>>;
  /** Returns null when the vehicle does not exist. */
  update(id: string, changes: VehicleChanges): Promise<Vehicle | null>;
  /** Returns false when the vehicle did not exist. */
  delete(id: string): Promise<boolean>;
  /** Totals across the whole inventory, independent of any page. */
  stats(): Promise<InventoryStats>;
}
