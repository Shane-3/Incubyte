import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Api } from '../api/endpoints';
import { ApiProvider } from './ApiContext';

export function AppProviders({
  api,
  queryClient,
  children,
}: {
  api: Api;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
}
