---
date: 2026-02-02T15:30:00+08:00
researcher: Claude
git_commit: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos E2E Test Implementation"
tags: [research, testing, polychromos, e2e, playwright, local-backend]
status: complete
priority: 4
dependencies: [2026-02-02-polychromos-testing-1-infrastructure.md, 2026-02-02-polychromos-testing-2-unit-tests.md, 2026-02-02-polychromos-testing-3-integration-tests.md]
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research 4: Polychromos E2E Test Implementation

**Priority**: 4
**Dependencies**: Research 1 (Infrastructure), Research 2 (Unit), Research 3 (Integration)
**Estimated Effort**: 2-3 hours

## Overview

This document covers end-to-end tests that verify the complete CLI → Convex → Web App flow. E2E tests form ~5% of the test pyramid but provide critical confidence in the full system working together.

## What This Document Covers

1. Local backend E2E tests (Vitest + real Convex)
2. Browser E2E tests (Playwright)
3. Full flow verification

---

## 1. Local Backend E2E Tests

These tests run against a real local Convex backend but without a browser.

### Test File Structure

```
apps/polychromos/
└── e2e/
    ├── cli-init.test.ts
    ├── cli-sync.test.ts
    └── real-time-updates.test.ts
```

### CLI Init E2E Test

```typescript
// apps/polychromos/e2e/cli-init.test.ts
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { ConvexTestingHelper } from '../test/ConvexTestingHelper';
import { api } from '../convex/_generated/api';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/polychromos-e2e-init';

describe('CLI init E2E', () => {
  let t: ConvexTestingHelper;

  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (t) await t.close();
  });

  test('polychromos init creates valid design.json', () => {
    execSync('npx polychromos init test-design', {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    const designPath = join(TEST_DIR, 'design.json');
    expect(existsSync(designPath)).toBe(true);

    const design = JSON.parse(readFileSync(designPath, 'utf-8'));
    expect(design.name).toBe('test-design');
    expect(design.version).toBe('1.0');
    expect(design.components.main).toBeDefined();
  });

  test('design.json has valid schema structure', () => {
    const designPath = join(TEST_DIR, 'design.json');
    const design = JSON.parse(readFileSync(designPath, 'utf-8'));

    // Validate against expected structure
    expect(design.id).toMatch(/^ws_/);
    expect(design.settings).toBeDefined();
    expect(design.tokens).toBeDefined();
    expect(design.components.main.root.type).toBe('box');
    expect(design.components.main.root.children).toBeInstanceOf(Array);
  });
});
```

### CLI Sync E2E Test

