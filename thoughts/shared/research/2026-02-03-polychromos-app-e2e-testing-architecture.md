---
date: 2026-02-02T23:23:23Z
researcher: Claude
git_commit: cf6918f9
branch: feat/polychromos-mvp-implementation
repository: jeevanpillaystudio/x
topic: "Polychromos App E2E Testing Architecture"
tags: [research, e2e-testing, playwright, convex, clerk, polychromos]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Polychromos App E2E Testing Architecture

**Date**: 2026-02-02T23:23:23Z
**Researcher**: Claude
**Git Commit**: cf6918f9
**Branch**: feat/polychromos-mvp-implementation
**Repository**: jeevanpillaystudio/x

## Research Question

How do the polychromos-app E2E tests work, including cross-platform tests, backend configurations, CI setup, and what would be needed to run cross-platform tests locally with a local Convex backend?

## Summary

The polychromos-app E2E testing system has three distinct test tiers:

1. **Browser tests** (`test:e2e:playwright`) - Standard Playwright tests against the web app with cloud Convex
2. **CLI E2E tests** (`test:e2e` via backendHarness) - CLI tests that run against a local Convex backend
3. **Cross-platform tests** (`test:e2e:cross-platform`) - Tests that verify CLI ↔ web app synchronization via Convex

The cross-platform tests require both a running web app AND a local Convex backend to test that CLI changes sync correctly and are visible in the web interface.

## Detailed Findings

### 1. Cross-Platform Tests Architecture

**Location**: `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts`

The cross-platform tests validate that the CLI and web app can work together through a shared Convex backend:

```typescript
// The test connects to local Convex backend
convexClient = new ConvexHttpClient('http://127.0.0.1:3210');
```

**Test flow**:
1. Uses Playwright with authenticated browser context (from `storageState: 'playwright/.clerk/user.json'`)
2. Extracts a Convex JWT token from the authenticated Clerk session
3. Spawns the CLI `dev` command pointing at the same local Convex backend
4. Modifies `design.json` files and verifies changes sync via Convex API
5. Verifies the web app can access the updated workspace

**Key file**: `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts:22-41`

```typescript
test.beforeAll(async ({ browser }) => {
  convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

  // Extract token from browser context
  const page = await browser.newPage({
    storageState: 'playwright/.clerk/user.json',
  });
  await page.goto('/');
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  token = await page.evaluate(async () => {
    // @ts-expect-error Clerk is globally available
    return await window.Clerk.session.getToken({ template: 'convex' });
  });
  // ...
  convexClient.setAuth(token);
});
```

### 2. Global Setup and Clerk Authentication

**Location**: `apps/polychromos-app/e2e/global.setup.ts`

**Why it needs the web app**:
The global setup authenticates via Clerk's web-based OAuth/password flow. It:
1. Navigates to the web app at `baseURL` (localhost:3001 or configured URL)
2. Clicks the "Sign In" button to open Clerk's modal
3. Enters credentials from `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD` environment variables
4. Waits for the `[data-testid='authenticated']` element to appear
5. Saves the browser storage state (cookies, localStorage) to `playwright/.clerk/user.json`

```typescript
// apps/polychromos-app/e2e/global.setup.ts:14-51
setup("authenticate", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForSelector(".cl-modalContent", { timeout: 10000 });

  // Two-step flow: email then password
  await emailInput.fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await passwordInput.fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  // Save auth state
  await page.context().storageState({ path: authFile });
});
```

**Storage state file**: `playwright/.clerk/user.json`

This JSON file contains:
- Clerk session cookies
- localStorage tokens
- Other browser state needed to maintain authentication

Subsequent test projects that specify `storageState: "playwright/.clerk/user.json"` load this pre-authenticated state instead of re-authenticating.

### 3. Test Backend Configurations

#### Local Convex Backend (http://127.0.0.1:3210)

**Configuration**: `apps/polychromos-app/scripts/local-backend.sh`

The local backend script:
- Downloads the `convex-local-backend` binary if not present (platform-specific)
- Runs the backend on port 3210
- Provides `reset` command to clear local data
- Provides `convex` wrapper to run Convex CLI against local backend with admin key

```bash
# Admin key for local backend
ADMIN_KEY="0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd"
```

#### Cloud Convex (via VITE_CONVEX_URL)

**Configuration**: Set via environment variable or `.vercel/.env.development.local`

The web app reads `VITE_CONVEX_URL` at runtime:
```typescript
// apps/polychromos-app/src/router.tsx:13
const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string;
```

This is a Vite environment variable that gets baked into the client bundle at build time.

#### How the Web App Chooses Backend

The web app uses `VITE_CONVEX_URL` from environment variables:
- In CI for e2e-cli.yml: `VITE_CONVEX_URL: http://127.0.0.1:3210`
- In CI for e2e.yml: Uses cloud URL from `vars.VITE_CONVEX_URL`
- Locally: Reads from `.vercel/.env.development.local`

