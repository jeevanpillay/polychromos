---
date: 2026-02-03T16:00:00+08:00
researcher: Claude
git_commit: b441a7d528e29d1b88fb51696a90399f9ad0d67a
branch: main
repository: polychromos
topic: "E2E Testing Architecture for Browser-Based CLI Auth Rework"
tags: [research, e2e-testing, authentication, playwright, convex, cli]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: E2E Testing Architecture for Browser-Based CLI Auth Rework

**Date**: 2026-02-03T16:00:00+08:00
**Researcher**: Claude
**Git Commit**: b441a7d528e29d1b88fb51696a90399f9ad0d67a
**Branch**: main
**Repository**: polychromos

## Research Question

Document the current E2E testing architecture in polychromos to inform a complete rework for the new browser-based CLI auth flow. The old manual token auth is being deleted entirely. The new flow has: CLI creates session in Convex → opens browser → user authenticates → CLI polls for token. Tests must use real browser auth flow and support parallelization.

## Summary

The current E2E testing infrastructure consists of:
- **Two test frameworks**: Playwright for browser/cross-platform tests, Vitest for CLI tests
- **Two test locations**: `apps/polychromos-app/e2e/` and `packages/polychromos/test/e2e/`
- **Two servers**: Convex local backend (port 3210) and Vite dev server (port 3001)
- **Token-based auth**: `POLYCHROMOS_TOKEN` environment variable extracted from browser session
- **Hardcoded ports**: 3210 and 3001 are hardcoded in 15+ locations, blocking parallelization

---

## Detailed Findings

### 1. Current Test Infrastructure

#### Test Organization

```
apps/polychromos-app/
├── e2e/
│   ├── global.setup.ts              # Clerk authentication setup
│   ├── browser/                     # Browser UI tests
│   │   ├── access-control.spec.ts
│   │   ├── access-control.unauth.spec.ts
│   │   ├── auth-ui.spec.ts
│   │   ├── auth-ui.unauth.spec.ts
│   │   └── workspace-flow.spec.ts
│   └── cross-platform/              # CLI-web integration
│       └── cli-to-web.spec.ts
├── test/
│   ├── e2eRunner.cjs               # Test orchestration
│   └── backendHarness.cjs          # Server management
└── playwright.config.ts

packages/polychromos/
└── test/e2e/
    ├── setup.ts                    # CLI test setup
    ├── helpers.ts                  # Test utilities
    ├── auth.spec.ts                # CLI auth tests
    ├── dev.spec.ts                 # CLI dev command tests
    └── version.spec.ts             # CLI version tests
```

#### Test Frameworks

| Location | Framework | Purpose |
|----------|-----------|---------|
| `apps/polychromos-app/e2e/` | Playwright 1.58.1 | Browser and cross-platform tests |
| `packages/polychromos/test/e2e/` | Vitest 3.0.0 | CLI command tests |

#### Package.json Scripts (`apps/polychromos-app/package.json:24-32`)

```json
"test:e2e:all": "node test/e2eRunner.cjs --all",
"test:e2e:browser": "node test/e2eRunner.cjs --browser",
"test:e2e:cli": "node test/e2eRunner.cjs --cli",
"test:e2e:cross-platform": "node test/e2eRunner.cjs --cross-platform"
```

All scripts use `dotenv-cli` to load `.vercel/.env.development.local` and set `VITE_CONVEX_URL=http://127.0.0.1:3210`.

#### CI Workflow (`.github/workflows/ci.yml`)

Two E2E jobs in CI:

1. **`e2e-browser`** (lines 65-107): Runs browser tests on `polychromos-app` or `polychromos-cli` changes
2. **`e2e-cli`** (lines 110-161): Runs CLI + cross-platform tests on `polychromos-cli` or `convex` changes

Both jobs:
- Use `ubuntu-latest` runner
- Set `VITE_CONVEX_URL=http://127.0.0.1:3210` in environment
- Pass Clerk secrets via GitHub secrets/variables
- Run 2 workers with 2 retries

