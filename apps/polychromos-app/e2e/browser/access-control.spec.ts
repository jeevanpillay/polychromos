import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Access Control", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("shows error for invalid workspace ID", async ({ page }) => {
    // Try to access a non-existent workspace
    await page.goto("/?workspace=invalid_workspace_id");

    // Should show error or fallback message
    await expect(
      page.getByText(/failed to load workspace|not found|error/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated user cannot create workspace", async ({ page }) => {
    // Clear auth and go to app
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Should not see create button, should see sign-in
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).not.toBeVisible();
  });

  test("authenticated user sees create button", async ({ page }) => {
    await page.goto("/");

    // Should see authenticated content with create button
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).toBeVisible();
  });
});
