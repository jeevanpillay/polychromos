# Polychromos Testing Infrastructure Implementation Plan

## Overview

Set up comprehensive testing infrastructure for the Polychromos packages using Vitest, convex-test, and a local Convex backend. This enables unit testing for validators and version management, integration testing for CLI commands, and E2E testing against a real Convex backend.

## Current State Analysis

- **No test infrastructure exists** - No vitest configs, test files, or test scripts
- **Three packages need testing:**
  - `packages/polychromos` (@polychromos/cli) - CLI with 7 commands, version-manager, config
  - `packages/polychromos-types` (@polychromos/types) - Zod validators, schema, types
  - `apps/polychromos-app` (@repo/polychromos-app) - Convex backend with workspaces/events
- **Monorepo setup:** pnpm + Turborepo, Node 22+
- **Convex backend:** Already configured in `apps/polychromos-app/convex/`

### Key Discoveries:
- Package naming: `@polychromos/cli`, `@polychromos/types`, `@repo/polychromos-app`
- CLI uses `commander`, `rfc6902` for JSON patches, `chokidar` for file watching
- Types package uses Zod v4 for validation
- VersionManager uses file system operations that need mocking with memfs

## Desired End State

After this plan is complete:
1. `pnpm test` runs all tests across the monorepo via Vitest workspace
2. `pnpm test --filter @polychromos/cli` runs CLI package tests with memfs mocking
3. `pnpm test --filter @polychromos/types` runs validator tests
4. `pnpm test --filter @repo/polychromos-app` runs Convex function tests with convex-test
5. CI/CD pipeline runs tests on every PR and push to main
6. Local backend can be started for E2E testing via Justfile

### Verification:
- All test commands execute without errors
- Coverage reports are generated
- CI workflow passes on GitHub Actions

## What We're NOT Doing

- Writing actual test cases (covered in Research 2-4 documents)
- Setting up Playwright for browser E2E tests
- Implementing visual regression testing
- Setting up test database seeding beyond basic scaffolding

## Implementation Approach

We'll set up the infrastructure in layers:
1. Root-level Vitest workspace to orchestrate all packages
2. Package-specific configs tailored to each package's needs
3. Convex local backend tooling for integration/E2E tests
4. CI/CD workflow for automated testing

---

## Phase 1: Root Vitest Workspace Setup

### Overview
Install Vitest at the root level and create a workspace configuration that discovers tests across all packages.

### Changes Required:

#### 1. Root package.json
**File**: `package.json`
**Changes**: Add test scripts and Vitest dependencies

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run --reporter=verbose"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

#### 2. Vitest Root Configuration
**File**: `vitest.config.ts` (new file)
**Changes**: Create root config with projects (replaces deprecated workspace file)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      './packages/polychromos/vitest.config.ts',
      './packages/polychromos-types/vitest.config.ts',
      './apps/polychromos-app/vitest.config.ts',
    ],
  },
});
```

#### 3. Turbo Pipeline Update
**File**: `turbo.json`
**Changes**: Add test tasks to pipeline

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": false
    },
    "test:ci": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": false
    }
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] `pnpm test` command is recognized (will fail until package configs exist)
- [x] TypeScript recognizes vitest workspace config: `pnpm typecheck`

#### Manual Verification:
- [x] Confirm vitest and @vitest/coverage-v8 appear in node_modules

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: CLI Package Testing Setup

### Overview
Configure Vitest for the CLI package with memfs for file system mocking, enabling tests for VersionManager and other file-dependent code.

### Changes Required:

#### 1. CLI Package Dependencies
**File**: `packages/polychromos/package.json`
**Changes**: Add test dependencies and scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "memfs": "^4.17.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

#### 2. Vitest Configuration
**File**: `packages/polychromos/vitest.config.ts` (new file)
**Changes**: Create package-specific config

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'dist/**'],
    },
  },
});
```

#### 3. TypeScript Test Config
**File**: `packages/polychromos/tsconfig.json`
**Changes**: Include test files and vitest types