---

### 2. Current Authentication in Tests (To Be Replaced)

#### Playwright Auth Setup (`apps/polychromos-app/e2e/global.setup.ts`)

The global setup performs a manual browser-based Clerk login:

1. **Initialize Clerk** (line 13): `await clerkSetup()` from `@clerk/testing/playwright`
2. **Navigate to app** (line 30): `page.goto("/")`
3. **Click Sign In** (lines 42-45): Clicks button matching `/sign in/i`
4. **Wait for modal** (line 49): Waits for `.cl-modalContent`
5. **Enter email** (lines 63-67): Fills from `E2E_CLERK_USER_EMAIL`
6. **Enter password** (lines 72-76): Fills from `E2E_CLERK_USER_PASSWORD`
7. **Wait for auth** (lines 94-96): Waits for `[data-testid='authenticated']`
8. **Save state** (line 116): `page.context().storageState({ path: authFile })`

Storage saved to: `playwright/.clerk/user.json`

#### Token Extraction for CLI Tests

**Cross-platform tests** (`apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts:32-42`):

```typescript
// Extract token from authenticated browser session
const token = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 1000));
  return window.Clerk.session.getToken({ template: 'convex' });
});

// Use token with Convex client
convexClient.setAuth(token);

// Pass to CLI via environment variable
spawn('node', [CLI_PATH, 'dev'], {
  env: { ...process.env, POLYCHROMOS_TOKEN: token },
});
```

**CLI E2E setup** (`packages/polychromos/test/e2e/setup.ts:49-74`):

```typescript
export function getExtractedToken(): string {
  // 1. Check environment variable first (CI override)
  if (process.env.POLYCHROMOS_TOKEN) {
    return process.env.POLYCHROMOS_TOKEN;
  }
  // 2. Check cached value
  if (extractedToken) {
    return extractedToken;
  }
  // 3. Read from shared file (cross-process)
  const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  return data.token;
}
```

#### POLYCHROMOS_TOKEN Usage Locations

| File | Line | Purpose |
|------|------|---------|
| `packages/polychromos/src/lib/credentials.ts` | 52 | Primary check in `loadCredentials()` |
| `packages/polychromos/test/e2e/setup.ts` | 50-115 | Token extraction and caching |
| `packages/polychromos/test/e2e/helpers.ts` | 80 | CLI environment injection |
| `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` | 94, 159 | Spawn CLI with token |

#### Token Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Current Token Flow (Being Replaced)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. global.setup.ts                                             │
│     └── Browser login via Clerk UI                              │
│     └── Saves storageState to playwright/.clerk/user.json       │
│                                                                 │
│  2. cli-to-web.spec.ts                                          │
│     └── Loads storageState                                      │
│     └── Calls window.Clerk.session.getToken({ template: 'convex' })
│     └── Passes POLYCHROMOS_TOKEN env var to CLI                 │
│                                                                 │
│  3. CLI (credentials.ts:loadCredentials)                        │
│     └── Checks process.env.POLYCHROMOS_TOKEN first              │
│     └── Falls back to ~/.polychromos/credentials.json           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Server Infrastructure

#### E2E Runner (`apps/polychromos-app/test/e2eRunner.cjs`)

Orchestrates test execution:

```javascript
async function main() {
  // 1. Start Convex backend
  await startBackend();

  // 2. Deploy schema and set env vars
  execSync('./scripts/local-backend.sh convex env set IS_TEST true');
  execSync('./scripts/local-backend.sh convex env set CLERK_JWT_ISSUER_DOMAIN ...');
  execSync('./scripts/local-backend.sh convex deploy');

  // 3. Start web app
  await startWebApp();

  // 4. Run Playwright auth setup
  execSync('pnpm exec playwright test --project=setup');

  // 5. Run tests based on flags
  if (runBrowser) execSync('playwright test --project=chromium --project=unauthenticated');
  if (runCli) execSync('pnpm --filter polychromos test:e2e');
  if (runCrossPlatform) execSync('playwright test --project=cross-platform');

  // 6. Cleanup
  cleanup();
}
```

