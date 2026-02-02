import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
  process.env.IS_TEST = 'true';
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  // Cleanup
});
