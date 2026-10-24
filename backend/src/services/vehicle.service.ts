import { VehicleNotFoundError } from '../errors';
import type { IVehicleRepository } from '../repositories/vehicle.repository';
import type { StockChangeService } from './stock-change.service';
import type { ListOptions, NewVehicle, Page, Vehicle, VehicleChanges, VehicleFilters } from '../types/vehicle';

export class VehicleService {
  constructor(
    private readonly vehicles: IVehicleRepository,
    private readonly stockChanges: StockChangeService,
  ) {}

  purchase(id: string, userId: string, quantity: number): Promise<Vehicle> {
    return this.stockChanges.apply(id, { kind: 'purchase', quantity, userId });
  }

  restock(id: string, quantity: number): Promise<Vehicle> {
    return this.stockChanges.apply(id, { kind: 'restock', quantity });
  }

  create(input: NewVehicle): Promise<Vehicle> {
    return this.vehicles.create(input);
  }

  search(filters: VehicleFilters, options: ListOptions): Promise<Page<Vehicle>> {
    return this.vehicles.search(filters, options);
  }

  async update(id: string, changes: VehicleChanges): Promise<Vehicle> {
    const vehicle = await this.vehicles.update(id, changes);
    if (!vehicle) {
      throw new VehicleNotFoundError();
    }
    return vehicle;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.vehicles.delete(id))) {
      throw new VehicleNotFoundError();
    }
  }
}