### 4. Test Script Relationships

#### `test:e2e` (CLI E2E via backendHarness)

**Package**: `apps/polychromos-app`
**Script**: `node test/backendHarness.cjs 'pnpm run test:e2e:run'`

**Flow**:
1. `backendHarness.cjs` checks if backend is already running (fails if so)
2. Resets local Convex data via `./scripts/local-backend.sh reset`
3. Spawns `./scripts/local-backend.sh run` to start local backend
4. Waits for backend to be ready (polls `/version` endpoint)
5. Runs the wrapped command (`test:e2e:run`)
6. Cleans up backend on exit

**backendHarness.cjs key logic** (`apps/polychromos-app/test/backendHarness.cjs:51-84`):
```javascript
async function runWithLocalBackend(command) {
  if (await isBackendRunning()) {
    console.error('Backend already running. Stop it first.');
    process.exit(1);
  }
  // Reset, start backend, wait for ready, run tests
}
```

#### `test:e2e:playwright` (Browser Tests)

**Package**: `apps/polychromos-app`
**Script**: `playwright test`

Runs all Playwright browser tests (`e2e/browser/`) with cloud Convex backend. Does NOT use local backend or backendHarness.

#### `test:e2e:cross-platform` (CLI ↔ Web Sync)

**Package**: `apps/polychromos-app`
**Script**: `playwright test --project=cross-platform`

Runs only the cross-platform test project. Expects both:
- Local Convex backend running on `127.0.0.1:3210`
- Web app running on `localhost:3001` connected to that local backend

### 5. CI Workflow Configuration

#### `.github/workflows/e2e.yml` (Browser E2E)

Runs browser tests against **cloud Convex**:
- Uses `VITE_CONVEX_URL` from repository variables (cloud deployment)
- Builds the app and runs `test:e2e:playwright`
- Does NOT start local Convex backend

```yaml
env:
  VITE_CONVEX_URL: ${{ vars.VITE_CONVEX_URL }}  # Cloud URL
steps:
  - run: pnpm --filter @polychromos/polychromos-app build
  - run: pnpm --filter @polychromos/polychromos-app test:e2e:playwright
```

#### `.github/workflows/e2e-cli.yml` (CLI + Cross-Platform E2E)

Runs CLI tests and cross-platform tests against **local Convex**:

```yaml
env:
  VITE_CONVEX_URL: http://127.0.0.1:3210  # Local backend!
steps:
  - name: Start local Convex backend
    run: |
      cd apps/polychromos-app
      npx convex dev &
      # Wait for backend ready...

  - name: Start web app
    run: |
      cd apps/polychromos-app
      pnpm dev:web &
      # Wait for web app ready...

  - name: Run Playwright setup (authenticate)
    run: pnpm exec playwright test --project=setup

  - name: Run CLI E2E tests
    run: pnpm --filter polychromos test:e2e

  - name: Run cross-platform tests
    run: pnpm exec playwright test --project=cross-platform
```

#### webServer Config in playwright.config.ts

```typescript
// apps/polychromos-app/playwright.config.ts:60-67
webServer: process.env.CI
  ? {
      command: "pnpm dev",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120 * 1000,
    }
  : undefined,  // Don't start server locally - assume it's already running
```

- **In CI**: Playwright can auto-start the web app via `pnpm dev`
- **Locally**: Assumes developer has already started the app manually

**Note**: The e2e-cli.yml workflow starts the web app separately (`pnpm dev:web &`) before running Playwright, so it doesn't rely on the `webServer` config.

### 6. CLI E2E Test Setup (packages/polychromos)

**Location**: `packages/polychromos/test/e2e/setup.ts`

The CLI package has its own E2E test setup that:
1. Checks for `POLYCHROMOS_TOKEN` environment variable
2. Falls back to extracting token from Playwright auth state file
3. Launches a browser, loads the auth state, and extracts a Convex JWT via `Clerk.session.getToken({ template: 'convex' })`
4. Saves the token for CLI tests to use

**Token extraction** (`packages/polychromos/test/e2e/setup.ts:246-279`):
```typescript
async function extractClerkToken(browser: Browser): Promise<string> {
  const page = await browser.newPage({
    storageState: PLAYWRIGHT_AUTH_STATE,  // playwright/.clerk/user.json
  });
  await page.goto('http://localhost:3001');
  await page.waitForSelector('[data-testid="authenticated"]');

  const token = await page.evaluate(async () => {
    return await window.Clerk.session.getToken({ template: 'convex' });
  });
  return token;
}
```

This is why the CLI E2E tests depend on:
1. The web app running (to navigate to and extract token)
2. The Playwright setup having run (to create the auth state file)

### 7. Running Cross-Platform Tests Locally