Update the `compilerOptions` to include vitest globals:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "test/**/*", "vitest.config.ts"]
}
```

#### 4. Test Directory Structure
**Files**: Create test directory scaffolding
- `packages/polychromos/test/setup.ts` - Test setup file
- `packages/polychromos/test/mocks/fs.ts` - memfs mock setup

**File**: `packages/polychromos/test/setup.ts`
```typescript
// Test setup for @polychromos/cli
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Reset any global state between tests
});
```

**File**: `packages/polychromos/test/mocks/fs.ts`
```typescript
import { vol } from 'memfs';
import { vi } from 'vitest';

export function mockFileSystem(files: Record<string, string> = {}) {
  vol.reset();
  vol.fromJSON(files);

  vi.mock('fs/promises', async () => {
    const memfs = await import('memfs');
    return memfs.fs.promises;
  });
}

export function resetFileSystem() {
  vol.reset();
  vi.restoreAllMocks();
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @polychromos/cli install` completes
- [x] `pnpm --filter @polychromos/cli test` runs (passes with no tests found)
- [x] `pnpm --filter @polychromos/cli typecheck` passes

#### Manual Verification:
- [x] Verify test directory structure exists
- [x] Confirm memfs is available in node_modules

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Types Package Testing Setup

### Overview
Configure Vitest for the types package to enable testing of Zod validators and schema definitions.

### Changes Required:

#### 1. Types Package Dependencies
**File**: `packages/polychromos-types/package.json`
**Changes**: Add test dependencies and scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

#### 2. Vitest Configuration
**File**: `packages/polychromos-types/vitest.config.ts` (new file)
**Changes**: Create package-specific config

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

#### 3. TypeScript Configuration Update
**File**: `packages/polychromos-types/tsconfig.json`
**Changes**: Include vitest types

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "vitest.config.ts"]
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @polychromos/types install` completes
- [x] `pnpm --filter @polychromos/types test` runs (passes with no tests found)
- [x] `pnpm --filter @polychromos/types typecheck` passes

#### Manual Verification:
- [x] Verify vitest.config.ts exists in package

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Polychromos-App Testing Setup

### Overview
Configure Vitest for the app with convex-test for testing Convex functions, plus utilities for local backend testing.

### Changes Required:

#### 1. App Package Dependencies
**File**: `apps/polychromos-app/package.json`
**Changes**: Add test dependencies and scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:convex": "vitest run convex/**/*.test.ts",
    "test:e2e": "node test/backendHarness.js 'pnpm run test:e2e:run'",
    "test:e2e:run": "just convex env set IS_TEST true && just convex deploy && vitest run e2e/"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "convex-test": "^0.0.38",
    "@edge-runtime/vm": "^4.0.4",
    "@testing-library/react": "^16.2.0",
    "jsdom": "^26.0.0"
  }
}
```

#### 2. Vitest Configuration
**File**: `apps/polychromos-app/vitest.config.ts` (new file)
**Changes**: Create app-specific config with environment matching

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['convex/**/*.test.ts', 'edge-runtime'],
      ['e2e/**/*.test.ts', 'node'],
      ['src/**/*.test.tsx', 'jsdom'],
    ],
    include: [
      'convex/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
      'e2e/**/*.test.ts',
    ],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['convex/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'convex/_generated/**'],
    },
  },
});
```

#### 3. Test Setup File
**File**: `apps/polychromos-app/test/setup.ts` (new file)
**Changes**: Create test setup

```typescript
import { beforeAll, afterAll } from 'vitest';

// Global setup for all tests
beforeAll(() => {
  process.env.IS_TEST = 'true';
});

afterAll(() => {
  // Cleanup
});
```

#### 4. Convex Testing Helper
**File**: `apps/polychromos-app/test/ConvexTestingHelper.ts` (new file)
**Changes**: Create helper class for local backend testing

