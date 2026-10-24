import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles/index.css';
import { QueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createApiClient } from './api/client';
import { createEndpoints } from './api/endpoints';
import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './app/AppRoutes';
import { SESSION_EXPIRED_EVENT } from './auth/AuthProvider';

const api = createEndpoints(
  createApiClient({ onUnauthorized: () => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)) }),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders api={api} queryClient={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