To run cross-platform tests locally with a local Convex backend:

**Prerequisites**:
1. Environment variables set:
   - `E2E_CLERK_USER_EMAIL` - Test user email
   - `E2E_CLERK_USER_PASSWORD` - Test user password
   - `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key

2. Start local Convex backend:
   ```bash
   cd apps/polychromos-app
   ./scripts/local-backend.sh run
   ```

3. Start web app pointing to local backend:
   ```bash
   # Set VITE_CONVEX_URL to local backend
   VITE_CONVEX_URL=http://127.0.0.1:3210 pnpm dev:web
   ```

4. Run Playwright setup to authenticate:
   ```bash
   pnpm exec playwright test --project=setup
   ```

5. Run cross-platform tests:
   ```bash
   pnpm exec playwright test --project=cross-platform
   ```

**Key requirement**: The web app must be built/running with `VITE_CONVEX_URL=http://127.0.0.1:3210` for the cross-platform tests to work, because:
- The web app will connect to whatever Convex URL was baked in at build time
- The CLI and cross-platform tests hardcode `http://127.0.0.1:3210`
- They must match for CLI changes to be visible in the web app

## Code References

- `apps/polychromos-app/playwright.config.ts` - Playwright test configuration with 4 projects
- `apps/polychromos-app/e2e/global.setup.ts` - Clerk authentication setup
- `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` - CLI-to-web sync tests
- `apps/polychromos-app/test/backendHarness.cjs` - Local backend management for tests
- `apps/polychromos-app/scripts/local-backend.sh` - Local Convex backend runner
- `apps/polychromos-app/src/router.tsx:13` - Where web app reads VITE_CONVEX_URL
- `packages/polychromos/test/e2e/setup.ts` - CLI E2E test setup with token extraction
- `packages/polychromos/test/e2e/helpers.ts` - CLI test helper utilities
- `.github/workflows/e2e.yml` - Browser E2E CI workflow (cloud Convex)
- `.github/workflows/e2e-cli.yml` - CLI E2E CI workflow (local Convex)

## Architecture Documentation

### Test Project Structure in Playwright

```
projects:
├── setup                 # Authenticates with Clerk, saves state
├── unauthenticated      # Tests without auth (*.unauth.spec.ts)
├── chromium             # Main browser tests (depends on setup)
└── cross-platform       # CLI↔Web tests (depends on setup)
```

### Data Flow for Cross-Platform Tests

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Execution                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Playwright Setup Project                                     │
│     ├── Opens browser, navigates to web app                     │
│     ├── Authenticates via Clerk modal                           │
│     └── Saves state to playwright/.clerk/user.json              │
│                                                                  │
│  2. Cross-Platform Test                                          │
│     ├── Loads auth state into new browser context               │
│     ├── Extracts Convex JWT token via Clerk.session.getToken()  │
│     ├── Creates workspace via ConvexHttpClient                   │
│     ├── Spawns CLI `dev` command with token                     │
│     ├── Modifies design.json → CLI syncs to Convex             │
│     └── Verifies via Convex API and web app page                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CLI (dev)   │────▶│  Local Convex    │◀────│   Web App       │
│  + Token     │     │  127.0.0.1:3210  │     │  localhost:3001 │
└──────────────┘     └──────────────────┘     └─────────────────┘
       │                      │                        │
       │              ┌───────┴───────┐                │
       └─────────────▶│   Workspace   │◀───────────────┘
                      │     Data      │
                      └───────────────┘
```

### Environment Variable Configuration

| Variable | e2e.yml (browser) | e2e-cli.yml (CLI) | Local Dev |
|----------|------------------|-------------------|-----------|
| `VITE_CONVEX_URL` | Cloud URL | `http://127.0.0.1:3210` | `.vercel/.env.development.local` |
| `E2E_CLERK_USER_EMAIL` | Secret | Secret | Manual |
| `E2E_CLERK_USER_PASSWORD` | Secret | Secret | Manual |
| `VITE_CLERK_PUBLISHABLE_KEY` | Variable | Variable | Env file |

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-02-polychromos-e2e-testing-cli-convex.md` - Original planning for CLI-Convex E2E testing
- `thoughts/shared/research/2026-02-02-polychromos-testing-4-e2e-tests.md` - Previous research on E2E test infrastructure

## Open Questions

1. **Token expiration**: The extracted Clerk→Convex JWT has a limited lifetime. For long-running test sessions, token refresh may be needed.

2. **Local env file**: Currently no documented `.env.test` or `.env.local` file that sets `VITE_CONVEX_URL=http://127.0.0.1:3210` for local development. Developers must manually override.

3. **webServer config**: The `webServer` config in playwright.config.ts runs `pnpm dev` which starts BOTH web app AND Convex dev. For local backend testing, this may conflict with the manually-started local backend.
