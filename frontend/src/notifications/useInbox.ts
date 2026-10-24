import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApi } from '../app/ApiContext';
import { queryKeys } from '../dashboard/queries';

export const POLL_INTERVAL_MS = 30_000;

const isVisible = () => document.visibilityState !== 'hidden';

/**
 * In-app delivery (design.md 5A): poll about every 30 seconds while the tab is visible, stop while it is hidden,
 * and catch up as soon as it is shown again. A failed poll keeps the last known data and is retried next time.
 */
export function useInbox() {
  const api = useApi();
  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.notifications.list(false),
    refetchInterval: () => (isVisible() ? POLL_INTERVAL_MS : false),
    refetchIntervalInBackground: false,
    retry: false,
  });

  const { refetch } = query;
  useEffect(() => {
    const onVisibility = () => {
      if (isVisible()) void refetch();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refetch]);

  return query;
}

export function useMarkRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllRead() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