```typescript
import { ConvexClient } from 'convex/browser';
import type { FunctionArgs, FunctionReference, UserIdentity } from 'convex/server';

const DEFAULT_ADMIN_KEY =
  '0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd';

export class ConvexTestingHelper {
  private _nextSubjectId = 0;
  public client: ConvexClient;
  private _adminKey: string;

  constructor(options: { adminKey?: string; backendUrl?: string } = {}) {
    this.client = new ConvexClient(options.backendUrl ?? 'http://127.0.0.1:3210');
    this._adminKey = options.adminKey ?? DEFAULT_ADMIN_KEY;
  }

  newIdentity(
    args: Partial<Omit<UserIdentity, 'tokenIdentifier'>>
  ): Omit<UserIdentity, 'tokenIdentifier'> {
    const subject = `test subject ${this._nextSubjectId++}`;
    return { ...args, subject, issuer: 'test issuer' };
  }

  async mutation<M extends FunctionReference<'mutation'>>(fn: M, args: FunctionArgs<M>) {
    return this.client.mutation(fn, args);
  }

  async query<Q extends FunctionReference<'query', 'public'>>(fn: Q, args: FunctionArgs<Q>) {
    return this.client.query(fn, args);
  }

  async close() {
    return this.client.close();
  }
}
```

#### 5. Backend Harness for E2E Tests
**File**: `apps/polychromos-app/test/backendHarness.js` (new file)
**Changes**: Create backend orchestration script

```javascript
const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');

const BACKEND_URL = new URL('http://127.0.0.1:3210');
const CWD = path.dirname(__dirname);

async function isBackendRunning() {
  return new Promise((resolve) => {
    http
      .request(
        {
          hostname: BACKEND_URL.hostname,
          port: BACKEND_URL.port,
          path: '/version',
          method: 'GET',
        },
        (res) => resolve(res.statusCode === 200)
      )
      .on('error', () => resolve(false))
      .end();
  });
}

async function waitForBackend(maxAttempts = 60) {
  let running = await isBackendRunning();
  let attempts = 0;
  while (!running && attempts < maxAttempts) {
    if (attempts % 10 === 0) console.log('Waiting for backend...');
    await new Promise((r) => setTimeout(r, 500));
    running = await isBackendRunning();
    attempts++;
  }
  if (!running) throw new Error('Backend failed to start');
}

let backendProcess = null;

function cleanup() {
  if (backendProcess) {
    console.log('Cleaning up backend');
    backendProcess.kill('SIGTERM');
    try {
      execSync('just reset-local-backend', { cwd: CWD, stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function runWithLocalBackend(command) {
  if (await isBackendRunning()) {
    console.error('Backend already running. Stop it first.');
    process.exit(1);
  }

  try {
    execSync('just reset-local-backend', { cwd: CWD, stdio: 'ignore' });
  } catch {
    // Ignore if no data to reset
  }

  backendProcess = spawn('just', ['run-local-backend'], {
    cwd: CWD,
    stdio: 'pipe',
    env: { ...process.env, CONVEX_TRACE_FILE: '1' },
  });

  await waitForBackend();
  console.log('Backend running! Starting tests...');

  const testProcess = spawn(command, {
    shell: true,
    stdio: 'inherit',
    cwd: CWD,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  return new Promise((resolve) => {
    testProcess.on('exit', (code) => {
      console.log(`Tests exited with code ${code}`);
      resolve(code);
    });
  });
}

// Main
runWithLocalBackend(process.argv[2])
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch(() => {
    cleanup();
    process.exit(1);
  });

process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});
```

#### 6. Justfile for Local Backend
**File**: `apps/polychromos-app/Justfile` (new file)
**Changes**: Create local backend management commands