#### Backend Harness (`apps/polychromos-app/test/backendHarness.cjs`)

Manages server lifecycles:

**`startBackend()`** (lines 50-82):
1. Check if running at `http://127.0.0.1:3210/version`
2. If not, reset data via `./scripts/local-backend.sh reset`
3. Spawn `./scripts/local-backend.sh run`
4. Wait up to 30 seconds for `/version` endpoint

**`startWebApp()`** (lines 84-123):
1. Check if running at `http://localhost:3001`
2. Spawn `pnpm exec vite dev` (CI) or `pnpm dev:web` (local)
3. Set `VITE_CONVEX_URL=http://127.0.0.1:3210` in environment
4. Wait up to 60 seconds for response

**`cleanup()`** (lines 135-146):
- Kill owned processes with SIGTERM
- Registered on SIGINT/SIGTERM signals

#### Local Backend Script (`apps/polychromos-app/scripts/local-backend.sh`)

- `run`: Downloads and executes `convex-local-backend` binary
- `reset`: Deletes `convex_local_storage/` and `convex_local_backend.sqlite3`
- `convex`: Proxies to `npx convex --admin-key=... --url=http://127.0.0.1:3210`

---

### 4. Parallelization Blockers

#### Hardcoded Port 3210 (Convex Backend)

| File | Line | Usage |
|------|------|-------|
| `apps/polychromos-app/test/backendHarness.cjs` | 5 | `BACKEND_URL = 'http://127.0.0.1:3210'` |
| `apps/polychromos-app/test/e2eRunner.cjs` | 7 | `BACKEND_URL = 'http://127.0.0.1:3210'` |
| `apps/polychromos-app/scripts/local-backend.sh` | 5 | `BACKEND_URL="http://127.0.0.1:3210"` |
| `apps/polychromos-app/scripts/setup-convex.js` | 18 | `BACKEND_URL = "http://127.0.0.1:3210"` |
| `apps/polychromos-app/test/ConvexTestingHelper.ts` | 13 | Default constructor parameter |
| `apps/polychromos-app/package.json` | 24-32 | All `test:e2e:*` scripts |
| `packages/polychromos/test/e2e/setup.ts` | 171, 218 | Health check URLs |
| `packages/polychromos/test/e2e/helpers.ts` | 20 | `createTestWorkspace()` default |
| `packages/polychromos/test/e2e/*.spec.ts` | Various | `ConvexHttpClient` constructors |
| `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` | 23, 69 | Client and config |

#### Hardcoded Port 3001 (Web App)

| File | Line | Usage |
|------|------|-------|
| `apps/polychromos-app/test/backendHarness.cjs` | 6 | `WEB_APP_URL = 'http://localhost:3001'` |
| `apps/polychromos-app/playwright.config.ts` | 3 | Default `baseURL` |
| `packages/polychromos/test/e2e/setup.ts` | 232, 252 | Health check and navigation |

#### Other Blockers

1. **Sequential CLI tests**: `vitest.e2e.config.ts:12` sets `sequence.concurrent: false`
2. **Shared storage state**: All authenticated tests share `playwright/.clerk/user.json`
3. **Single Convex database**: All tests share `convex_local_backend.sqlite3`
4. **Fixed admin key**: `local-backend.sh:6` uses hardcoded `ADMIN_KEY`

---

## Code References

### Authentication Setup
- `apps/polychromos-app/e2e/global.setup.ts:17-118` - Browser auth flow
- `apps/polychromos-app/playwright.config.ts:37` - Storage state path
- `packages/polychromos/src/lib/credentials.ts:49-63` - Token loading with env priority

### Token Extraction
- `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts:32-42` - Browser token extraction
- `packages/polychromos/test/e2e/setup.ts:49-118` - CLI token management
- `packages/polychromos/test/e2e/helpers.ts:76-85` - CLI environment injection

