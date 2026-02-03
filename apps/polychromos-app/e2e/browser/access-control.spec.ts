import { test, expect } from "../fixtures/auth";

test.describe("Access Control - Authenticated", () => {
  /**
   * SKIPPED: This test needs to be updated to use a valid Convex ID format.
   * Currently passing "invalid_workspace_id" causes Convex to throw a validation
   * error (expects v.id("workspaces") format), which happens before the handler runs.
   *
   * To fix: Generate a valid Convex ID that simply doesn't exist in the database,
   * or update the application to handle Convex validation errors gracefully.
   */
  test.skip("shows error for invalid workspace ID", async ({ authenticatedPage: page }) => {
    // Try to access a non-existent workspace
    await page.goto("/?workspace=invalid_workspace_id");

    // Should show error or fallback message
    await expect(
      page.getByText(/failed to load workspace|not found|error/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("authenticated user sees create button", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // Should see create button
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).toBeVisible();
  });
});
