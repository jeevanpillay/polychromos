import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Authenticated Workspace Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("can create a new workspace", async ({ page }) => {
    await page.goto("/");

    // Should see authenticated content
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible();

    // Click create workspace button
    await page.getByRole("button", { name: /create new design/i }).click();

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/workspace=/);

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    expect(workspaceId).toBeTruthy();
  });

  test("workspace persists after page reload", async ({ page }) => {
    await page.goto("/");

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");

    // Reload page
    await page.reload();

    // Should still have same workspace in URL
    const newUrl = new URL(page.url());
    expect(newUrl.searchParams.get("workspace")).toBe(workspaceId);
  });

  test("workspace preview shows after creation", async ({ page }) => {
    await page.goto("/");

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    // Should see the workspace name and version controls
    await expect(page.getByText(/new design|untitled design/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
