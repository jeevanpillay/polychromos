import { beforeAll, afterAll } from 'vitest';

// Global setup for all tests
beforeAll(() => {
  process.env.IS_TEST = 'true';
});

afterAll(() => {
  // Cleanup
});
