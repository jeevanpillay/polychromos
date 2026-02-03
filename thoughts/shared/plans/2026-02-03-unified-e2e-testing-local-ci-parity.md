# Unified E2E Testing: Local/CI Parity Implementation Plan

## Overview

Ensure all E2E tests work identically in both CI and local environments by:
1. Using `.vercel/.env.development.local` as the single source of environment variables
2. Running all tests against local Convex backend (`http://127.0.0.1:3210`)
3. Unifying server startup and backend management between CI and local

## Current State Analysis

### Problems Identified

1. **Inconsistent environment loading**:
   - CI uses GitHub secrets/vars
   - Local uses `.vercel/.env.development.local` but not consistently across all test types

2. **Different Convex backends**:
   - Browser tests use cloud Convex (from `VITE_CONVEX_URL` env var)
   - CLI/cross-platform tests use local Convex (hardcoded)

3. **Different server startup mechanisms**:
   - CI: Explicit workflow steps start Convex and web app
   - Local: Playwright webServer is `undefined`, assumes manual startup
   - backendHarness.cjs fails if backend already running

4. **Fragmented test commands**:
   - `test:e2e` - uses backendHarness
   - `test:e2e:playwright` - direct Playwright
   - `test:e2e:cross-platform` - subset of Playwright
   - CLI package has separate `test:e2e`

### Key Files

- `apps/polychromos-app/playwright.config.ts` - Playwright configuration
- `apps/polychromos-app/package.json` - Test scripts
- `apps/polychromos-app/test/backendHarness.cjs` - Local backend management
- `apps/polychromos-app/scripts/local-backend.sh` - Backend binary runner
- `packages/polychromos/test/e2e/setup.ts` - CLI E2E setup
- `.github/workflows/ci.yml` - CI workflow

## Desired End State

After implementation:

1. **Single command** runs all E2E tests locally: `pnpm test:e2e:all`
2. **All tests use local Convex** (`http://127.0.0.1:3210`)
3. **Environment loaded from** `.vercel/.env.development.local`
4. **CI workflow uses same scripts** as local development
5. **Automatic server management** - starts if not running, reuses if running

### Verification

```bash
# Local: Run all E2E tests
pnpm test:e2e:all

# Should:
# 1. Load env from .vercel/.env.development.local
# 2. Start local Convex backend (or reuse existing)
# 3. Start web app pointed at local Convex (or reuse existing)
# 4. Run Playwright auth setup
# 5. Run browser tests
# 6. Run CLI E2E tests
# 7. Run cross-platform tests
```

## What We're NOT Doing

- Not creating separate `.env.test` files
- Not changing the test logic itself
- Not modifying Clerk authentication flow
- Not changing how tokens are extracted
- Not modifying the local-backend.sh binary management

## Implementation Approach

Use a unified test orchestrator script that:
1. Loads environment from `.vercel/.env.development.local`
2. Overrides `VITE_CONVEX_URL` to local backend
3. Manages backend/server lifecycle (start or reuse)
4. Runs tests in correct order
5. Works identically in CI and local

---

## Phase 1: Environment Loading Unification

### Overview
Ensure all test scripts consistently load from `.vercel/.env.development.local` and override `VITE_CONVEX_URL` to use local Convex.

### Changes Required

#### 1. Update polychromos-app package.json scripts
**File**: `apps/polychromos-app/package.json`

Current scripts use inconsistent env loading. Standardize on dotenv with local Convex override.

```json
{
  "scripts": {
    "test:e2e:local": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- node test/e2eRunner.cjs",
    "test:e2e:playwright:local": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- playwright test",
    "test:e2e:setup": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- playwright test --project=setup"
  }
}
```

#### 2. Update CLI package test:e2e script
**File**: `packages/polychromos/package.json`

Add environment loading to CLI E2E tests:

```json
{
  "scripts": {
    "test:e2e": "dotenv -e ../../apps/polychromos-app/.vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- vitest run --config vitest.e2e.config.ts"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/polychromos-app test:e2e:setup` loads env correctly
- [x] Environment variable `VITE_CONVEX_URL` is `http://127.0.0.1:3210` during tests
- [x] `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER_PASSWORD` are available

#### Manual Verification:
- [ ] Verify `.vercel/.env.development.local` contains all required E2E variables

---

## Phase 2: Unified Backend Management

### Overview
Refactor backendHarness to support reusing existing backend and create consistent startup behavior for both CI and local.

### Changes Required

