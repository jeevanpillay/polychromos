import { test, expect } from "@playwright/test";

test.describe("Authentication UI - Unauthenticated", () => {
  test("shows sign-in button when unauthenticated", async ({ page }) => {
    // Navigate to app without any auth state
    await page.goto("/");

    // Wait for Clerk to load
    await page.waitForLoadState("networkidle");

    // Should show sign-in button
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible({ timeout: 10000 });

    // Should NOT show authenticated content
    await expect(page.locator("[data-testid='authenticated']")).not.toBeVisible();
  });
});
