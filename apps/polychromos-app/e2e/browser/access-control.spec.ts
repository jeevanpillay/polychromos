import { test, expect } from "@playwright/test";
import { waitForAuth } from "../helpers/auth";

test.describe("Access Control - Authenticated", () => {
  // Authentication handled by global.setup.ts and storageState

  test("shows error for invalid workspace ID", async ({ page }) => {
    // Try to access a non-existent workspace
    await page.goto("/?workspace=invalid_workspace_id");
    await waitForAuth(page);

    // Should show error or fallback message
    await expect(
      page.getByText(/failed to load workspace|not found|error/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("authenticated user sees create button", async ({ page }) => {
    await page.goto("/");
    await waitForAuth(page);

    // Should see create button
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create new design/i }),
    ).toBeVisible();
  });
});
