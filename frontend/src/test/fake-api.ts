import type { Mock } from 'vitest';
import type { Api } from '../api/endpoints';
import type { Inbox, InventoryStats, Page, User, Vehicle } from '../api/types';

type Fn = (...args: never[]) => unknown;
type Fake<T> = { [K in keyof T]: T[K] extends Fn ? Mock<T[K]> : Fake<T[K]> };
export type FakeApi = Fake<Api>;

export const priya: User = { id: 'u-priya', name: 'Priya Nair', email: 'priya.nair@example.com', role: 'user' };
export const dana: User = { id: 'u-dana', name: 'Dana Okafor', email: 'dana.okafor@example.com', role: 'admin' };

/**
 * A vehicle fixture. Unless colours are given, it has one Standard colour holding all its stock; with colours, the
 * quantity is their sum, as the API guarantees.
 */
export function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const id = overrides.id ?? 'v-camry';
  const make = overrides.make ?? 'Toyota';
  const model = overrides.model ?? 'Camry';
  const colours = overrides.colours ?? [
    { id: `${id}-standard`, name: 'Standard', hex: '#8a8f98', quantity: overrides.quantity ?? 6 },
  ];
  return {
    id,
    sku: `${make.slice(0, 3).toUpperCase()}-${model.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
    make,
    model,
    category: 'Sedan',
    price: 28400,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    isWatching: false,
    ...overrides,
    colours,
    quantity: colours.reduce((sum, c) => sum + c.quantity, 0),
  };
}

export const emptyStats: InventoryStats = { models: 0, units: 0, inventoryValue: 0, outOfStock: 0, lowStock: 0 };
export const emptyInbox: Inbox = { data: [], unreadCount: 0 };

const unstubbed = (name: string) =>
  vi.fn(() => Promise.reject(new Error(`fake api: ${name} was called but not stubbed`)));

/** Every endpoint is a vi.fn. Session restore fails by default (signed out). */
export function fakeApi(): FakeApi {
  const page: Page<Vehicle> = { data: [], count: 0 };
  return {
    auth: {
      me: unstubbed('auth.me'),
      login: unstubbed('auth.login'),
      register: unstubbed('auth.register'),
      logout: vi.fn(() => Promise.resolve()),
    },
    vehicles: {
      search: vi.fn(() => Promise.resolve(page)),
      stats: vi.fn(() => Promise.resolve(emptyStats)),
      forecast: unstubbed('vehicles.forecast'),
      create: unstubbed('vehicles.create'),
      update: unstubbed('vehicles.update'),
      remove: unstubbed('vehicles.remove'),
      purchase: unstubbed('vehicles.purchase'),
      restock: unstubbed('vehicles.restock'),
      watch: unstubbed('vehicles.watch'),
      unwatch: unstubbed('vehicles.unwatch'),
    },
    purchases: {
      list: unstubbed('purchases.list'),
    },
    notifications: {
      list: vi.fn(() => Promise.resolve(emptyInbox)),
      markRead: unstubbed('notifications.markRead'),
      markAllRead: unstubbed('notifications.markAllRead'),
    },
  } as unknown as FakeApi;
}