```typescript
// apps/polychromos/e2e/cli-sync.test.ts
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexTestingHelper } from '../test/ConvexTestingHelper';
import { api } from '../convex/_generated/api';
import { spawn, execSync } from 'child_process';
import { writeFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/polychromos-e2e-sync';
const BACKEND_URL = 'http://127.0.0.1:3210';

describe('CLI to Convex sync E2E', () => {
  let t: ConvexTestingHelper;
  let cliProcess: ReturnType<typeof spawn> | null = null;

  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  beforeEach(async () => {
    t = new ConvexTestingHelper({ backendUrl: BACKEND_URL });
    await t.mutation(api.testingFunctions.clearAll, {});
  });

  afterEach(async () => {
    if (cliProcess) {
      cliProcess.kill();
      cliProcess = null;
    }
    if (t) await t.close();
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('CLI dev syncs design.json to Convex', async () => {
    // 1. Create workspace in Convex
    const workspaceId = await t.mutation(api.workspaces.create, {
      name: 'E2E Test',
      data: {
        id: 'e2e_test',
        version: '1.0',
        name: 'Initial',
        components: {},
      },
    });

    // 2. Write design.json with workspace ID
    const designPath = join(TEST_DIR, 'design.json');
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'Updated via CLI',
        components: {
          main: {
            id: 'main',
            name: 'main',
            width: 800,
            height: 600,
            root: {
              id: 'root',
              type: 'box',
              children: [
                {
                  id: 'text-1',
                  type: 'text',
                  text: { content: 'Hello from CLI', fontSize: 24 },
                },
              ],
            },
          },
        },
      }, null, 2)
    );

    // 3. Write config file
    const configDir = join(TEST_DIR, '.polychromos');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        convexUrl: BACKEND_URL,
        workspaceId: workspaceId,
      })
    );

    // 4. Start CLI watcher
    cliProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: TEST_DIR,
      env: {
        ...process.env,
        VITE_CONVEX_URL: BACKEND_URL,
      },
      stdio: 'pipe',
    });

    // 5. Wait for sync (debounce 300ms + network)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 6. Verify workspace was updated in Convex
    const workspace = await t.query(api.workspaces.get, {
      id: workspaceId as any,
    });

    expect(workspace?.data.name).toBe('Updated via CLI');
    expect(workspace?.data.components.main.root.children[0].text.content).toBe(
      'Hello from CLI'
    );
  });

  test('file changes trigger incremental sync', async () => {
    // 1. Create workspace
    const workspaceId = await t.mutation(api.workspaces.create, {
      name: 'Incremental Test',
      data: {
        id: 'inc_test',
        version: '1.0',
        name: 'Initial',
        components: {},
      },
    });

    // 2. Setup initial design.json
    const designPath = join(TEST_DIR, 'design.json');
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'Initial',
        components: {},
      })
    );

    // 3. Setup config
    const configDir = join(TEST_DIR, '.polychromos');
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ convexUrl: BACKEND_URL, workspaceId })
    );

    // 4. Start CLI
    cliProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: TEST_DIR,
      env: { ...process.env, VITE_CONVEX_URL: BACKEND_URL },
      stdio: 'pipe',
    });

    await new Promise((r) => setTimeout(r, 1000));

    // 5. Modify design.json
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'Modified',
        components: {},
      })
    );

    // 6. Wait for sync
    await new Promise((r) => setTimeout(r, 1500));

    // 7. Verify
    const workspace = await t.query(api.workspaces.get, {
      id: workspaceId as any,
    });
    expect(workspace?.data.name).toBe('Modified');
  });

  test('version conflict is detected', async () => {
    // 1. Create workspace
    const workspaceId = await t.mutation(api.workspaces.create, {
      name: 'Conflict Test',
      data: { id: 'conf_test', version: '1.0', name: 'Initial', components: {} },
    });

    // 2. Setup design.json with wrong expected version
    const designPath = join(TEST_DIR, 'design.json');
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'CLI Update',
        components: {},
      })
    );

    const configDir = join(TEST_DIR, '.polychromos');
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ convexUrl: BACKEND_URL, workspaceId })
    );

    // 3. Update workspace directly (simulating another client)
    await t.mutation(api.workspaces.update, {
      id: workspaceId as any,
      data: { id: 'conf_test', version: '1.0', name: 'Other Client', components: {} },
      expectedVersion: 1,
    });

    // 4. Start CLI with old expected version
    let cliOutput = '';
    cliProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: TEST_DIR,
      env: { ...process.env, VITE_CONVEX_URL: BACKEND_URL },
      stdio: 'pipe',
    });

    cliProcess.stderr?.on('data', (data) => {
      cliOutput += data.toString();
    });

    // 5. Modify to trigger sync
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'Should Conflict',
        components: {},
      })
    );

    await new Promise((r) => setTimeout(r, 2000));

    // 6. CLI should report conflict
    expect(cliOutput).toContain('Conflict');
  });
});
```

### Real-Time Updates E2E Test

