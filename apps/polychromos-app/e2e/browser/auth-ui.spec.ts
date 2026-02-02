import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Authentication UI", () => {
  test("shows sign-in button when unauthenticated", async ({ page }) => {
    // Don't use stored auth state for this test
    await page.goto("/");

    // Clear any existing auth
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Should show sign-in button
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows user button when authenticated", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // Should show user button (Clerk's UserButton component)
    await expect(page.locator(".cl-userButtonTrigger")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can sign out", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // Click user button to open menu
    await page.locator(".cl-userButtonTrigger").click();

    // Click sign out
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should redirect to sign-in state
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
