import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project for authentication
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /global\.setup\.ts/,
    },
    // Tests that require unauthenticated state (no stored auth)
    {
      name: "unauthenticated",
      testDir: "./e2e/browser",
      testMatch: /\.unauth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // No storageState - fresh browser context
      },
    },
    // Main test project (authenticated)
    {
      name: "chromium",
      testDir: "./e2e/browser",
      testIgnore: /\.unauth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
    // Cross-platform tests (CLI + Web App)
    {
      name: "cross-platform",
      testDir: "./e2e/cross-platform",
      testMatch: /\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: process.env.CI
    ? {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120 * 1000,
      }
    : undefined, // Don't start server locally - assume it's already running
});
