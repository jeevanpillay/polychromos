import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    globalSetup: ['./test/e2e/setup.ts'],
    testTimeout: 60000, // E2E tests need longer timeout
    hookTimeout: 120000, // Setup/teardown need even longer
    sequence: {
      concurrent: false, // Run E2E tests sequentially
    },
  },
});
