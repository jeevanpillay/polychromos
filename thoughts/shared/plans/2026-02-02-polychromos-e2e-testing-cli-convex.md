# Polychromos CLI-Convex E2E Testing Implementation Plan

## Overview

Implement comprehensive end-to-end tests for the Polychromos CLI → Convex integration. Currently, all CLI tests mock the ConvexHttpClient, leaving a critical gap where the real integration is untested. This plan adds E2E tests using the local Convex backend with real Clerk authentication.

## Current State Analysis

### What IS Tested
- **CLI Unit Tests**: 9 commands tested with mocked Convex and filesystem (`packages/polychromos/src/__tests__/`)
- **Convex Backend Tests**: Unit tests using `convex-test` library (`apps/polychromos-app/convex/__tests__/`)
- **Browser E2E Tests**: 9 Playwright tests for web app auth and workspace creation (`apps/polychromos-app/e2e/browser/`)

### Critical Gap
- **No CLI → Convex E2E tests**: All CLI tests mock `ConvexHttpClient`
- **`dev` command completely untested**: No test file exists for file watching and sync
- **No cross-platform sync tests**: CLI changes not verified in web app

### Key Discoveries
- Local Convex backend harness exists at `apps/polychromos-app/test/backendHarness.js`
- `ConvexTestingHelper.ts` provides test utilities for Convex integration at `apps/polychromos-app/test/ConvexTestingHelper.ts`
- CLI supports `POLYCHROMOS_TOKEN` env var for authentication at `packages/polychromos/src/lib/credentials.ts:33`
- Playwright auth state saved to `playwright/.clerk/user.json`
- Token can be extracted from Clerk via `window.Clerk.session.getToken({ template: "convex" })`

## Desired End State

After this plan is complete:
1. CLI E2E tests run against local Convex backend with real Clerk authentication
2. All CLI commands that interact with Convex are E2E tested
3. `dev` command has full test coverage including file watching and sync
4. Cross-platform tests verify CLI changes appear in web app
5. CI pipeline runs CLI E2E tests on every PR

### Verification
- `pnpm test:cli:e2e` passes with 100% of CLI-Convex integration tested
- `pnpm test:e2e:cross-platform` verifies CLI ↔ web app sync
- CI workflow runs both test suites on relevant PRs

## What We're NOT Doing

- **Not testing Clerk auth flow itself**: Clerk is tested by Clerk; we test token usage
- **Not testing network failures**: Focus on happy path and handled errors
- **Not testing performance**: No load testing or latency benchmarks
- **Not replacing unit tests**: E2E tests complement, not replace, existing unit tests
- **Not testing multi-user scenarios**: Single authenticated user per test

## Implementation Approach

1. Create CLI E2E test infrastructure that uses local Convex backend
2. Implement Clerk token extraction from Playwright session
3. Write E2E tests for authentication, sync, version control, and cross-platform flows
4. Add CI workflow for CLI E2E tests

---

## Phase 1: CLI E2E Test Infrastructure

### Overview
Set up the test infrastructure for CLI E2E tests with local Convex backend and real Clerk authentication.

### Changes Required

#### 1. Create CLI E2E Test Directory Structure
**Location**: `packages/polychromos/test/e2e/`

Create the following structure:
```
packages/polychromos/test/e2e/
├── setup.ts           # Global test setup
├── helpers.ts         # Test utilities
├── auth.spec.ts       # Authentication E2E tests
├── dev.spec.ts        # Dev command E2E tests
├── version.spec.ts    # Undo/redo/history E2E tests
└── fixtures/          # Test data
    └── design.json    # Sample design file
```

#### 2. Create E2E Test Setup
**File**: `packages/polychromos/test/e2e/setup.ts`

