import { test, expect } from "@playwright/test";
import { waitForAuth } from "../helpers/auth";

test.describe("Authenticated Workspace Flow", () => {
  // Authentication handled by global.setup.ts and storageState

  test("can create a new workspace", async ({ page }) => {
    await page.goto("/");
    await waitForAuth(page);

    // Click create workspace button
    await page.getByRole("button", { name: /create new design/i }).click();

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/workspace=/);

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    expect(workspaceId).toBeTruthy();
  });

  /**
   * KNOWN ISSUE: This test is skipped because Clerk's testing token mechanism
   * does not persist properly after page reload/navigation.
   *
   * The issue is that:
   * 1. setupClerkTestingToken() sets up a testing token for Clerk's bot detection bypass
   * 2. After page.reload() or page.goto(), the token is lost
   * 3. Even though cookies persist (__clerk_db_jwt, __session, etc.), Clerk's client
   *    doesn't recognize the session without the testing token
   * 4. This causes the page to render in Unauthenticated state after reload
   *
   * Potential solutions to investigate:
   * - Use clerk.signIn() from @clerk/testing/playwright instead of storage state
   * - Investigate if there's a way to persist the testing token across navigations
   * - Check if this is a known limitation of @clerk/testing library
   *
   * Related: https://clerk.com/docs/guides/development/testing/playwright
   */
  test.skip("workspace persists after page reload", async ({ page }) => {
    await page.goto("/");

    // Wait for authenticated content
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");

    // Reload page
    await page.reload();

    // Wait for auth to re-establish after reload
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Should still have same workspace in URL
    const newUrl = new URL(page.url());
    expect(newUrl.searchParams.get("workspace")).toBe(workspaceId);
  });

  test("workspace preview shows after creation", async ({ page }) => {
    await page.goto("/");
    await waitForAuth(page);

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    // Should see the workspace name heading
    await expect(
      page.getByRole("heading", { name: /new design|untitled design/i }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});
