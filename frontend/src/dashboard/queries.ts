import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PurchaseQuery, VehicleQuery } from '../api/types';
import { useApi } from '../app/ApiContext';

export const queryKeys = {
  vehicles: (query: VehicleQuery) => ['vehicles', query] as const,
  allVehicles: ['vehicles'] as const,
  stats: ['stats'] as const,
  forecast: ['forecast'] as const,
  notifications: ['notifications'] as const,
  purchases: (query: PurchaseQuery) => ['purchases', query] as const,
  allPurchases: ['purchases'] as const,
};

export function useVehicles(query: VehicleQuery) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.vehicles(query),
    queryFn: () => api.vehicles.search(query),
    placeholderData: keepPreviousData,
  });
}

export function useStats() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.stats, queryFn: () => api.vehicles.stats() });
}

/** Admin-only: regular users never request sales data. */
export function useForecast(enabled: boolean) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.forecast, queryFn: () => api.vehicles.forecast(), enabled });
}

const PURCHASES_POLL_MS = 60_000;

/** Admin-only sales feed. Polls while open, so sales made elsewhere appear without a reload. */
export function usePurchases(query: PurchaseQuery) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.purchases(query),
    queryFn: () => api.purchases.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: PURCHASES_POLL_MS,
  });
}
