/**
 * CLI E2E Test Setup
 *
 * This setup integrates with the existing Playwright E2E infrastructure.
 * It requires the Playwright auth setup to have run first, which authenticates
 * with Clerk and saves the session state.
 *
 * Flow:
 * 1. Playwright setup runs (with E2E_CLERK_USER_EMAIL/PASSWORD env vars)
 * 2. Auth state saved to apps/polychromos-app/playwright/.clerk/user.json
 * 3. This CLI E2E setup loads that auth state and extracts a Convex token
 * 4. CLI tests use the token to make authenticated requests
 *
 * To run locally:
 * 1. Copy .env.test.example to .env.test in apps/polychromos-app
 * 2. Fill in E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD
 * 3. Run: pnpm --filter polychromos-app exec playwright test --project=setup
 * 4. Then run: pnpm --filter polychromos test:e2e
 */

import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcess } from 'child_process';
import { mkdir, writeFile, rm, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration from environment
const CONVEX_BACKEND_URL = process.env.CONVEX_BACKEND_URL || 'http://127.0.0.1:3210';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3001';

let browser: Browser | null = null;
let convexProcess: ChildProcess | null = null;

// Test workspace directory
export const TEST_WORKSPACE_DIR = join(tmpdir(), 'polychromos-e2e-test');
export const TEST_CREDENTIALS_DIR = join(TEST_WORKSPACE_DIR, '.polychromos-home');

// Path to Playwright auth state (created by polychromos-app E2E setup)
const PLAYWRIGHT_AUTH_STATE = join(
  __dirname,
  '../../../../apps/polychromos-app/playwright/.clerk/user.json'
);

// File to share token between setup and test processes
const TOKEN_FILE = join(tmpdir(), 'polychromos-e2e-token.json');

// Store the extracted token for tests to use
let extractedToken: string | null = null;

export function getExtractedToken(): string {
  // First check environment variable
  if (process.env.POLYCHROMOS_TOKEN) {
    return process.env.POLYCHROMOS_TOKEN;
  }

  // Then check cached value
  if (extractedToken) {
    return extractedToken;
  }

  // Finally, try to read from shared file (for cross-process communication)
  try {
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    if (data.token) {
      extractedToken = data.token;
      process.env.POLYCHROMOS_TOKEN = data.token;
      return data.token;
    }
  } catch {
    // File doesn't exist or is invalid
  }

  throw new Error('Token not extracted. Setup must run first.');
}

export async function setup() {
  console.log('[CLI E2E Setup] Starting...');

  // 1. Check for POLYCHROMOS_TOKEN env var first (CI or manual override)
  const envToken = process.env.POLYCHROMOS_TOKEN;
  if (envToken) {
    console.log('[CLI E2E Setup] Using POLYCHROMOS_TOKEN from environment');
    extractedToken = envToken;
  } else {
    // 2. Check if Playwright auth state exists
    try {
      await access(PLAYWRIGHT_AUTH_STATE);
    } catch {
      throw new Error(
        `Playwright auth state not found at ${PLAYWRIGHT_AUTH_STATE}\n` +
          'Please run the Playwright setup first:\n' +
          '  1. Ensure E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD are set\n' +
          '  2. Run: pnpm --filter polychromos-app exec playwright test --project=setup\n' +
          '  3. Then run CLI E2E tests again'
      );
    }

    // 3. Start local Convex backend
    await startLocalConvex();

    // 4. Wait for web app to be ready
    await waitForWebApp();

    // 5. Launch browser and extract token
    console.log('[CLI E2E Setup] Extracting Convex token from authenticated session...');
    browser = await chromium.launch();

    try {
      extractedToken = await extractClerkToken(browser);
      console.log('[CLI E2E Setup] Successfully extracted Convex token');
    } catch (error) {
      console.error('[CLI E2E Setup] Failed to extract token:', error);
      console.error('[CLI E2E Setup] The saved Clerk session may have expired.');
      console.error('[CLI E2E Setup] Please re-run Playwright setup:');
      console.error('  pnpm --filter polychromos-app exec playwright test --project=setup');
      throw error;
    }
  }

  // 6. Ensure Convex backend is running
  await startLocalConvex();

  // 7. Save token for CLI tests
  await setupCLICredentials(extractedToken);

  // 8. Create test workspace directory
  await mkdir(TEST_WORKSPACE_DIR, { recursive: true });

  // 9. Write token to shared file for cross-process communication
  await writeFile(TOKEN_FILE, JSON.stringify({ token: extractedToken }));

  // Set environment variable for tests
  process.env.POLYCHROMOS_TOKEN = extractedToken;

  console.log('[CLI E2E Setup] Complete');
}

export async function teardown() {
  console.log('[CLI E2E Teardown] Starting...');

  // Cleanup browser
  if (browser) {
    await browser.close();
  }

  // Stop Convex backend if we started it
  if (convexProcess) {
    convexProcess.kill('SIGTERM');
  }

  // Clean up test directories
  try {
    await rm(TEST_WORKSPACE_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Clean up token file
  try {
    await rm(TOKEN_FILE, { force: true });
  } catch {
    // Ignore cleanup errors
  }

  console.log('[CLI E2E Teardown] Complete');
}

async function startLocalConvex(): Promise<void> {
  // Check if backend already running
  try {
    const response = await fetch(`${CONVEX_BACKEND_URL}/version`);
    if (response.ok || response.status === 200) {
      console.log('[CLI E2E Setup] Local Convex backend already running');
      return;
    }
  } catch {
    // Not running, need to start it
  }

  console.log('[CLI E2E Setup] Starting local Convex backend...');

  return new Promise((resolve, reject) => {
    const polychromosAppDir = join(__dirname, '../../../../apps/polychromos-app');

    convexProcess = spawn('npx', ['convex', 'dev'], {
      cwd: polychromosAppDir,
      stdio: 'pipe',
      detached: false,
    });

    let output = '';
    let resolved = false;

    convexProcess.stdout?.on('data', (data) => {
      output += data.toString();
      if (!resolved && output.includes('Convex functions ready')) {
        resolved = true;
        console.log('[CLI E2E Setup] Convex backend ready');
        resolve();
      }
    });

    convexProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });

    convexProcess.on('error', (err) => {
      if (!resolved) {
        reject(err);
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Check if it's actually running despite no "ready" message
        fetch(`${CONVEX_BACKEND_URL}/version`)
          .then(() => resolve())
          .catch(() => reject(new Error(`Convex backend startup timeout. Output: ${output}`)));
      }
    }, 60000);
  });
}

async function waitForWebApp(): Promise<void> {
  console.log('[CLI E2E Setup] Waiting for web app...');

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(WEB_APP_URL);
      if (response.ok) {
        console.log('[CLI E2E Setup] Web app is ready');
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error('Web app did not start within 30 seconds');
}

async function extractClerkToken(browser: Browser): Promise<string> {
  const page = await browser.newPage({
    storageState: PLAYWRIGHT_AUTH_STATE,
  });

  try {
    await page.goto(WEB_APP_URL);

    // Wait for authentication to complete
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    // Extract Convex token from Clerk
    const token = await page.evaluate(async () => {
      // Wait a moment for Clerk to fully initialize
      await new Promise((r) => setTimeout(r, 1000));

      // @ts-expect-error Clerk is globally available
      if (!window.Clerk || !window.Clerk.session) {
        throw new Error('Clerk not initialized');
      }

      // @ts-expect-error Clerk is globally available
      return await window.Clerk.session.getToken({ template: 'convex' });
    });

    if (!token) {
      throw new Error('Failed to extract Clerk token - token is null');
    }

    return token;
  } finally {
    await page.close();
  }
}

async function setupCLICredentials(token: string): Promise<void> {
  await mkdir(TEST_CREDENTIALS_DIR, { recursive: true });

  const credentialsPath = join(TEST_CREDENTIALS_DIR, 'credentials.json');
  await writeFile(
    credentialsPath,
    JSON.stringify(
      {
        accessToken: token,
        expiresAt: Date.now() + 3600000, // 1 hour
      },
      null,
      2
    )
  );

  console.log('[CLI E2E Setup] CLI credentials saved');
}

// Vitest global setup hook
export default async function globalSetup() {
  await setup();
  return async () => {
    await teardown();
  };
}