```typescript
import { chromium, type Browser, type Page } from 'playwright';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

let browser: Browser | null = null;
let convexProcess: ChildProcess | null = null;

// Test workspace directory
export const TEST_WORKSPACE_DIR = join(tmpdir(), 'polychromos-e2e-test');
export const TEST_CREDENTIALS_DIR = join(TEST_WORKSPACE_DIR, '.polychromos-home');

export async function globalSetup() {
  // 1. Start local Convex backend
  await startLocalConvex();

  // 2. Launch browser for token extraction
  browser = await chromium.launch();

  // 3. Extract Clerk token from saved session
  const token = await extractClerkToken(browser);

  // 4. Save token for CLI tests
  await setupCLICredentials(token);

  // 5. Create test workspace directory
  await mkdir(TEST_WORKSPACE_DIR, { recursive: true });
}

export async function globalTeardown() {
  // Cleanup browser
  if (browser) {
    await browser.close();
  }

  // Stop Convex backend
  if (convexProcess) {
    convexProcess.kill('SIGTERM');
  }

  // Clean up test directories
  await rm(TEST_WORKSPACE_DIR, { recursive: true, force: true });
}

async function startLocalConvex(): Promise<void> {
  // Check if backend already running
  try {
    const response = await fetch('http://127.0.0.1:3210/version');
    if (response.ok) {
      console.log('Local Convex backend already running');
      return;
    }
  } catch {
    // Not running, start it
  }

  return new Promise((resolve, reject) => {
    convexProcess = spawn('npx', ['convex', 'dev', '--once'], {
      cwd: join(process.cwd(), '../../apps/polychromos-app'),
      stdio: 'pipe',
    });

    convexProcess.stdout?.on('data', (data) => {
      if (data.toString().includes('Ready')) {
        resolve();
      }
    });

    convexProcess.on('error', reject);

    // Timeout after 60 seconds
    setTimeout(() => reject(new Error('Convex backend startup timeout')), 60000);
  });
}

async function extractClerkToken(browser: Browser): Promise<string> {
  const authStatePath = join(
    process.cwd(),
    '../../apps/polychromos-app/playwright/.clerk/user.json'
  );

  const page = await browser.newPage({
    storageState: authStatePath,
  });

  await page.goto('http://localhost:3001');
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  const token = await page.evaluate(async () => {
    // @ts-expect-error Clerk is globally available
    return await window.Clerk.session.getToken({ template: 'convex' });
  });

  await page.close();

  if (!token) {
    throw new Error('Failed to extract Clerk token');
  }

  return token;
}

async function setupCLICredentials(token: string): Promise<void> {
  await mkdir(TEST_CREDENTIALS_DIR, { recursive: true });

  const credentialsPath = join(TEST_CREDENTIALS_DIR, 'credentials.json');
  await writeFile(credentialsPath, JSON.stringify({
    accessToken: token,
    expiresAt: Date.now() + 3600000, // 1 hour
  }, null, 2));
}
```

#### 3. Create E2E Test Helpers
**File**: `packages/polychromos/test/e2e/helpers.ts`

