import { defineConfig, devices } from "@playwright/test";

const webAppPort = process.env.WEB_APP_PORT || "3001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${webAppPort}`;

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
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      testDir: "./e2e/browser",
      testMatch: /\.unauth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testDir: "./e2e/browser",
      testIgnore: /\.unauth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "cross-platform",
      testDir: "./e2e/cross-platform",
      testMatch: /\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  // webServer is now managed by e2eRunner.cjs
  // This allows consistent behavior between CI and local
});
