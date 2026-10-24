export const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Truck', 'Coupe', 'Convertible', 'Van', 'Electric'] as const;
export type Category = (typeof CATEGORIES)[number];

/** A paint option of a model. Stock is held per colour; colours share the model's SKU and price. */
export interface Colour {
  id: string;
  name: string;
  /** #rrggbb, lower case. */
  hex: string;
  quantity: number;
}

export type ColourInput = Pick<Colour, 'name' | 'hex'>;

/** A colour together with the units of it being added. */
export type ColourStock = ColourInput & { quantity: number };

/** The colour a model gets when none is given, so the original single-stock API keeps working. */
export const DEFAULT_COLOUR: ColourInput = { name: 'Standard', hex: '#8a8f98' };

export interface Vehicle {
  id: string;
  /** Generated from make and model at creation and never changed. */
  sku: string;
  make: string;
  model: string;
  category: Category;
  price: number;
  /** The model total: always the sum of its colours' stock. */
  quantity: number;
  colours: Colour[];
  createdAt: Date;
  updatedAt: Date;
}

/** A vehicle as one signed-in user sees it in lists. */
export type VehicleView = Vehicle & { isWatching: boolean };

/**
 * Stock to add. Either one colour holding all of `quantity`, several `colours` with their own units (summing to
 * `quantity`), or neither (one Standard colour).
 */
export type NewVehicle = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'> & {
  colour?: ColourInput;
  colours?: ColourStock[];
};

/** The per-colour stock a NewVehicle describes, whichever form it came in. */
export function stockByColour({ colour, colours, quantity }: NewVehicle): ColourStock[] {
  return colours ?? [{ ...(colour ?? DEFAULT_COLOUR), quantity }];
}
/** Model-level fields an edit may change. Colours and the SKU are not edited this way. */
export type VehicleChanges = Partial<Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>>;

export interface VehicleFilters {
  make?: string;
  model?: string;
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
  stock?: StockStatus;
  /** Partial colour-name match. */
  colour?: string;
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