```just
set shell := ["bash", "-uc"]

# Download and run local backend (auto-detects platform)
run-local-backend:
  #!/usr/bin/env sh
  if [ ! -x ./convex-local-backend ]; then
    if [ "$(uname)" = "Darwin" ]; then
      if [ "$(uname -m)" = "arm64" ]; then
        pkg=convex-local-backend-aarch64-apple-darwin.zip
      elif [ "$(uname -m)" = "x86_64" ]; then
        pkg=convex-local-backend-x86_64-apple-darwin.zip
      fi
    elif [ "$(uname -m)" = "x86_64" ]; then
      pkg=convex-local-backend-x86_64-unknown-linux-gnu.zip
    fi
    curl -L -O "https://github.com/get-convex/convex-backend/releases/latest/download/$pkg"
    unzip "$pkg"
    rm "$pkg"
  fi
  ./convex-local-backend

# Reset all data
reset-local-backend:
  rm -rf convex_local_storage && rm -f convex_local_backend.sqlite3

# Run convex CLI against local backend
convex *ARGS:
  npx convex {{ ARGS }} \
    --admin-key 0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd \
    --url "http://127.0.0.1:3210"
```

#### 7. Test Directory Structure
**Files**: Create directory scaffolding
- `apps/polychromos-app/test/` - Test utilities
- `apps/polychromos-app/e2e/` - E2E tests (empty for now)

#### 8. Update .gitignore
**File**: `apps/polychromos-app/.gitignore` (update or create)
**Changes**: Ignore local backend files

```
# Local Convex backend
convex-local-backend
convex-local-backend.exe
convex_local_storage/
convex_local_backend.sqlite3
*.zip
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @repo/polychromos-app install` completes
- [x] `pnpm --filter @repo/polychromos-app test` runs (passes with no tests found)
- [x] `pnpm --filter @repo/polychromos-app typecheck` passes
- [x] `just --version` returns version (Just 1.46.0 installed via Homebrew)

#### Manual Verification:
- [x] Verify test directory structure exists
- [x] Verify Justfile is created and readable
- [x] `just run-local-backend` downloads and starts the backend (in apps/polychromos-app/)
- [x] `just reset-local-backend` cleans up data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the local backend starts correctly before proceeding to the next phase.

---

## Phase 5: CI/CD Integration

### Overview
Create GitHub Actions workflow to run tests automatically on PRs and pushes to main.

### Changes Required:

#### 1. Test Workflow
**File**: `.github/workflows/test.yml` (new file)
**Changes**: Create CI workflow

```yaml
name: Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install Just
        run: |
          curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run E2E Tests
        run: pnpm --filter @repo/polychromos-app test:e2e
        timeout-minutes: 10
```

### Success Criteria:

#### Automated Verification:
- [x] Workflow file is valid YAML (verified file exists and is not empty)
- [ ] GitHub Actions syntax is valid (will be verified on first push)

#### Manual Verification:
- [ ] Push branch to GitHub and verify workflow appears in Actions tab
- [ ] Workflow runs successfully (even if no tests exist yet)

**Implementation Note**: After completing this phase, the testing infrastructure is complete. Proceed to Research 2-4 documents to implement actual test cases.

---

## Testing Strategy

### Unit Tests (Research 2):
- Validators: Test Zod schemas with valid/invalid inputs
- VersionManager: Test with memfs file system mocking
- Config utilities: Test configuration loading/saving

### Integration Tests (Research 3):
- CLI commands: Test command execution with mocked dependencies
- Convex functions: Test with convex-test mocking

### E2E Tests (Research 4):
- Full flow: Test against local Convex backend
- Workspace creation, updates, undo/redo operations

### Manual Testing Steps:
1. Run `pnpm test` from root - all packages discovered
2. Run individual package tests with filters
3. Start local backend and run E2E tests
4. Verify coverage reports are generated

## Performance Considerations

- Vitest runs tests in parallel by default
- memfs provides fast in-memory file system for CLI tests
- convex-test uses edge-runtime for fast Convex function testing
- Local backend should be started once per E2E test suite, not per test

## Migration Notes

No existing tests to migrate. This is a greenfield setup.

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-testing-1-infrastructure.md`
- Vitest documentation: https://vitest.dev/
- convex-test documentation: https://docs.convex.dev/testing
- Convex local backend: https://github.com/get-convex/convex-backend
