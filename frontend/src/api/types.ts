export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Truck', 'Coupe', 'Convertible', 'Van', 'Electric'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  isWatching?: boolean;
}

export type VehicleInput = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>;

export type StockStatus = 'in' | 'low' | 'out';
export type SortField = 'make' | 'model' | 'category' | 'price' | 'quantity' | 'createdAt';

export interface VehicleQuery {
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  stock?: StockStatus;
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
