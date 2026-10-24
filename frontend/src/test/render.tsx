import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';
import { type FakeApi, fakeApi } from './fake-api';

export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

/** Renders the whole app at a route, with a fake API. */
export function renderApp({ api = fakeApi(), route = '/' }: { api?: FakeApi; route?: string } = {}) {
  const user = userEvent.setup();
  const view = render(
    <AppProviders api={api as never} queryClient={testQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
  return { api, user, ...view };
}
