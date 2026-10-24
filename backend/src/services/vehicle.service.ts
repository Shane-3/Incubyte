import { VehicleNotFoundError } from '../errors';
import type { IVehicleRepository } from '../repositories/vehicle.repository';
import type { StockChangeService } from './stock-change.service';
import type {
  ListOptions,
  NewVehicle,
  Page,
  Vehicle,
  VehicleChanges,
  VehicleFilters,
  VehicleView,
} from '../types/vehicle';

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

  search(filters: VehicleFilters, options: ListOptions, viewerId: string): Promise<Page<VehicleView>> {
    return this.vehicles.search(filters, options, viewerId);
  }

  async update(id: string, changes: VehicleChanges): Promise<Vehicle> {
    if (changes.quantity !== undefined) {
      // Quantity edits go through the stock pipeline so alerts and back-in-stock notices fire.
      const { quantity, ...fields } = changes;
      return this.stockChanges.apply(id, { kind: 'set', quantity, fields });
    }
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
