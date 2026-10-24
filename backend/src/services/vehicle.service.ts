import { DuplicateModelError, type ErrorDetail, ModelExistsError, VehicleNotFoundError } from '../errors';
import type { IVehicleRepository } from '../repositories/vehicle.repository';
import {
  stockByColour,
  type InventoryStats,
  type ListOptions,
  type NewVehicle,
  type Page,
  type Vehicle,
  type VehicleChanges,
  type VehicleFilters,
  type VehicleView,
} from '../types/vehicle';
import type { StockChangeService } from './stock-change.service';

export interface CreateResult {
  vehicle: Vehicle;
  /** True when the make + model already existed and the colour (or its units) was added to it. */
  merged: boolean;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export class VehicleService {
  constructor(
    private readonly vehicles: IVehicleRepository,
    private readonly stockChanges: StockChangeService,
  ) {}

  purchase(id: string, userId: string, quantity: number, colourId?: string): Promise<Vehicle> {
    return this.stockChanges.apply(id, { kind: 'purchase', quantity, userId, colourId });
  }

  restock(id: string, quantity: number, colourId?: string): Promise<Vehicle> {
    return this.stockChanges.apply(id, { kind: 'restock', quantity, colourId });
  }

  /**
   * A make + model is one model (one SKU). Adding one that exists adds its colour, or units of that colour,
   * through the stock pipeline so alerts and back-in-stock notices fire. Price and category belong to the model,
   * so a different value is refused rather than silently ignored.
   */
  async create(input: NewVehicle): Promise<CreateResult> {
    const existing = await this.vehicles.findByMakeModel(input.make, input.model);
    if (!existing) {
      try {
        return { vehicle: await this.vehicles.create(input), merged: false };
      } catch (err) {
        if (!(err instanceof DuplicateModelError)) throw err;
        // Someone created the same model a moment ago: merge into theirs.
      }
    }
    const model = existing ?? (await this.vehicles.findByMakeModel(input.make, input.model));
    if (!model) throw new VehicleNotFoundError();
    return { vehicle: await this.mergeInto(model, input), merged: true };
  }

  private mergeInto(model: Vehicle, input: NewVehicle): Promise<Vehicle> {
    const conflicts: ErrorDetail[] = [];
    if (input.price !== model.price) {
      conflicts.push({ field: 'price', message: `is ${money.format(model.price)} for this model` });
    }
    if (input.category !== model.category) {
      conflicts.push({ field: 'category', message: `is ${model.category} for this model` });
    }
    if (conflicts.length > 0) throw new ModelExistsError(`${model.make} ${model.model}`, conflicts);

    return this.stockChanges.apply(model.id, {
      kind: 'receive',
      colours: stockByColour(input),
    });
  }

  search(filters: VehicleFilters, options: ListOptions, viewerId: string): Promise<Page<VehicleView>> {
    return this.vehicles.search(filters, options, viewerId);
  }

  stats(): Promise<InventoryStats> {
    return this.vehicles.stats();
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
