import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("global setup", async () => {
  await clerkSetup();
});

setup("authenticate", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Wait for Clerk to load
  await page.waitForLoadState("networkidle");

  // Click the Sign In button to open modal
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for Clerk modal
  await page.waitForSelector(".cl-modalContent", { timeout: 10000 });

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const username = process.env.E2E_CLERK_USER_USERNAME;
  if (!username) throw new Error("E2E_CLERK_USER_USERNAME not set");
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (!password) throw new Error("E2E_CLERK_USER_PASSWORD not set");

  // Check if email/password is available or just GitHub OAuth
  const emailInput = page.locator('input[name="identifier"]');
  const githubButton = page.locator('button:has-text("Continue with GitHub")');

  const hasEmailInput = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);

  if (hasEmailInput) {
    // Clerk email/password flow
    await emailInput.fill(username);
    await page.click('button:has-text("Continue")');

    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
    await page.fill('input[name="password"]', password);
    await page.click('button:has-text("Continue")');
  } else {
    // GitHub OAuth flow - click the button to redirect
    await githubButton.click();

    // Wait for GitHub login page
    await page.waitForURL(/github\.com/, { timeout: 10000 });

    // Fill GitHub login form
    await page.fill('input[name="login"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('input[type="submit"][value="Sign in"]');

    // Wait for OAuth authorization page and approve if needed
    try {
      await page.waitForURL(/github\.com.*authorize/, { timeout: 5000 });
      const authorizeButton = page.locator('button[name="authorize"]');
      if (await authorizeButton.isVisible({ timeout: 2000 })) {
        await authorizeButton.click();
      }
    } catch {
      // May already be authorized, continue
    }
  }

  // Wait for authentication to complete (redirect back to app)
  await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
    timeout: 30000,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
