import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      './packages/polychromos/vitest.config.ts',
      './packages/polychromos-types/vitest.config.ts',
      './apps/polychromos-app/vitest.config.ts',
    ],
  },
});
