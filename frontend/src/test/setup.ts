import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Vitest loads .env.local like Vite does; blank the demo admin so a developer's file can't change test results.
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_ADMIN_EMAIL', '');
  vi.stubEnv('VITE_DEMO_ADMIN_PASSWORD', '');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
