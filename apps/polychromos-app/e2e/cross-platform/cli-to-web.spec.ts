import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { ConvexHttpClient } from 'convex/browser';
import { execSync, spawn } from 'child_process';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONVEX_URL = process.env.CONVEX_BACKEND_URL || 'http://127.0.0.1:3210';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3001';

const TEST_DIR = join(tmpdir(), 'polychromos-cross-platform-e2e');
const CLI_PATH = join(__dirname, '../../../../packages/polychromos/dist/index.js');

test.describe('CLI to Web App Sync', () => {
  let convexClient: ConvexHttpClient;
  let workspaceId: string;
  let testWorkspaceDir: string;
  let token: string;

  test.beforeAll(async ({ browser }) => {
    convexClient = new ConvexHttpClient(CONVEX_URL);

    // Extract token from browser context
    const page = await browser.newPage({
      storageState: 'playwright/.clerk/user.json',
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    const fetchedToken = await page.evaluate(async () => {
      // Wait for Clerk to initialize
      await new Promise((r) => setTimeout(r, 1000));
      // @ts-expect-error Clerk is globally available
      return await window.Clerk.session.getToken({ template: 'convex' });
    });
    if (!fetchedToken) throw new Error('Failed to get Clerk token');
    token = fetchedToken;

    await page.close();
    convexClient.setAuth(token);
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });

    // Create workspace via Convex mutation
    const initialData = {
      id: 'cross-platform-test',
      version: '1.0',
      name: 'Cross Platform Test',
      components: {},
    };

    workspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'Cross Platform E2E',
      data: initialData,
    } as never);

    // Set up CLI workspace directory
    testWorkspaceDir = join(TEST_DIR, `workspace-${Date.now()}`);
    await mkdir(join(testWorkspaceDir, '.polychromos'), { recursive: true });

    // Write CLI config
    await writeFile(
      join(testWorkspaceDir, '.polychromos', 'config.json'),
      JSON.stringify({
        convexUrl: CONVEX_URL,
        workspaceId,
      })
    );

    // Write design.json with initial data
    await writeFile(
      join(testWorkspaceDir, 'design.json'),
      JSON.stringify(initialData, null, 2)
    );
  });

  test.afterEach(async () => {
    // Cleanup test directory
    try {
      await rm(testWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('CLI changes sync to Convex and can be verified via API', async ({ page }) => {
    // Start CLI dev mode
    const env = {
      ...process.env,
      POLYCHROMOS_TOKEN: token,
    };

    const devProcess = spawn('node', [CLI_PATH, 'dev'], {
      cwd: testWorkspaceDir,
      env,
      stdio: 'pipe',
    });

    // Wait for dev to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Dev startup timeout')), 15000);
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Watching design.json')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    try {
      // Make a change via CLI (modify design.json)
      const newName = `CLI Update ${Date.now()}`;
      const currentData = JSON.parse(
        await readFile(join(testWorkspaceDir, 'design.json'), 'utf-8')
      );
      currentData.name = newName;

      await writeFile(
        join(testWorkspaceDir, 'design.json'),
        JSON.stringify(currentData, null, 2)
      );

      // Wait for sync to complete
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Sync timeout')), 15000);
        devProcess.stdout?.on('data', (data) => {
          if (data.toString().includes('Synced to Convex')) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      // Verify via Convex API that the change was synced
      const savedWorkspace = (await convexClient.query('workspaces:get' as never, {
        id: workspaceId,
      } as never)) as { data: { name: string } };

      expect(savedWorkspace.data.name).toBe(newName);

      // Also verify we can access the page with the workspace
      await page.goto(`/?workspace=${workspaceId}`);
      await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

      // The authenticated page should load (workspace is accessible)
      await expect(page.locator('[data-testid="authenticated"]')).toBeVisible();
    } finally {
      devProcess.kill('SIGINT');
    }
  });

  test('CLI undo changes Convex state correctly', async ({ page }) => {
    const env = {
      ...process.env,
      POLYCHROMOS_TOKEN: token,
    };

    // Start dev and make a change
    const devProcess = spawn('node', [CLI_PATH, 'dev'], {
      cwd: testWorkspaceDir,
      env,
      stdio: 'pipe',
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Dev startup timeout')), 15000);
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Watching design.json')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Make initial change
    const currentData = JSON.parse(
      await readFile(join(testWorkspaceDir, 'design.json'), 'utf-8')
    );
    const originalName = currentData.name;
    const changedName = `Changed Name ${Date.now()}`;
    currentData.name = changedName;

    await writeFile(
      join(testWorkspaceDir, 'design.json'),
      JSON.stringify(currentData, null, 2)
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Sync timeout')), 15000);
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Synced to Convex')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    devProcess.kill('SIGINT');
    await new Promise((r) => setTimeout(r, 500)); // Wait for process to clean up

    // Verify change was synced
    let savedWorkspace = (await convexClient.query('workspaces:get' as never, {
      id: workspaceId,
    } as never)) as { data: { name: string } };
    expect(savedWorkspace.data.name).toBe(changedName);

    // Run undo via CLI
    execSync(`node ${CLI_PATH} undo`, {
      cwd: testWorkspaceDir,
      env,
    });

    // Verify undo worked via Convex API
    savedWorkspace = (await convexClient.query('workspaces:get' as never, {
      id: workspaceId,
    } as never)) as { data: { name: string } };
    expect(savedWorkspace.data.name).toBe(originalName);

    // Verify the web app can still access the workspace after undo
    await page.goto(`/?workspace=${workspaceId}`);
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="authenticated"]')).toBeVisible();
  });
});
