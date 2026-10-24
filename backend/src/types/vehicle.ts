export const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Truck', 'Coupe', 'Convertible', 'Van', 'Electric'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A vehicle as one signed-in user sees it in lists. */
export type VehicleView = Vehicle & { isWatching: boolean };

export type NewVehicle = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>;
export type VehicleChanges = Partial<NewVehicle>;

export interface VehicleFilters {
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  stock?: StockStatus;
}

export const STOCK_STATUSES = ['in', 'low', 'out'] as const;
/** in: any stock; low: 1 to the low-stock threshold; out: none. */
export type StockStatus = (typeof STOCK_STATUSES)[number];

export interface InventoryStats {
  models: number;
  units: number;
  inventoryValue: number;
  outOfStock: number;
  lowStock: number;
}

export const SORT_FIELDS = ['make', 'model', 'category', 'price', 'quantity', 'createdAt'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export interface ListOptions {
  sort: SortField;
  order: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface Page<T> {
  data: T[];
  count: number;
}