#### 1. Refactor backendHarness.cjs
**File**: `apps/polychromos-app/test/backendHarness.cjs`

Change from "fail if running" to "reuse if running":

```javascript
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const BACKEND_URL = 'http://127.0.0.1:3210';
const WEB_APP_URL = 'http://localhost:3001';
const CWD = path.dirname(__dirname);

let backendProcess = null;
let webAppProcess = null;
let ownedBackend = false;
let ownedWebApp = false;

async function isBackendRunning() {
  return new Promise((resolve) => {
    const req = http.request(`${BACKEND_URL}/version`, { method: 'GET', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function isWebAppRunning() {
  return new Promise((resolve) => {
    const req = http.request(WEB_APP_URL, { method: 'GET', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function waitFor(checkFn, name, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkFn()) {
      console.log(`[E2E] ${name} is ready`);
      return;
    }
    if (i % 10 === 0 && i > 0) {
      console.log(`[E2E] Waiting for ${name}... (${i}/${maxAttempts})`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${name} did not start within ${maxAttempts * 0.5}s`);
}

async function startBackend() {
  if (await isBackendRunning()) {
    console.log('[E2E] Backend already running, reusing existing instance');
    ownedBackend = false;
    return;
  }

  console.log('[E2E] Starting local Convex backend...');

  // Reset data for clean state
  const { execSync } = require('child_process');
  try {
    execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'pipe' });
  } catch (e) {
    // Ignore reset errors (may not exist yet)
  }

  backendProcess = spawn('./scripts/local-backend.sh', ['run'], {
    cwd: CWD,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CONVEX_TRACE_FILE: '1' }
  });

  backendProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG) console.log(`[backend] ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG) console.error(`[backend] ${data}`);
  });

  ownedBackend = true;
  await waitFor(isBackendRunning, 'Backend');
}

async function startWebApp() {
  if (await isWebAppRunning()) {
    console.log('[E2E] Web app already running, reusing existing instance');
    ownedWebApp = false;
    return;
  }

  console.log('[E2E] Starting web app...');

  webAppProcess = spawn('pnpm', ['dev:web'], {
    cwd: CWD,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, VITE_CONVEX_URL: BACKEND_URL },
    shell: true
  });

  webAppProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG) console.log(`[web] ${data}`);
  });
  webAppProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG) console.error(`[web] ${data}`);
  });

  ownedWebApp = true;
  await waitFor(isWebAppRunning, 'Web app', 120);
}

async function deployConvexSchema() {
  console.log('[E2E] Deploying Convex schema...');
  const { execSync } = require('child_process');
  execSync('./scripts/local-backend.sh convex deploy', {
    cwd: CWD,
    stdio: 'inherit',
    env: { ...process.env, IS_TEST: 'true' }
  });
}

function cleanup() {
  if (ownedWebApp && webAppProcess) {
    console.log('[E2E] Stopping web app...');
    webAppProcess.kill('SIGTERM');
    webAppProcess = null;
  }
  if (ownedBackend && backendProcess) {
    console.log('[E2E] Stopping backend...');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

async function runE2ETests(command) {
  try {
    await startBackend();
    await deployConvexSchema();
    await startWebApp();

    console.log(`[E2E] Running: ${command}`);
    const { execSync } = require('child_process');
    execSync(command, {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: 'true', VITE_CONVEX_URL: BACKEND_URL }
    });

    return 0;
  } catch (error) {
    if (error.status) return error.status;
    console.error('[E2E] Error:', error.message);
    return 1;
  } finally {
    cleanup();
  }
}

// Handle signals
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

// Main
const command = process.argv[2];
if (!command) {
  console.error('Usage: node backendHarness.cjs <command>');
  process.exit(1);
}

runE2ETests(command).then(code => process.exit(code));

module.exports = { startBackend, startWebApp, cleanup, isBackendRunning, isWebAppRunning };
```

### Success Criteria

#### Automated Verification:
- [x] Running `node test/backendHarness.cjs "echo test"` starts backend if not running
- [x] Running same command when backend already running reuses it (no error)
- [x] Cleanup only stops processes that were started by the harness

#### Manual Verification:
- [ ] Can run `pnpm dev` in one terminal, then run E2E tests in another without conflict

---

## Phase 3: Unified E2E Test Runner

### Overview
Create a single test runner script that orchestrates all E2E tests in the correct order.

### Changes Required

#### 1. Create unified E2E runner
**File**: `apps/polychromos-app/test/e2eRunner.cjs`

```javascript
#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');

const CWD = path.dirname(__dirname);
const BACKEND_URL = 'http://127.0.0.1:3210';

// Import backend management from refactored harness
const { startBackend, startWebApp, cleanup, isBackendRunning, isWebAppRunning } = require('./backendHarness.cjs');

async function runCommand(name, command, args = [], options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[E2E] ${name}`);
  console.log('='.repeat(60));

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, VITE_CONVEX_URL: BACKEND_URL },
      shell: true,
      ...options
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} failed with code ${code}`));
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0 || args.includes('--all');
  const runBrowser = runAll || args.includes('--browser');
  const runCli = runAll || args.includes('--cli');
  const runCrossPlatform = runAll || args.includes('--cross-platform');
  const skipSetup = args.includes('--skip-setup');

  try {
    // Start infrastructure
    await startBackend();

    // Deploy schema
    console.log('\n[E2E] Deploying Convex schema...');
    execSync('./scripts/local-backend.sh convex deploy', {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, IS_TEST: 'true', VITE_CONVEX_URL: BACKEND_URL }
    });

    await startWebApp();

    // Run Playwright auth setup (unless skipped)
    if (!skipSetup) {
      await runCommand(
        'Playwright Auth Setup',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=setup']
      );
    }

    // Run browser tests
    if (runBrowser) {
      await runCommand(
        'Browser E2E Tests',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=chromium', '--project=unauthenticated']
      );
    }

    // Run CLI E2E tests
    if (runCli) {
      await runCommand(
        'CLI E2E Tests',
        'pnpm',
        ['--filter', 'polychromos', 'test:e2e']
      );
    }

    // Run cross-platform tests
    if (runCrossPlatform) {
      await runCommand(
        'Cross-Platform E2E Tests',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=cross-platform']
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('[E2E] All tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n[E2E] Test suite failed:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Handle signals
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

main();
```

