import { test as base, type Page } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
};

/**
 * Custom fixture that provides an authenticated page.
 *
 * This fixture performs authentication once per worker and reuses
 * the same browser context across all tests in that worker. This avoids
 * the storage state issue where Clerk sessions don't hydrate properly
 * when loaded from saved state.
 *
 * The authentication is lazy - it only happens when a test actually
 * uses the authenticatedPage fixture.
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    // Create a new browser context for this worker
    const context = await browser.newContext();
    const page = await context.newPage();

    const email = process.env.E2E_CLERK_USER_EMAIL;
    const password = process.env.E2E_CLERK_USER_PASSWORD;

    if (!email || !password) {
      throw new Error("E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set");
    }

    // Perform authentication
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Fill email step
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    // Fill password step
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for authentication to complete
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    // Provide the authenticated page to the test
    await use(page);

    // Cleanup
    await context.close();
  },
});

export { expect } from "@playwright/test";
