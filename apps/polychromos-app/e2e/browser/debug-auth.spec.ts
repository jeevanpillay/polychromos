import { test, expect } from "../fixtures/auth";

test.describe("Debug Authentication", () => {
  test("verify authenticated page fixture works", async ({ authenticatedPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that we're authenticated
    const hasAuthenticated = await page
      .locator('[data-testid="authenticated"]')
      .isVisible()
      .catch(() => false);

    console.log("Page has authenticated element:", hasAuthenticated);

    // Check Clerk's client state
    const clerkState = await page.evaluate(() => {
      return {
        hasClerk: typeof (window as any).Clerk !== "undefined",
        isLoaded: (window as any).Clerk?.loaded,
        sessionId: (window as any).Clerk?.session?.id,
        userId: (window as any).Clerk?.user?.id,
      };
    });

    console.log("Clerk client state:", JSON.stringify(clerkState, null, 2));

    // Assert we're authenticated
    expect(hasAuthenticated).toBe(true);
    expect(clerkState.sessionId).toBeTruthy();
    expect(clerkState.userId).toBeTruthy();
  });
});