#### 2. Update package.json with unified commands
**File**: `apps/polychromos-app/package.json`

Add new unified test commands:

```json
{
  "scripts": {
    "test:e2e:all": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- node test/e2eRunner.cjs --all",
    "test:e2e:browser": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- node test/e2eRunner.cjs --browser",
    "test:e2e:cli": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- node test/e2eRunner.cjs --cli",
    "test:e2e:cross-platform": "dotenv -e .vercel/.env.development.local -v VITE_CONVEX_URL=http://127.0.0.1:3210 -- node test/e2eRunner.cjs --cross-platform"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/polychromos-app test:e2e:all` runs all tests successfully
- [x] `pnpm --filter @polychromos/polychromos-app test:e2e:browser` runs only browser tests
- [x] `pnpm --filter @polychromos/polychromos-app test:e2e:cli` runs only CLI tests
- [x] Tests exit with code 0 on success, non-zero on failure

#### Manual Verification:
- [ ] All three test suites (browser, CLI, cross-platform) execute in order
- [ ] Auth setup runs before authenticated tests
- [ ] Server cleanup happens even on test failure

**Implementation Note**: After completing this phase, pause for manual testing to verify the unified runner works correctly before proceeding.

---

## Phase 4: Update CI Workflow

### Overview
Update CI workflow to use the same unified test runner as local development.

### Changes Required

#### 1. Update e2e-cli job in CI workflow
**File**: `.github/workflows/ci.yml`

Replace manual server startup steps with unified runner:

```yaml
  e2e-cli:
    name: E2E CLI Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [changes, quality]
    if: needs.changes.outputs.polychromos-cli == 'true' || needs.changes.outputs.convex == 'true'
    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: http://127.0.0.1:3210

    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

      - name: Setup Playwright
        uses: ./.github/actions/playwright-setup

      - name: Run E2E Tests (CLI + Cross-Platform)
        working-directory: apps/polychromos-app
        run: node test/e2eRunner.cjs --cli --cross-platform

      - name: Upload CLI E2E results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cli-e2e-results
          path: packages/polychromos/test-results/
          retention-days: 7

      - name: Upload cross-platform results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cross-platform-results
          path: apps/polychromos-app/test-results/
          retention-days: 7

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cli-playwright-report
          path: apps/polychromos-app/playwright-report/
          retention-days: 7
```

#### 2. Update e2e-browser job
**File**: `.github/workflows/ci.yml`

Update browser tests to also use local Convex:

