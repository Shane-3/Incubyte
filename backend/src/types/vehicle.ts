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

export type NewVehicle = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>;
export type VehicleChanges = Partial<NewVehicle>;

export interface VehicleFilters {
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
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
