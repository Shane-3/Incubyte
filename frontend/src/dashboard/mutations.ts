import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { useApi } from '../app/ApiContext';
import { queryKeys } from './queries';

/** After any write, refresh everything a stock change can affect. */
export function useInvalidateInventory() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.allVehicles }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.forecast }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    ]);
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

export function usePurchase() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.vehicles.purchase(id, quantity),
    onSettled: invalidate,
  });
}

export function useWatchToggle() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, watch }: { id: string; watch: boolean }) =>
      watch ? api.vehicles.watch(id).then(() => undefined) : api.vehicles.unwatch(id),
    onSettled: invalidate,
  });
}
