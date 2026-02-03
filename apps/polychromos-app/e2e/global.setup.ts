import { test as setup } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("clerk setup", async () => {
  await clerkSetup();
});

setup("authenticate", async ({ page }) => {
  // Create auth directory
  await mkdir(path.dirname(authFile), { recursive: true });

  // Navigate to sign-in page
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email) throw new Error("E2E_CLERK_USER_EMAIL not set");
  if (!password) throw new Error("E2E_CLERK_USER_PASSWORD not set");

  // Fill email step
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Fill password step
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for authentication
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  // Save storage state
  await page.context().storageState({ path: authFile });
});
