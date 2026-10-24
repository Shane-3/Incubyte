import type { NewVehicle } from '../../src/types/vehicle';

export function buildVehicle(overrides: Partial<NewVehicle> = {}): NewVehicle {
  return { make: 'Toyota', model: 'Camry', category: 'Sedan', price: 27999, quantity: 5, ...overrides };
}

/** A small, realistic lot used by search tests. */
export const LOT: NewVehicle[] = [
  buildVehicle({ make: 'Toyota', model: 'Camry', category: 'Sedan', price: 27999, quantity: 5 }),
  buildVehicle({ make: 'Toyota', model: 'RAV4', category: 'SUV', price: 31500, quantity: 2 }),
  buildVehicle({ make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 22050, quantity: 0 }),
  buildVehicle({ make: 'Honda', model: 'Civic', category: 'Sedan', price: 24650, quantity: 7 }),
  buildVehicle({ make: 'Ford', model: 'F-150', category: 'Truck', price: 38999.99, quantity: 3 }),
  buildVehicle({ make: 'Tesla', model: 'Model 3', category: 'Electric', price: 42490, quantity: 4 }),
];
