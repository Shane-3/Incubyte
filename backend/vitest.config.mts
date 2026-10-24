import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/load-env.ts'],
    // Integration tests share one Postgres database, so files run one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/types/**'],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
    },
  },
});