### Server Infrastructure
- `apps/polychromos-app/test/e2eRunner.cjs:36-118` - Test orchestration
- `apps/polychromos-app/test/backendHarness.cjs:50-123` - Server management
- `apps/polychromos-app/scripts/local-backend.sh:13-38` - Backend binary management

### CI Workflow
- `.github/workflows/ci.yml:65-161` - E2E job definitions
- `.github/actions/setup/action.yml` - Node/pnpm setup
- `.github/actions/playwright-setup/action.yml` - Browser caching

---

## Architecture Documentation

### Current Test Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         E2E Test Execution Flow                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  pnpm test:e2e:all                                                       │
│      │                                                                   │
│      ▼                                                                   │
│  dotenv loads .vercel/.env.development.local                             │
│      │                                                                   │
│      ▼                                                                   │
│  e2eRunner.cjs                                                           │
│      │                                                                   │
│      ├── startBackend()                                                  │
│      │       └── ./scripts/local-backend.sh run                          │
│      │       └── Waits for http://127.0.0.1:3210/version                 │
│      │                                                                   │
│      ├── Deploy schema                                                   │
│      │       └── convex env set IS_TEST true                             │
│      │       └── convex env set CLERK_JWT_ISSUER_DOMAIN ...              │
│      │       └── convex deploy                                           │
│      │                                                                   │
│      ├── startWebApp()                                                   │
│      │       └── pnpm exec vite dev                                      │
│      │       └── Waits for http://localhost:3001                         │
│      │                                                                   │
│      ├── Playwright setup                                                │
│      │       └── global.setup.ts                                         │
│      │       └── Clerk login → saves playwright/.clerk/user.json         │
│      │                                                                   │
│      ├── Run tests                                                       │
│      │       ├── --browser: chromium + unauthenticated projects          │
│      │       ├── --cli: pnpm --filter polychromos test:e2e               │
│      │       └── --cross-platform: cross-platform project                │
│      │                                                                   │
│      └── cleanup()                                                       │
│              └── SIGTERM to owned processes                              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Playwright Project Structure

```
playwright.config.ts
├── setup (global.setup.ts)
│     └── Runs once, saves auth state
├── unauthenticated (*.unauth.spec.ts)
│     └── No auth state, no dependencies
├── chromium (*.spec.ts except .unauth)
│     └── Depends on setup, uses storageState
└── cross-platform (e2e/cross-platform/*)
      └── Depends on setup, uses storageState
```

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-03-polychromos-cli-browser-auth-flow.md` - New auth flow design with Convex polling
- `thoughts/shared/research/2026-02-03-polychromos-cli-authentication-current-state.md` - Previous auth research

---

## Related Research

- New auth flow plan referenced in context above describes the replacement architecture

---

## Open Questions

### For New E2E Architecture

1. **How should E2E tests trigger the new browser auth flow?**
   - Option A: Playwright test opens browser, CLI polls via Convex (simulates real user)
   - Option B: Skip browser flow in tests, directly insert token into `cliAuthSessions` table
   - Option C: Hybrid - browser flow for cross-platform tests, direct injection for CLI-only tests

2. **How to support parallel test runs?**
   - Need dynamic port allocation for Convex backend and Vite
   - Each test worker needs isolated Convex database
   - Storage state paths need to be worker-specific

3. **What changes are needed in CI?**
   - Current CI uses hardcoded ports
   - May need to run tests serially or implement port management
   - Consider separate Convex deployments per worker

4. **How should cross-platform tests work?**
   - Currently extract token from browser session
   - New flow: CLI creates session → test opens browser → completes auth → CLI gets token
   - Tests need to orchestrate this multi-step flow

### Blockers to Address

1. **Port 3210 hardcoded in 15+ files** - Need centralized port configuration
2. **Port 3001 hardcoded in 4+ files** - Need configurable web app port
3. **Sequential CLI tests** - Review if parallelization is now safe
4. **Shared Convex database** - Consider per-test or per-worker isolation
