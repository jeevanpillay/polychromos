import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import path from "path";

test.describe("Debug Authentication", () => {
  test("check storage state file exists", async () => {
    const storageStatePath = path.join(
      process.cwd(),
      "playwright/.clerk/user.json"
    );
    console.log("Checking storage state at:", storageStatePath);
    console.log("File exists:", existsSync(storageStatePath));

    if (existsSync(storageStatePath)) {
      const content = readFileSync(storageStatePath, "utf-8");
      const state = JSON.parse(content);
      console.log("Storage state cookies count:", state.cookies?.length || 0);
      console.log(
        "Has __session cookie:",
        state.cookies?.some((c: any) => c.name === "__session")
      );
      console.log(
        "Has __clerk_db_jwt cookie:",
        state.cookies?.some((c: any) => c.name === "__clerk_db_jwt")
      );
    }

    expect(existsSync(storageStatePath)).toBe(true);
  });

  test("check page loads with storage state", async ({ page }) => {
    console.log("Navigating to /...");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Log what we see on the page
    const hasUnauthenticated = await page
      .locator('[data-testid="unauthenticated"]')
      .isVisible()
      .catch(() => false);
    const hasAuthenticated = await page
      .locator('[data-testid="authenticated"]')
      .isVisible()
      .catch(() => false);

    console.log("Page has unauthenticated element:", hasUnauthenticated);
    console.log("Page has authenticated element:", hasAuthenticated);

    // Log cookies in the browser
    const cookies = await page.context().cookies();
    console.log("Browser cookies count:", cookies.length);
    console.log(
      "Has __session cookie in browser:",
      cookies.some((c) => c.name === "__session")
    );
    console.log(
      "Has __clerk_db_jwt cookie in browser:",
      cookies.some((c) => c.name === "__clerk_db_jwt")
    );

    // Take a screenshot for debugging
    await page.screenshot({ path: "debug-auth-state.png", fullPage: true });
    console.log("Screenshot saved to debug-auth-state.png");

    // This test just reports state, doesn't assert
    console.log("=== Debug test complete ===");
  });

  test("verify Clerk client state", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

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
  });
});
