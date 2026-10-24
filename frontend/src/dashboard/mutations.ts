import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import type { VehicleInput } from '../api/types';
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

export function useCreateVehicle() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (input: VehicleInput) => api.vehicles.create(input), onSuccess: invalidate });
}

export function useUpdateVehicle() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<VehicleInput> }) => api.vehicles.update(id, changes),
    onSuccess: invalidate,
  });
}

export function useRestock() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.vehicles.restock(id, quantity),
    onSuccess: invalidate,
  });
}

export function useDeleteVehicle() {
  const api = useApi();
  const invalidate = useInvalidateInventory();
  return useMutation({ mutationFn: (id: string) => api.vehicles.remove(id), onSuccess: invalidate });
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