```typescript
// apps/polychromos/e2e/real-time-updates.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ConvexTestingHelper } from '../test/ConvexTestingHelper';
import { api } from '../convex/_generated/api';

const BACKEND_URL = 'http://127.0.0.1:3210';

describe('Real-time updates E2E', () => {
  let t: ConvexTestingHelper;

  beforeEach(async () => {
    t = new ConvexTestingHelper({ backendUrl: BACKEND_URL });
    await t.mutation(api.testingFunctions.clearAll, {});
  });

  afterEach(async () => {
    if (t) await t.close();
  });

  test('workspace updates trigger subscription notifications', async () => {
    // 1. Create workspace
    const workspaceId = await t.mutation(api.workspaces.create, {
      name: 'Real-time Test',
      data: {
        id: 'rt_test',
        version: '1.0',
        name: 'Initial',
        components: {},
      },
    });

    // 2. Setup subscription tracking
    const updates: any[] = [];
    const unsubscribe = t.client.onUpdate(
      api.workspaces.get,
      { id: workspaceId as any },
      (workspace) => {
        updates.push(workspace);
      }
    );

    // 3. Wait for initial subscription
    await new Promise((r) => setTimeout(r, 100));

    // 4. Update workspace
    await t.mutation(api.workspaces.update, {
      id: workspaceId as any,
      data: {
        id: 'rt_test',
        version: '1.0',
        name: 'Updated',
        components: {},
      },
      expectedVersion: 1,
    });

    // 5. Wait for update to propagate
    await new Promise((r) => setTimeout(r, 500));

    // 6. Verify subscription received update
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[updates.length - 1]?.data.name).toBe('Updated');

    unsubscribe();
  });

  test('multiple rapid updates are all received', async () => {
    const workspaceId = await t.mutation(api.workspaces.create, {
      name: 'Rapid Test',
      data: { id: 'rapid', version: '1.0', name: 'V0', components: {} },
    });

    const updates: any[] = [];
    const unsubscribe = t.client.onUpdate(
      api.workspaces.get,
      { id: workspaceId as any },
      (workspace) => {
        updates.push(workspace?.data.name);
      }
    );

    await new Promise((r) => setTimeout(r, 100));

    // Rapid updates
    for (let i = 1; i <= 5; i++) {
      await t.mutation(api.workspaces.update, {
        id: workspaceId as any,
        data: { id: 'rapid', version: '1.0', name: `V${i}`, components: {} },
        expectedVersion: i,
      });
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Should have received all updates
    expect(updates).toContain('V5');

    unsubscribe();
  });
});
```

---

## 2. Browser E2E Tests (Playwright)

### Setup

```typescript
// apps/polychromos/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/browser',
  fullyParallel: false, // Run serially due to shared backend
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Browser E2E Tests

```typescript
// apps/polychromos/e2e/browser/workspace-flow.spec.ts
import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import { writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = '/tmp/polychromos-playwright';

test.describe('Workspace Flow', () => {
  let cliProcess: ReturnType<typeof spawn> | null = null;

  test.beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  test.afterAll(() => {
    if (cliProcess) cliProcess.kill();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('creates new workspace from home page', async ({ page }) => {
    await page.goto('/');

    // Home page should be visible
    await expect(page.getByRole('heading', { name: 'Polychromos' })).toBeVisible();

    // Click create button
    await page.getByRole('button', { name: 'Create New Design' }).click();

    // Should redirect to workspace view
    await page.waitForURL(/workspace=/);

    // Workspace ID should be in URL
    const url = new URL(page.url());
    expect(url.searchParams.get('workspace')).toBeTruthy();
  });

  test('displays canvas with workspace content', async ({ page }) => {
    // Navigate to existing workspace or create one
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    // Canvas should be visible
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();

    // Default content should render
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 5000 });
  });

  test('CLI changes appear in web app in real-time', async ({ page }) => {
    // 1. Create workspace via web
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    const workspaceId = new URL(page.url()).searchParams.get('workspace');
    expect(workspaceId).toBeTruthy();

    // 2. Setup CLI environment
    const designPath = join(TEST_DIR, 'design.json');
    const configDir = join(TEST_DIR, '.polychromos');
    mkdirSync(configDir, { recursive: true });

    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({
        convexUrl: 'http://127.0.0.1:3210',
        workspaceId,
      })
    );

    // 3. Start CLI watcher
    cliProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: TEST_DIR,
      env: {
        ...process.env,
        VITE_CONVEX_URL: 'http://127.0.0.1:3210',
      },
      stdio: 'pipe',
    });

    await page.waitForTimeout(1000);

    // 4. Write design.json
    writeFileSync(
      designPath,
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'E2E Test',
        components: {
          main: {
            id: 'main',
            name: 'main',
            width: 800,
            height: 600,
            root: {
              id: 'root',
              type: 'box',
              children: [
                {
                  id: 'e2e-text',
                  type: 'text',
                  text: {
                    content: 'Updated via CLI E2E',
                    fontSize: 32,
                  },
                },
              ],
            },
          },
        },
      }, null, 2)
    );

    // 5. Wait for sync and verify
    await expect(page.getByText('Updated via CLI E2E')).toBeVisible({
      timeout: 10000,
    });
  });

  test('export modal shows generated code', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    // Click export button
    await page.getByRole('button', { name: 'Export' }).click();

    // Modal should appear
    await expect(page.getByRole('dialog')).toBeVisible();

    // HTML tab should show code
    await page.getByRole('button', { name: 'HTML/CSS' }).click();
    await expect(page.locator('pre')).toContainText('<div');
    await expect(page.locator('pre')).toContainText('<style>');

    // Tailwind tab should show classes
    await page.getByRole('button', { name: 'Tailwind' }).click();
    await expect(page.locator('pre')).toContainText('className');
  });

  test('copy button copies code to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('button', { name: 'Copy Code' }).click();

    // Button text should change
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

    // Verify clipboard
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('<');
  });
});
```

### Error Handling E2E Tests

```typescript
// apps/polychromos/e2e/browser/error-handling.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('shows 404 for nonexistent routes', async ({ page }) => {
    await page.goto('/nonexistent-page');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
  });

  test('shows error for invalid workspace ID', async ({ page }) => {
    await page.goto('/?workspace=invalid_id_12345');

    // Should show error or redirect
    await expect(
      page.getByText(/not found|error/i).or(page.getByRole('heading', { name: 'Polychromos' }))
    ).toBeVisible({ timeout: 5000 });
  });

  test('handles network disconnection gracefully', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    // Go offline
    await context.setOffline(true);

    // App should still be visible (cached state)
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();

    // Come back online
    await context.setOffline(false);
    await page.waitForTimeout(2000);

    // Should recover
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
  });
});
```

---

## 3. Running E2E Tests

### Package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "node test/backendHarness.js 'npm run test:e2e:run'",
    "test:e2e:run": "just convex env set IS_TEST true && just convex deploy && vitest run e2e/",
    "test:e2e:browser": "playwright test",
    "test:e2e:all": "npm run test:e2e && npm run test:e2e:browser"
  }
}
```

