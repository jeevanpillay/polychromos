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

  const email = process.env.E2E_CLERK_USER_EMAIL;
  if (!email) throw new Error("E2E_CLERK_USER_EMAIL not set");
  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (!password) throw new Error("E2E_CLERK_USER_PASSWORD not set");

  // Clerk two-step email/password flow
  // Step 1: Enter email and click Continue
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Step 2: Enter password and click Continue
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  const passwordInput = page.getByRole("textbox", { name: /password/i });
  await passwordInput.fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for authentication to complete (redirect back to app)
  await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
    timeout: 30000,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