```yaml
  e2e-browser:
    name: E2E Browser Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [changes, quality]
    if: needs.changes.outputs.polychromos-app == 'true' || needs.changes.outputs.polychromos-cli == 'true'
    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: http://127.0.0.1:3210

    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

      - name: Setup Playwright
        uses: ./.github/actions/playwright-setup

      - name: Run E2E Browser Tests
        working-directory: apps/polychromos-app
        run: node test/e2eRunner.cjs --browser

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: browser-playwright-report
          path: apps/polychromos-app/playwright-report/
          retention-days: 7

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: browser-e2e-results
          path: apps/polychromos-app/test-results/
          retention-days: 7
```

### Success Criteria

#### Automated Verification:
- [x] CI workflow passes with new configuration
- [x] Both e2e-browser and e2e-cli jobs complete successfully
- [x] Artifacts are uploaded correctly on failure

#### Manual Verification:
- [ ] Push branch and verify CI runs correctly
- [ ] Intentionally fail a test to verify artifact upload works

---

## Phase 5: Update Playwright Config

### Overview
Update Playwright config to work consistently in both CI and local environments.

### Changes Required

#### 1. Update webServer configuration
**File**: `apps/polychromos-app/playwright.config.ts`

Remove CI-only webServer since e2eRunner handles server management:

```typescript
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "unauthenticated",
      testDir: "./e2e/browser",
      testMatch: /\.unauth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testDir: "./e2e/browser",
      testIgnore: /\.unauth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
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
  ],

  // webServer is now managed by e2eRunner.cjs
  // This allows consistent behavior between CI and local
});
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @polychromos/polychromos-app test:e2e:all` works locally
- [x] CI workflow still passes

#### Manual Verification:
- [ ] Running `playwright test` directly still works when servers are pre-started

---

## Phase 6: Documentation

### Overview
Update documentation with clear instructions for running E2E tests.

### Changes Required

#### 1. Update CLAUDE.md
**File**: `CLAUDE.md`

Add E2E testing section:

```markdown
## E2E Testing

### Prerequisites

Ensure `.vercel/.env.development.local` contains:
- `E2E_CLERK_USER_EMAIL` - Test user email
- `E2E_CLERK_USER_PASSWORD` - Test user password
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key

Pull from Vercel if needed:
```bash
vercel env pull .vercel/.env.development.local
```

### Running E2E Tests

```bash
# Run all E2E tests (browser + CLI + cross-platform)
pnpm --filter @polychromos/polychromos-app test:e2e:all

# Run only browser tests
pnpm --filter @polychromos/polychromos-app test:e2e:browser

# Run only CLI tests
pnpm --filter @polychromos/polychromos-app test:e2e:cli

# Run only cross-platform tests
pnpm --filter @polychromos/polychromos-app test:e2e:cross-platform
```

### Development Mode

If you're actively developing and have `pnpm dev` running:
```bash
# Skip server startup (reuses existing servers)
pnpm --filter @polychromos/polychromos-app test:e2e:all
```

The test runner automatically detects and reuses running servers.
```

### Success Criteria

#### Automated Verification:
- [x] Documentation added to CLAUDE.md

#### Manual Verification:
- [ ] New developer can follow docs to run E2E tests successfully
- [ ] Documentation matches actual commands and behavior

---

## Testing Strategy

### Unit Tests
- No new unit tests required (this is infrastructure change)

### Integration Tests
- The E2E tests themselves serve as integration tests

### Manual Testing Steps

1. **Local fresh start**:
   - Stop any running dev servers
   - Run `pnpm --filter @polychromos/polychromos-app test:e2e:all`
   - Verify all tests pass

2. **Local with existing servers**:
   - Start `pnpm dev` in one terminal
   - Run `pnpm --filter @polychromos/polychromos-app test:e2e:all` in another
   - Verify tests reuse existing servers

3. **CI verification**:
   - Push changes to branch
   - Verify both e2e-browser and e2e-cli jobs pass

4. **Individual test suites**:
   - Run each `--browser`, `--cli`, `--cross-platform` flag separately
   - Verify they work independently

## Migration Notes

### Breaking Changes
- Old `test:e2e` script behavior changes (now uses unified runner)
- CI workflow uses different startup mechanism

### Rollback Plan
- Revert package.json script changes
- Revert CI workflow changes
- Keep old backendHarness.cjs behavior

## References

- Original research: `thoughts/shared/research/2026-02-03-polychromos-app-e2e-testing-architecture.md`
- CI workflow: `.github/workflows/ci.yml`
- Playwright config: `apps/polychromos-app/playwright.config.ts`
- Backend harness: `apps/polychromos-app/test/backendHarness.cjs`