```typescript
import { execSync, spawn, type ChildProcess } from 'child_process';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { TEST_WORKSPACE_DIR, TEST_CREDENTIALS_DIR } from './setup';

export interface TestWorkspace {
  dir: string;
  configDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a test workspace with CLI configuration
 */
export async function createTestWorkspace(
  workspaceId: string,
  convexUrl = 'http://127.0.0.1:3210'
): Promise<TestWorkspace> {
  const dir = join(TEST_WORKSPACE_DIR, `workspace-${Date.now()}`);
  const configDir = join(dir, '.polychromos');

  await mkdir(configDir, { recursive: true });

  // Write CLI config
  await writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({ convexUrl, workspaceId }, null, 2)
  );

  return {
    dir,
    configDir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Creates a design.json file in the workspace
 */
export async function createDesignFile(
  workspace: TestWorkspace,
  data: Record<string, unknown>
): Promise<void> {
  await writeFile(
    join(workspace.dir, 'design.json'),
    JSON.stringify(data, null, 2)
  );
}

/**
 * Reads the design.json file from the workspace
 */
export async function readDesignFile(
  workspace: TestWorkspace
): Promise<Record<string, unknown>> {
  const content = await readFile(join(workspace.dir, 'design.json'), 'utf-8');
  return JSON.parse(content);
}

/**
 * Runs a CLI command in the test workspace
 */
export function runCLI(
  command: string,
  workspace: TestWorkspace,
  options: { timeout?: number } = {}
): string {
  const env = {
    ...process.env,
    HOME: TEST_CREDENTIALS_DIR.replace('/.polychromos-home', ''),
    POLYCHROMOS_HOME: TEST_CREDENTIALS_DIR,
  };

  return execSync(`npx polychromos ${command}`, {
    cwd: workspace.dir,
    env,
    encoding: 'utf-8',
    timeout: options.timeout ?? 30000,
  });
}

/**
 * Spawns the dev command for testing file watching
 */
export function spawnDevCommand(workspace: TestWorkspace): {
  process: ChildProcess;
  output: string[];
  stop: () => void;
} {
  const output: string[] = [];

  const env = {
    ...process.env,
    HOME: TEST_CREDENTIALS_DIR.replace('/.polychromos-home', ''),
    POLYCHROMOS_HOME: TEST_CREDENTIALS_DIR,
  };

  const proc = spawn('npx', ['polychromos', 'dev'], {
    cwd: workspace.dir,
    env,
    stdio: 'pipe',
  });

  proc.stdout?.on('data', (data) => {
    output.push(data.toString());
  });

  proc.stderr?.on('data', (data) => {
    output.push(data.toString());
  });

  return {
    process: proc,
    output,
    stop: () => proc.kill('SIGINT'),
  };
}

/**
 * Waits for output to contain a specific string
 */
export async function waitForOutput(
  output: string[],
  match: string | RegExp,
  timeout = 10000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const text = output.join('');
    if (typeof match === 'string' ? text.includes(match) : match.test(text)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error(`Timeout waiting for output: ${match}`);
}
```

#### 4. Create Sample Design Fixture
**File**: `packages/polychromos/test/e2e/fixtures/design.json`

```json
{
  "id": "test-workspace",
  "version": "1.0",
  "name": "E2E Test Design",
  "components": {
    "comp1": {
      "id": "comp1",
      "name": "Test Component",
      "elements": []
    }
  }
}
```

#### 5. Update Vitest Config for E2E Tests
**File**: `packages/polychromos/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/e2e/**'], // Exclude E2E from unit test runs
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/index.ts', 'dist/**'],
    },
  },
});
```

