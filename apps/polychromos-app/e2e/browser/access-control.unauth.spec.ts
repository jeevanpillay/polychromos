import { test, expect } from "@playwright/test";

test.describe("Access Control - Unauthenticated", () => {
  test("unauthenticated user cannot create workspace", async ({ page }) => {
    // Navigate to app without any auth state
    await page.goto("/");

    // Wait for Clerk to load
    await page.waitForLoadState("networkidle");

    // Should see sign-in button
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible({ timeout: 10000 });

    // Should NOT see create button
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).not.toBeVisible();
  });
});
