import { test, expect } from "../fixtures/auth";

test.describe("Authenticated Workspace Flow", () => {
  test("can create a new workspace", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // Click create workspace button
    await page.getByRole("button", { name: /create new design/i }).click();

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/workspace=/);

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    expect(workspaceId).toBeTruthy();
  });

  test("workspace persists after page reload", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");

    // Reload page
    await page.reload();

    // Wait for page to reload
    await page.waitForLoadState("networkidle");

    // Should still have same workspace in URL
    const newUrl = new URL(page.url());
    expect(newUrl.searchParams.get("workspace")).toBe(workspaceId);

    // Verify still authenticated after reload
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });
  });

  test("workspace preview shows after creation", async ({ authenticatedPage: page }) => {
    await page.goto("/");

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