**File**: `packages/polychromos/vitest.e2e.config.ts` (new file)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.spec.ts'],
    globalSetup: ['./test/e2e/setup.ts'],
    testTimeout: 60000, // E2E tests need longer timeout
    hookTimeout: 120000, // Setup/teardown need even longer
    sequence: {
      concurrent: false, // Run E2E tests sequentially
    },
  },
});
```

#### 6. Add NPM Scripts
**File**: `packages/polychromos/package.json`

Add to scripts:
```json
{
  "scripts": {
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:e2e:watch": "vitest --config vitest.e2e.config.ts"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] `mkdir -p packages/polychromos/test/e2e/fixtures` creates directory structure
- [x] `pnpm --filter @polychromos/cli test` still passes (unit tests unaffected)
- [x] TypeScript compiles: `pnpm --filter @polychromos/cli typecheck`

#### Manual Verification:
- [x] Verify Playwright auth state file exists at `apps/polychromos-app/playwright/.clerk/user.json`
- [x] Local Convex backend can start via the existing harness

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Authentication E2E Tests

### Overview
Implement E2E tests for CLI commands that verify authentication against real Convex backend.

### Changes Required

#### 1. Authentication E2E Tests
**File**: `packages/polychromos/test/e2e/auth.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import {
  createTestWorkspace,
  createDesignFile,
  runCLI,
  type TestWorkspace,
} from './helpers';

describe('CLI Authentication E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    // Extract token from saved credentials and set on client
    const token = process.env.POLYCHROMOS_TOKEN;
    if (token) {
      convexClient.setAuth(token);
    }
  });

  afterAll(async () => {
    // Cleanup any created workspaces
    if (createdWorkspaceId) {
      try {
        await convexClient.mutation('workspaces:delete' as never, {
          id: createdWorkspaceId,
        } as never);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(async () => {
    // Create a workspace in Convex first
    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'E2E Test Workspace',
      data: {
        id: 'test',
        version: '1.0',
        name: 'Test',
        components: {},
      },
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('whoami command', () => {
    it('shows authenticated user info with real Convex', async () => {
      const output = runCLI('whoami', workspace);

      expect(output).toContain('Authenticated');
      expect(output).toMatch(/workspaces?:/i);
    });

    it('lists workspaces the user owns', async () => {
      const output = runCLI('whoami', workspace);

      expect(output).toContain('E2E Test Workspace');
    });
  });

  describe('history command', () => {
    it('fetches history from real Convex', async () => {
      const output = runCLI('history', workspace);

      // Should show base version
      expect(output).toMatch(/version|history/i);
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/cli test:e2e` runs auth tests
- [x] `whoami` test passes with real Convex response
- [x] `history` test passes with real event data

#### Manual Verification:
- [x] Verify test creates real workspace in Convex
- [x] Verify test cleans up workspace after completion

**Note**: During Phase 2 implementation, E2E tests revealed that `history`, `undo`, and `redo` commands were missing authentication. These bugs were fixed by adding `getValidToken()` and `client.setAuth()` calls to all three commands.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Dev Command E2E Tests

### Overview
Implement E2E tests for the `dev` command including file watching, debouncing, and Convex sync.

### Changes Required

#### 1. Dev Command E2E Tests
**File**: `packages/polychromos/test/e2e/dev.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  createTestWorkspace,
  createDesignFile,
  readDesignFile,
  spawnDevCommand,
  waitForOutput,
  type TestWorkspace,
} from './helpers';

describe('Dev Command E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    const token = process.env.POLYCHROMOS_TOKEN;
    if (token) {
      convexClient.setAuth(token);
    }
  });

  afterAll(async () => {
    if (createdWorkspaceId) {
      try {
        await convexClient.mutation('workspaces:delete' as never, {
          id: createdWorkspaceId,
        } as never);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(async () => {
    // Create initial workspace
    const initialData = {
      id: 'test',
      version: '1.0',
      name: 'Dev Test',
      components: {},
    };

    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'Dev E2E Test',
      data: initialData,
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
    await createDesignFile(workspace, initialData);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('file watching', () => {
    it('syncs design.json changes to Convex', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        // Wait for dev to start watching
        await waitForOutput(dev.output, 'Watching design.json');

        // Modify the design file
        const updatedData = {
          id: 'test',
          version: '1.0',
          name: 'Updated Name',
          components: { newComp: { id: 'newComp', name: 'New', elements: [] } },
        };
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(updatedData, null, 2)
        );

        // Wait for sync confirmation
        await waitForOutput(dev.output, '✓ Synced to Convex');

        // Verify in Convex
        const savedWorkspace = await convexClient.query('workspaces:get' as never, {
          id: createdWorkspaceId,
        } as never) as { data: { name: string; components: Record<string, unknown> } };

        expect(savedWorkspace.data.name).toBe('Updated Name');
        expect(savedWorkspace.data.components).toHaveProperty('newComp');
      } finally {
        dev.stop();
      }
    });

    it('handles no-change sync correctly', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json');

        // Read current content and write same content
        const currentData = await readDesignFile(workspace);
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(currentData, null, 2)
        );

        // Wait for response
        await waitForOutput(dev.output, '✓ No changes detected', 15000);
      } finally {
        dev.stop();
      }
    });

    it('debounces rapid file changes', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json');

        // Make rapid changes
        for (let i = 0; i < 5; i++) {
          await writeFile(
            join(workspace.dir, 'design.json'),
            JSON.stringify({
              id: 'test',
              version: '1.0',
              name: `Rapid Change ${i}`,
              components: {},
            }, null, 2)
          );
          await new Promise((r) => setTimeout(r, 50)); // 50ms between changes
        }

        // Wait for sync
        await waitForOutput(dev.output, '✓ Synced to Convex', 15000);

        // Verify final state
        const savedWorkspace = await convexClient.query('workspaces:get' as never, {
          id: createdWorkspaceId,
        } as never) as { data: { name: string } };

        // Should have the last change
        expect(savedWorkspace.data.name).toBe('Rapid Change 4');
      } finally {
        dev.stop();
      }
    });
  });

  describe('version tracking', () => {
    it('increments event version on sync', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json');

        // Make a change
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify({
            id: 'test',
            version: '1.0',
            name: 'Version Test',
            components: {},
          }, null, 2)
        );

        await waitForOutput(dev.output, 'event v1');

        // Make another change
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify({
            id: 'test',
            version: '1.0',
            name: 'Version Test 2',
            components: {},
          }, null, 2)
        );

        await waitForOutput(dev.output, 'event v2');
      } finally {
        dev.stop();
      }
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/cli test:e2e` runs dev command tests
- [x] File change sync test passes
- [x] Debounce test verifies coalescing behavior
- [x] Version tracking test passes

#### Manual Verification:
- [x] Watch the dev command output during test
- [x] Verify changes appear in Convex dashboard

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Version Control E2E Tests

### Overview
Implement E2E tests for undo, redo, and history commands with real Convex event sourcing.

### Changes Required

#### 1. Version Control E2E Tests
**File**: `packages/polychromos/test/e2e/version.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  createTestWorkspace,
  createDesignFile,
  readDesignFile,
  runCLI,
  spawnDevCommand,
  waitForOutput,
  type TestWorkspace,
} from './helpers';

describe('Version Control E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    const token = process.env.POLYCHROMOS_TOKEN;
    if (token) {
      convexClient.setAuth(token);
    }
  });

  afterAll(async () => {
    if (createdWorkspaceId) {
      try {
        await convexClient.mutation('workspaces:delete' as never, {
          id: createdWorkspaceId,
        } as never);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(async () => {
    const initialData = {
      id: 'test',
      version: '1.0',
      name: 'Initial State',
      components: {},
    };

    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'Version Control E2E',
      data: initialData,
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
    await createDesignFile(workspace, initialData);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  async function makeChange(name: string): Promise<void> {
    const dev = spawnDevCommand(workspace);
    try {
      await waitForOutput(dev.output, 'Watching design.json');

      await writeFile(
        join(workspace.dir, 'design.json'),
        JSON.stringify({
          id: 'test',
          version: '1.0',
          name,
          components: {},
        }, null, 2)
      );

      await waitForOutput(dev.output, '✓ Synced to Convex');
    } finally {
      dev.stop();
    }
  }

  describe('undo command', () => {
    it('reverts to previous state', async () => {
      // Make a change
      await makeChange('After Change');

      // Verify change is in Convex
      let saved = await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never) as { data: { name: string } };
      expect(saved.data.name).toBe('After Change');

      // Run undo
      const output = runCLI('undo', workspace);
      expect(output).toContain('Reverted');

      // Verify local file is updated
      const localData = await readDesignFile(workspace);
      expect(localData.name).toBe('Initial State');

      // Verify Convex state
      saved = await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never) as { data: { name: string } };
      expect(saved.data.name).toBe('Initial State');
    });

    it('returns error when at base version', async () => {
      // Try to undo when already at base state
      const output = runCLI('undo', workspace);
      expect(output).toMatch(/already at.*base|nothing to undo/i);
    });
  });

  describe('redo command', () => {
    it('restores undone changes', async () => {
      // Make a change
      await makeChange('After Change');

      // Undo it
      runCLI('undo', workspace);

      // Verify at initial state
      let localData = await readDesignFile(workspace);
      expect(localData.name).toBe('Initial State');

      // Redo
      const output = runCLI('redo', workspace);
      expect(output).toContain('Restored');

      // Verify change is back
      localData = await readDesignFile(workspace);
      expect(localData.name).toBe('After Change');
    });

    it('returns error when no redo available', async () => {
      // No changes to redo
      const output = runCLI('redo', workspace);
      expect(output).toMatch(/nothing to redo|already at.*latest/i);
    });
  });

  describe('history command', () => {
    it('shows all events with current marker', async () => {
      // Make multiple changes
      await makeChange('Change 1');
      await makeChange('Change 2');

      const output = runCLI('history', workspace);

      // Should show version numbers
      expect(output).toContain('v1');
      expect(output).toContain('v2');

      // Current version should be marked
      expect(output).toMatch(/v2.*current|current.*v2/i);
    });

    it('shows correct position after undo', async () => {
      await makeChange('Change 1');
      await makeChange('Change 2');

      // Undo once
      runCLI('undo', workspace);

      const output = runCLI('history', workspace);

      // v1 should now be current
      expect(output).toMatch(/v1.*current|current.*v1/i);
      // v2 should still exist (for redo)
      expect(output).toContain('v2');
    });
  });

  describe('undo/redo roundtrip', () => {
    it('preserves data integrity through multiple operations', async () => {
      const states = ['State A', 'State B', 'State C'];

      // Create history
      for (const name of states) {
        await makeChange(name);
      }

      // Undo all the way back
      for (let i = 0; i < states.length; i++) {
        runCLI('undo', workspace);
      }

      // Verify at initial state
      let data = await readDesignFile(workspace);
      expect(data.name).toBe('Initial State');

      // Redo all the way forward
      for (let i = 0; i < states.length; i++) {
        runCLI('redo', workspace);
      }

      // Verify at final state
      data = await readDesignFile(workspace);
      expect(data.name).toBe('State C');
    });
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/cli test:e2e` runs version control tests
- [x] Undo test reverts state correctly
- [x] Redo test restores state correctly
- [x] History shows correct event timeline

#### Manual Verification:
- [x] Verify events are created in Convex events table
- [x] Verify undo/redo affects both local file and Convex state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Cross-Platform Sync Tests

### Overview
Implement tests that verify CLI changes appear in the web app, using both Playwright and CLI.

### Changes Required

#### 1. Create Cross-Platform Test Directory
**Location**: `apps/polychromos-app/e2e/cross-platform/`

#### 2. Cross-Platform Sync Tests
**File**: `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts`

```typescript
import { test, expect, type Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { ConvexHttpClient } from 'convex/browser';
import { execSync, spawn, type ChildProcess } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'polychromos-cross-platform-e2e');

test.describe('CLI to Web App Sync', () => {
  let convexClient: ConvexHttpClient;
  let workspaceId: string;
  let testWorkspaceDir: string;
  let token: string;

  test.beforeAll(async ({ browser }) => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    // Extract token from browser context
    const page = await browser.newPage({
      storageState: 'playwright/.clerk/user.json',
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="authenticated"]');

    token = await page.evaluate(async () => {
      // @ts-expect-error Clerk is globally available
      return await window.Clerk.session.getToken({ template: 'convex' });
    });

    await page.close();
    convexClient.setAuth(token);
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });

    // Create workspace via web app
    await page.goto('/');
    await page.waitForSelector('[data-testid="authenticated"]');
    await page.click('button:has-text("Create New Design")');

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/\?workspace=/);
    const url = new URL(page.url());
    workspaceId = url.searchParams.get('workspace')!;

    // Set up CLI workspace directory
    testWorkspaceDir = join(TEST_DIR, `workspace-${Date.now()}`);
    await mkdir(join(testWorkspaceDir, '.polychromos'), { recursive: true });

    // Write CLI config
    await writeFile(
      join(testWorkspaceDir, '.polychromos', 'config.json'),
      JSON.stringify({
        convexUrl: 'http://127.0.0.1:3210',
        workspaceId,
      })
    );

    // Write credentials
    const credentialsDir = join(testWorkspaceDir, '.polychromos-home');
    await mkdir(credentialsDir, { recursive: true });
    await writeFile(
      join(credentialsDir, 'credentials.json'),
      JSON.stringify({
        accessToken: token,
        expiresAt: Date.now() + 3600000,
      })
    );

    // Get initial design.json from Convex
    const workspace = await convexClient.query('workspaces:get' as never, {
      id: workspaceId,
    } as never) as { data: Record<string, unknown> };

    await writeFile(
      join(testWorkspaceDir, 'design.json'),
      JSON.stringify(workspace.data, null, 2)
    );
  });

  test.afterEach(async () => {
    // Cleanup
    try {
      await rm(testWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('CLI changes appear in web app', async ({ page }) => {
    // Start CLI dev mode
    const env = {
      ...process.env,
      HOME: join(testWorkspaceDir, '..'),
      POLYCHROMOS_HOME: join(testWorkspaceDir, '.polychromos-home'),
    };

    const devProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: testWorkspaceDir,
      env,
      stdio: 'pipe',
    });

    // Wait for dev to be ready
    await new Promise<void>((resolve) => {
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Watching design.json')) {
          resolve();
        }
      });
    });

    try {
      // Make a change via CLI (modify design.json)
      const newName = `CLI Update ${Date.now()}`;
      const currentData = JSON.parse(
        await require('fs/promises').readFile(
          join(testWorkspaceDir, 'design.json'),
          'utf-8'
        )
      );
      currentData.name = newName;

      await writeFile(
        join(testWorkspaceDir, 'design.json'),
        JSON.stringify(currentData, null, 2)
      );

      // Wait for sync to complete
      await new Promise<void>((resolve) => {
        devProcess.stdout?.on('data', (data) => {
          if (data.toString().includes('✓ Synced to Convex')) {
            resolve();
          }
        });
      });

      // Refresh web app and verify change appears
      await page.reload();
      await page.waitForSelector('[data-testid="authenticated"]');

      // Check for updated name in the UI
      await expect(page.getByText(newName)).toBeVisible({ timeout: 10000 });
    } finally {
      devProcess.kill('SIGINT');
    }
  });

  test('CLI undo is reflected in web app', async ({ page }) => {
    // Make initial change via CLI
    const env = {
      ...process.env,
      HOME: join(testWorkspaceDir, '..'),
      POLYCHROMOS_HOME: join(testWorkspaceDir, '.polychromos-home'),
    };

    // Start dev and make a change
    const devProcess = spawn('npx', ['polychromos', 'dev'], {
      cwd: testWorkspaceDir,
      env,
      stdio: 'pipe',
    });

    await new Promise<void>((resolve) => {
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Watching design.json')) {
          resolve();
        }
      });
    });

    const currentData = JSON.parse(
      await require('fs/promises').readFile(
        join(testWorkspaceDir, 'design.json'),
        'utf-8'
      )
    );
    const originalName = currentData.name;
    const changedName = 'Changed Name';
    currentData.name = changedName;

    await writeFile(
      join(testWorkspaceDir, 'design.json'),
      JSON.stringify(currentData, null, 2)
    );

    await new Promise<void>((resolve) => {
      devProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('✓ Synced to Convex')) {
          resolve();
        }
      });
    });

    devProcess.kill('SIGINT');

    // Verify change in web app
    await page.reload();
    await expect(page.getByText(changedName)).toBeVisible({ timeout: 10000 });

    // Run undo via CLI
    execSync('npx polychromos undo', {
      cwd: testWorkspaceDir,
      env,
    });

    // Verify undo in web app
    await page.reload();
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });
  });
});
```

#### 3. Update Playwright Config for Cross-Platform Tests
**File**: `apps/polychromos-app/playwright.config.ts`

Add a new project:

```typescript
{
  name: "cross-platform",
  testDir: "./e2e/cross-platform",
  testMatch: /\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    storageState: "playwright/.clerk/user.json",
  },
  dependencies: ["setup"],
},
```

#### 4. Add NPM Script for Cross-Platform Tests
**File**: `apps/polychromos-app/package.json`

Add to scripts:
```json
{
  "scripts": {
    "test:e2e:cross-platform": "playwright test --project=cross-platform"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter polychromos-app test:e2e:cross-platform` runs cross-platform tests
- [x] CLI changes visible in web app test passes
- [x] CLI undo reflected in web app test passes

#### Manual Verification:
- [x] Open web app and CLI side-by-side
- [x] Make changes via CLI and see them appear in web app in real-time
- [x] Verify undo/redo from CLI updates web app

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 6: CI Integration

### Overview
Add GitHub Actions workflow to run CLI E2E tests on every PR.

### Changes Required

#### 1. Create CI Workflow
**File**: `.github/workflows/e2e-cli.yml`

```yaml
name: CLI E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - 'packages/polychromos/**'
      - 'apps/polychromos-app/convex/**'
      - '.github/workflows/e2e-cli.yml'

jobs:
  cli-e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: http://127.0.0.1:3210

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Start local Convex backend
        run: |
          cd apps/polychromos-app
          npx convex dev &
          sleep 30  # Wait for backend to start

      - name: Build polychromos-app
        run: pnpm --filter polychromos-app build

      - name: Start web app
        run: |
          cd apps/polychromos-app
          pnpm preview &
          sleep 10

      - name: Run Playwright setup (authenticate)
        run: pnpm --filter polychromos-app exec playwright test --project=setup

      - name: Run CLI E2E tests
        run: pnpm --filter @polychromos/cli test:e2e

      - name: Run cross-platform tests
        run: pnpm --filter polychromos-app test:e2e:cross-platform

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cli-e2e-results
          path: |
            packages/polychromos/test-results/
            apps/polychromos-app/playwright-report/
```

### Success Criteria

#### Automated Verification:
- [x] Push workflow file to branch
- [ ] CI workflow runs on PR (requires push to test)
- [ ] All E2E tests pass in CI (requires push to test)

#### Manual Verification:
- [ ] Check GitHub Actions logs for successful execution
- [ ] Verify test artifacts are uploaded on failure

**Note**: CI verification requires pushing the workflow file and creating a PR. The workflow is created at `.github/workflows/e2e-cli.yml`.

**Implementation Note**: After completing this phase and all automated verification passes, the implementation plan is complete.

---

## Testing Strategy

### Unit Tests (Existing)
- All CLI commands except `dev` have unit tests
- Mock filesystem and ConvexHttpClient
- Fast, isolated, run on every change

### E2E Tests (New - This Plan)
- Use local Convex backend
- Real Clerk authentication
- Test full integration path
- Slower, run on PRs

### Integration Tests
- Use `convex-test` library for backend tests
- Test Convex functions in isolation

### Manual Testing Steps
1. Run `pnpm dev` in `apps/polychromos-app`
2. Run `polychromos dev` in a test workspace
3. Modify `design.json` and verify sync in web app
4. Use undo/redo and verify state changes
5. Check version controls in web app UI

## Performance Considerations

- E2E tests have longer timeouts (60s for tests, 120s for setup)
- Tests run sequentially to avoid port conflicts
- Local Convex backend startup adds ~30s to CI

## Migration Notes

N/A - These are new tests, no migration needed.

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-e2e-testing-requirements.md`
- Existing E2E setup: `apps/polychromos-app/e2e/`
- Playwright config: `apps/polychromos-app/playwright.config.ts`
- CLI package: `packages/polychromos/`
- Convex backend: `apps/polychromos-app/convex/`
