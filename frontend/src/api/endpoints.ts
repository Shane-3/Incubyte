import type { ApiClient } from './client';
import type {
  ForecastReport,
  Inbox,
  InventoryStats,
  Page,
  User,
  Vehicle,
  VehicleInput,
  VehicleQuery,
} from './types';

/** Typed wrappers over the REST API. Components reach these through useApi(), so tests can swap in fakes. */
export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      me: () => client.get<{ user: User }>('/auth/me', undefined, { handleUnauthorized: false }).then((r) => r.user),
      login: (email: string, password: string) =>
        client
          .post<{ user: User }>('/auth/login', { email, password }, { handleUnauthorized: false })
          .then((r) => r.user),
      register: (name: string, email: string, password: string) =>
        client.post<{ user: User }>('/auth/register', { name, email, password }).then((r) => r.user),
      logout: () => client.post<void>('/auth/logout', undefined, { handleUnauthorized: false }),
    },
    vehicles: {
      search: (query: VehicleQuery) => client.get<Page<Vehicle>>('/vehicles/search', { ...query }),
      stats: () => client.get<InventoryStats>('/vehicles/stats'),
      forecast: () => client.get<ForecastReport>('/vehicles/forecast'),
      create: (input: VehicleInput) => client.post<{ vehicle: Vehicle }>('/vehicles', input).then((r) => r.vehicle),
      update: (id: string, changes: Partial<VehicleInput>) =>
        client.put<{ vehicle: Vehicle }>(`/vehicles/${id}`, changes).then((r) => r.vehicle),
      remove: (id: string) => client.del<void>(`/vehicles/${id}`),
      purchase: (id: string, quantity: number) =>
        client.post<{ vehicle: Vehicle }>(`/vehicles/${id}/purchase`, { quantity }).then((r) => r.vehicle),
      restock: (id: string, quantity: number) =>
        client.post<{ vehicle: Vehicle }>(`/vehicles/${id}/restock`, { quantity }).then((r) => r.vehicle),
      watch: (id: string) => client.post<{ watching: boolean }>(`/vehicles/${id}/watch`),
      unwatch: (id: string) => client.del<void>(`/vehicles/${id}/watch`),
    },
    notifications: {
      list: (unreadOnly = false) => client.get<Inbox>('/notifications', { unread: unreadOnly, limit: 20 }),
      markRead: (id: string) => client.post<unknown>(`/notifications/${id}/read`),
      markAllRead: () => client.post<{ updated: number }>('/notifications/read-all'),
    },
  };
}

export type Api = ReturnType<typeof createEndpoints>;
