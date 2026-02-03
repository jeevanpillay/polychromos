import type { Page } from "@playwright/test";

/**
 * Sign in if not already authenticated.
 * Works around storage state issues by doing actual sign-in.
 */
export async function ensureAuthenticated(page: Page): Promise<void> {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set");
  }

  // Wait for auth state to be determined
  await page.waitForFunction(
    () => {
      const hasAuth = document.querySelector('[data-testid="authenticated"]');
      const hasUnauth = document.querySelector('[data-testid="unauthenticated"]');
      return hasAuth !== null || hasUnauth !== null;
    },
    { timeout: 10000 }
  );

  // Check if already authenticated
  const isAuthenticated = await page
    .locator('[data-testid="authenticated"]')
    .isVisible()
    .catch(() => false);

  if (isAuthenticated) {
    // Already authenticated via storage state
    return;
  }

  // Not authenticated, need to sign in
  console.log("Storage state auth failed, performing sign-in...");

  // Go to sign-in page
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  // Fill email
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Fill password
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for authentication to complete
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });
}

/**
 * Wait for authentication to be fully established.
 * This includes both Clerk session and Convex auth state.
 */
export async function waitForAuth(page: Page, timeout = 30000): Promise<void> {
  await ensureAuthenticated(page);
}
