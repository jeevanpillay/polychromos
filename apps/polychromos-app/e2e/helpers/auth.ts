import type { Page } from "@playwright/test";

/**
 * Wait for authentication to be fully established.
 * Waits for both Clerk session and Convex auth state.
 *
 * With the improved storage state setup (waiting for Clerk session to fully
 * initialize before saving), this should work reliably without fallback sign-in.
 */
export async function waitForAuth(page: Page, timeout = 30000): Promise<void> {
  // Wait for auth state to be determined
  await page.waitForFunction(
    () => {
      const hasAuth = document.querySelector('[data-testid="authenticated"]');
      const hasUnauth = document.querySelector('[data-testid="unauthenticated"]');
      return hasAuth !== null || hasUnauth !== null;
    },
    { timeout: Math.min(timeout, 15000) }
  );

  // Check if authenticated
  const isAuthenticated = await page
    .locator('[data-testid="authenticated"]')
    .isVisible()
    .catch(() => false);

  if (!isAuthenticated) {
    // Storage state didn't work - this shouldn't happen with the improved setup
    // but if it does, throw a clear error
    throw new Error(
      "Authentication failed: Storage state did not establish authenticated session. " +
      "This indicates the global setup may not have saved Clerk session properly."
    );
  }
}
