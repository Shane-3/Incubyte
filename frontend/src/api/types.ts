export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Truck', 'Coupe', 'Convertible', 'Van', 'Electric'] as const;
export type Category = (typeof CATEGORIES)[number];

/** A paint option. Stock is held per colour; colours share the model's SKU and price. */
export interface Colour {
  id: string;
  name: string;
  /** #rrggbb */
  hex: string;
  quantity: number;
}

export type ColourInput = Pick<Colour, 'name' | 'hex'>;

export interface Vehicle {
  id: string;
  sku: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  /** Model total: the sum of its colours. */
  quantity: number;
  colours: Colour[];
  createdAt: string;
  updatedAt: string;
  isWatching?: boolean;
}

/** Model-level fields an edit may change. */
export type VehicleInput = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>;

/** Adding stock: a new model, or (same make + model) a colour of an existing one. */
export type NewVehicleInput = VehicleInput & { colour?: ColourInput };

export interface CreateResult {
  vehicle: Vehicle;
  /** True when the colour joined an existing model. */
  merged: boolean;
}

export type StockStatus = 'in' | 'low' | 'out';
export type SortField = 'make' | 'model' | 'category' | 'price' | 'quantity' | 'createdAt';

export interface VehicleQuery {
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  stock?: StockStatus;
  colour?: string;
  sort?: SortField;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface Page<T> {
  data: T[];
  count: number;
}

export interface InventoryStats {
  models: number;
  units: number;
  inventoryValue: number;
  outOfStock: number;
  lowStock: number;
}

export interface VehicleForecast {
  vehicleId: string;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  atRisk: boolean;
  suggestedRestock: number;
}

export interface ForecastReport {
  data: VehicleForecast[];
  windowDays: number;
  atRiskDays: number;
}

export type NotificationType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'BACK_IN_STOCK';

export interface AppNotification {
  id: string;
  type: NotificationType;
  vehicle: { id: string; make: string; model: string };
  quantity: number;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface Inbox {
  data: AppNotification[];
  unreadCount: number;
}
