import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    // Main test project
    {
      name: "chromium",
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
