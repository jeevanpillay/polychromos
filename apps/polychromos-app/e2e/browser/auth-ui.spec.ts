import { test, expect } from "../fixtures/auth";

test.describe("Authentication UI - Authenticated", () => {
  test("shows user button when authenticated", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // Should show user button (Clerk's UserButton component)
    await expect(page.locator(".cl-userButtonTrigger")).toBeVisible({
      timeout: 10000,
    });
  });

  test("can sign out", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // Click user button to open menu
    await page.locator(".cl-userButtonTrigger").click();

    // Click sign out
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should redirect to unauthenticated state with sign-in link
    await expect(
      page.getByTestId("sign-in-link"),
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
