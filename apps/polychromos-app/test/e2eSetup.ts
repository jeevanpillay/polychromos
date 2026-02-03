import { chromium, Browser } from "@playwright/test";
import { spawn, ChildProcess, execSync } from "child_process";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { getTestConfig } from "./config";

export interface TestContext {
  browser: Browser | null;
  convexProcess: ChildProcess | null;
  webAppProcess: ChildProcess | null;
  token: string | null;
  cleanup: () => Promise<void>;
}

const config = getTestConfig();

// Test directories
export const TEST_BASE_DIR = "/tmp/polychromos-e2e";
export const TEST_AUTH_STATE = join(TEST_BASE_DIR, "auth-state.json");
export const TEST_TOKEN_FILE = join(TEST_BASE_DIR, "token.json");

/**
 * Start local Convex backend if not already running.
 */
export async function startConvexBackend(): Promise<ChildProcess | null> {
  // Check if already running
  try {
    const response = await fetch(`${config.convexBackendUrl}/version`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      console.log("[Test Setup] Convex backend already running");
      return null;
    }
  } catch {
    // Not running, start it
  }

  console.log("[Test Setup] Starting Convex backend...");

  const appDir = join(__dirname, "..");

  // Reset data first
  execSync("./scripts/local-backend.sh reset", { cwd: appDir, stdio: "pipe" });

  const proc = spawn("./scripts/local-backend.sh", ["run"], {
    cwd: appDir,
    stdio: "pipe",
    env: {
      ...process.env,
      CONVEX_BACKEND_PORT: String(config.convexBackendPort),
    },
  });

  // Wait for ready
  await waitForUrl(`${config.convexBackendUrl}/version`, 30000);
  console.log("[Test Setup] Convex backend ready");

  return proc;
}

/**
 * Deploy Convex schema and set test environment.
 */
export async function deployConvexSchema(): Promise<void> {
  const appDir = join(__dirname, "..");

  console.log("[Test Setup] Deploying Convex schema...");

  // Set test environment variables
  execSync("./scripts/local-backend.sh convex env set IS_TEST true", {
    cwd: appDir,
    stdio: "pipe",
  });

  if (process.env.CLERK_JWT_ISSUER_DOMAIN) {
    execSync(
      `./scripts/local-backend.sh convex env set CLERK_JWT_ISSUER_DOMAIN "${process.env.CLERK_JWT_ISSUER_DOMAIN}"`,
      { cwd: appDir, stdio: "pipe" }
    );
  }

  // Deploy schema
  execSync("./scripts/local-backend.sh convex deploy", {
    cwd: appDir,
    stdio: "inherit",
  });

  console.log("[Test Setup] Schema deployed");
}

/**
 * Start web app if not already running.
 */
export async function startWebApp(): Promise<ChildProcess | null> {
  // Check if already running
  try {
    const response = await fetch(config.webAppUrl, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok || response.status === 302) {
      console.log("[Test Setup] Web app already running");
      return null;
    }
  } catch {
    // Not running, start it
  }

  console.log("[Test Setup] Starting web app...");

  const appDir = join(__dirname, "..");
  const cmd = process.env.CI ? "pnpm exec vite dev" : "pnpm dev:web";

  const proc = spawn("sh", ["-c", cmd], {
    cwd: appDir,
    stdio: "pipe",
    env: {
      ...process.env,
      VITE_CONVEX_URL: config.convexBackendUrl,
      PORT: String(config.webAppPort),
    },
  });

  // Wait for ready
  await waitForUrl(config.webAppUrl, 60000);
  console.log("[Test Setup] Web app ready");

  return proc;
}

/**
 * Extract Clerk token from authenticated browser session.
 */
export async function extractClerkToken(browser: Browser): Promise<string> {
  const page = await browser.newPage({
    storageState: TEST_AUTH_STATE,
  });

  try {
    await page.goto(config.webAppUrl);
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    const token = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1000));

      if (!window.Clerk?.session) {
        throw new Error("Clerk not initialized");
      }

      return window.Clerk.session.getToken({ template: "polychromos-cli" });
    });

    if (!token) {
      throw new Error("Failed to extract Clerk token");
    }

    return token;
  } finally {
    await page.close();
  }
}

/**
 * Authenticate via Clerk UI and save storage state.
 */
export async function authenticateClerk(browser: Browser): Promise<void> {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set");
  }

  console.log("[Test Setup] Authenticating with Clerk...");

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${config.webAppUrl}/sign-in`);
  await page.waitForLoadState("networkidle");

  // Fill email
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Wait for password step and fill
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for authentication
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  // Save storage state
  await mkdir(TEST_BASE_DIR, { recursive: true });
  await context.storageState({ path: TEST_AUTH_STATE });

  console.log("[Test Setup] Authentication complete");

  await page.close();
  await context.close();
}

/**
 * Wait for URL to respond.
 */
async function waitForUrl(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status === 302) {
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Timeout waiting for ${url}`);
}

/**
 * Full test setup - starts all services and authenticates.
 */
export async function setupTestEnvironment(): Promise<TestContext> {
  await mkdir(TEST_BASE_DIR, { recursive: true });

  const convexProcess = await startConvexBackend();
  await deployConvexSchema();
  const webAppProcess = await startWebApp();

  const browser = await chromium.launch();
  await authenticateClerk(browser);

  const token = await extractClerkToken(browser);
  await writeFile(TEST_TOKEN_FILE, JSON.stringify({ token }));

  return {
    browser,
    convexProcess,
    webAppProcess,
    token,
    cleanup: async () => {
      await browser?.close();
      convexProcess?.kill("SIGTERM");
      webAppProcess?.kill("SIGTERM");
      await rm(TEST_BASE_DIR, { recursive: true, force: true });
    },
  };
}

// Note: Clerk types are defined globally by @clerk/clerk-react