### CI Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install Just
        run: |
          curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright
        run: pnpm --filter @repo/polychromos exec playwright install --with-deps chromium

      - name: E2E Tests (Local Backend)
        run: pnpm --filter @repo/polychromos test:e2e
        timeout-minutes: 10

      - name: E2E Tests (Browser)
        run: pnpm --filter @repo/polychromos test:e2e:browser
        timeout-minutes: 10

      - name: Upload Playwright Report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/polychromos/playwright-report/
          retention-days: 7
```

---

## Verification Checklist

- [ ] `pnpm --filter @repo/polychromos test:e2e` passes (local backend tests)
- [ ] `pnpm --filter @repo/polychromos test:e2e:browser` passes (Playwright)
- [ ] CLI init creates valid design.json
- [ ] CLI dev syncs to Convex correctly
- [ ] Version conflicts are detected and reported
- [ ] Real-time updates work end-to-end
- [ ] Web app displays workspace content
- [ ] Export modal generates correct code
- [ ] Error handling works gracefully

---

## Summary: Complete Test Coverage

| Layer | Test Type | Files | Coverage Target |
|-------|-----------|-------|-----------------|
| 1 | Unit (Validators) | `validators.test.ts` | >80% |
| 1 | Unit (Generators) | `generators.test.ts` | >80% |
| 1 | Unit (VersionManager) | `version-manager.test.ts` | >80% |
| 1 | Unit (Renderers) | `box.test.tsx`, etc. | >70% |
| 2 | Integration (CLI) | `init.test.ts`, `dev.test.ts`, etc. | >70% |
| 2 | Integration (Convex) | `workspaces.test.ts`, `events.test.ts` | >80% |
| 3 | E2E (Local Backend) | `cli-sync.test.ts`, etc. | Critical paths |
| 3 | E2E (Browser) | `workspace-flow.spec.ts` | Critical paths |

**Total Estimated Test Count**: ~50-70 tests
**Estimated Coverage**: 70-80% overall
