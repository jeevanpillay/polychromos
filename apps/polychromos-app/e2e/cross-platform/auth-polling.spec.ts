import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_BACKEND_URL || "http://127.0.0.1:3210";

test.describe("CLI Auth Polling Flow", () => {
  let convexClient: ConvexHttpClient;

  test.beforeAll(() => {
    convexClient = new ConvexHttpClient(CONVEX_URL);
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("CLI can create session and poll for token", async ({ page }) => {
    const testCode = `pol_test_${Date.now()}`;

    // Step 1: CLI creates pending session (no auth required)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await convexClient.mutation(api.cliAuth.createSession as any, { code: testCode });

    // Verify session is pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = await convexClient.query(api.cliAuth.getSession as any, { code: testCode }) as { status: string };
    expect(pending.status).toBe("pending");

    // Step 2: User navigates to /cli-auth in browser
    await page.goto(`/cli-auth?code=${testCode}`);

    // Wait for sign-in form
    await page.waitForSelector('input[type="email"]');

    // Fill in credentials
    const email = process.env.E2E_CLERK_USER_EMAIL!;
    const password = process.env.E2E_CLERK_USER_PASSWORD!;

    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for success
    await page.waitForSelector("text=CLI Authenticated", { timeout: 30000 });

    // Step 3: CLI polls and gets token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completed = await convexClient.query(api.cliAuth.getSession as any, { code: testCode }) as { status: string; token?: string; expiresAt?: number };
    expect(completed.status).toBe("completed");
    expect(completed.token).toBeTruthy();
    expect(completed.expiresAt).toBeGreaterThan(Date.now());
  });

  test("Session expires after timeout", async () => {
    const testCode = `pol_expire_${Date.now()}`;

    // Create session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await convexClient.mutation(api.cliAuth.createSession as any, { code: testCode });

    // Wait a bit and check - should still be pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = await convexClient.query(api.cliAuth.getSession as any, { code: testCode }) as { status: string };
    expect(pending.status).toBe("pending");

    // Note: Full timeout test would need mocked time
    // This test verifies the basic flow works
  });

  test("Invalid code shows error message", async ({ page }) => {
    await page.goto("/cli-auth?code=invalid_code_12345");

    // Try to sign in
    await page.waitForSelector('input[type="email"]');

    const email = process.env.E2E_CLERK_USER_EMAIL!;
    const password = process.env.E2E_CLERK_USER_PASSWORD!;

    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should show error since session doesn't exist in Convex
    await page.waitForSelector("text=Authentication Failed", { timeout: 30000 });
  });

  test("Duplicate code is rejected", async () => {
    const testCode = `pol_dup_${Date.now()}`;

    // Create first session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await convexClient.mutation(api.cliAuth.createSession as any, { code: testCode });

    // Attempt to create duplicate
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convexClient.mutation(api.cliAuth.createSession as any, { code: testCode })
    ).rejects.toThrow("Session code already exists");
  });
});
