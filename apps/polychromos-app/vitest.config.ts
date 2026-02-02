import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['convex/**/*.test.ts', 'src/**/*.test.{ts,tsx}', 'e2e/**/*.test.ts'],
    passWithNoTests: true,
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['convex/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'convex/_generated/**'],
    },
  },
});
