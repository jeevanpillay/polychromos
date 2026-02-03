---
date: 2026-02-02T15:30:00+08:00
researcher: Claude
git_commit: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos Testing Infrastructure Setup"
tags: [research, testing, polychromos, vitest, convex-test, local-backend]
status: complete
priority: 1
dependencies: []
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research 1: Polychromos Testing Infrastructure Setup

**Priority**: 1 (Foundation)
**Dependencies**: None
**Estimated Effort**: 2-3 hours

## Overview

This document covers the foundational test infrastructure setup that all other testing depends on. It includes Vitest configuration, convex-test setup, and Convex local backend orchestration.

## What This Document Covers

1. Vitest workspace configuration
2. Package-level Vitest configs
3. Convex local backend setup (Justfile, Docker)
4. Backend harness for test orchestration
5. Testing helper utilities
6. CI/CD workflow foundation

## Prerequisites

- Node.js 20+
- pnpm
- Just (for local backend management)

---

## 1. Root Vitest Workspace Configuration

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './packages/polychromos/vitest.config.ts',
  './packages/polychromos-types/vitest.config.ts',
  './apps/polychromos/vitest.config.ts',
]);
```

---

## 2. Package-Level Configurations

### CLI Package (`packages/polychromos/vitest.config.ts`)

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
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

### Types Package (`packages/polychromos-types/vitest.config.ts`)

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
    },
  },
});
```

### Web App (`apps/polychromos/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['convex/**/*.test.ts', 'edge-runtime'],  // convex-test mock
      ['e2e/**/*.test.ts', 'node'],              // local backend
      ['src/**/*.test.tsx', 'jsdom'],            // React components
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
  },
});
```

---

## 3. Convex Local Backend Setup

### Justfile (`apps/polychromos/Justfile`)

```just
set shell := ["bash", "-uc"]

# Download and run local backend (auto-detects platform)
run-local-backend:
  #!/usr/bin/env sh
  if [ ! -x ./convex-local-backend ]; then
    if [ "$(uname)" == "Darwin" ]; then
      if [ "$(uname -m)" == "arm64" ]; then
        pkg=convex-local-backend-aarch64-apple-darwin.zip
      elif [ "$(uname -m)" == "x86_64" ]; then
        pkg=convex-local-backend-x86_64-apple-darwin.zip
      fi
    elif [ "$(uname -m)" == "x86_64" ]; then
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

### Docker Compose (Alternative)

```yaml
# apps/polychromos/docker-compose.test.yml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
      - "3211:3211"
    volumes:
      - convex-data:/convex/data
    environment:
      - CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210
      - CONVEX_SITE_ORIGIN=http://127.0.0.1:3211
    healthcheck:
      test: curl -f http://localhost:3210/version
      interval: 5s
      start_period: 10s

volumes:
  convex-data:
```

---

## 4. Backend Harness for Test Orchestration

```javascript
// apps/polychromos/test/backendHarness.js
const http = require("http");
const { spawn, execSync } = require("child_process");

const BACKEND_URL = new URL("http://127.0.0.1:3210");

async function isBackendRunning() {
  return new Promise((resolve) => {
    http
      .request({
        hostname: BACKEND_URL.hostname,
        port: BACKEND_URL.port,
        path: "/version",
        method: "GET",
      }, (res) => resolve(res.statusCode === 200))
      .on("error", () => resolve(false))
      .end();
  });
}

async function waitForBackend(maxAttempts = 60) {
  let running = await isBackendRunning();
  let attempts = 0;
  while (!running && attempts < maxAttempts) {
    if (attempts % 10 === 0) console.log("Waiting for backend...");
    await new Promise(r => setTimeout(r, 500));
    running = await isBackendRunning();
    attempts++;
  }
  if (!running) throw new Error("Backend failed to start");
}

let backendProcess = null;

function cleanup() {
  if (backendProcess) {
    console.log("Cleaning up backend");
    backendProcess.kill("SIGTERM");
    execSync("just reset-local-backend", { cwd: __dirname });
  }
}

async function runWithLocalBackend(command) {
  if (await isBackendRunning()) {
    console.error("Backend already running. Stop it first.");
    process.exit(1);
  }

  execSync("just reset-local-backend", { cwd: __dirname });
  backendProcess = spawn("just", ["run-local-backend"], {
    cwd: __dirname,
    stdio: "pipe",
    env: { ...process.env, CONVEX_TRACE_FILE: "1" }
  });

  await waitForBackend();
  console.log("Backend running! Starting tests...");

  const testProcess = spawn(command, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "true" }
  });

  return new Promise((resolve) => {
    testProcess.on("exit", (code) => {
      console.log(`Tests exited with code ${code}`);
      resolve(code);
    });
  });
}

// Main
runWithLocalBackend(process.argv[2])
  .then((code) => { cleanup(); process.exit(code); })
  .catch(() => { cleanup(); process.exit(1); });

process.on("SIGINT", () => { cleanup(); process.exit(1); });
process.on("SIGTERM", () => { cleanup(); process.exit(1); });
```

---

## 5. Testing Helper Utilities

### ConvexTestingHelper Class

```typescript
// apps/polychromos/test/ConvexTestingHelper.ts
import { ConvexClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, UserIdentity } from "convex/server";

const DEFAULT_ADMIN_KEY = "0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd";

export class ConvexTestingHelper {
  private _nextSubjectId = 0;
  public client: ConvexClient;
  private _adminKey: string;

  constructor(options: { adminKey?: string; backendUrl?: string } = {}) {
    this.client = new ConvexClient(options.backendUrl ?? "http://127.0.0.1:3210");
    this._adminKey = options.adminKey ?? DEFAULT_ADMIN_KEY;
  }

  newIdentity(args: Partial<Omit<UserIdentity, "tokenIdentifier">>): Omit<UserIdentity, "tokenIdentifier"> {
    const subject = `test subject ${this._nextSubjectId++}`;
    return { ...args, subject, issuer: "test issuer" };
  }

  async mutation<M extends FunctionReference<"mutation">>(fn: M, args: FunctionArgs<M>) {
    return this.client.mutation(fn, args);
  }

  async query<Q extends FunctionReference<"query", "public">>(fn: Q, args: FunctionArgs<Q>) {
    return this.client.query(fn, args);
  }

  async close() {
    return this.client.close();
  }
}
```

### Test Setup File

```typescript
// apps/polychromos/test/setup.ts
import { beforeAll, afterAll } from 'vitest';

// Global setup for all tests
beforeAll(() => {
  // Set test environment flag
  process.env.IS_TEST = 'true';
});

afterAll(() => {
  // Cleanup
});
```

### Testing Functions (Convex)

```typescript
// apps/polychromos/convex/testingFunctions.ts
import { mutation } from "./_generated/server";
import schema from "./schema";

function requireTestEnv() {
  if (process.env.IS_TEST === undefined) {
    throw new Error("Test function called outside test environment");
  }
}

export const clearAll = mutation({
  args: {},
  handler: async ({ db, scheduler, storage }) => {
    requireTestEnv();

    // Clear all application tables
    for (const table of Object.keys(schema.tables)) {
      const docs = await db.query(table as any).collect();
      await Promise.all(docs.map((doc) => db.delete(doc._id)));
    }

    // Cancel all scheduled functions
    const scheduled = await db.system.query("_scheduled_functions").collect();
    await Promise.all(scheduled.map((s) => scheduler.cancel(s._id)));

    // Delete all stored files
    const storedFiles = await db.system.query("_storage").collect();
    await Promise.all(storedFiles.map((s) => storage.delete(s._id)));
  },
});

export const seedTestData = mutation({
  args: {},
  handler: async ({ db }) => {
    requireTestEnv();

    const workspaceId = await db.insert("workspaces", {
      name: "Test Workspace",
      data: {
        id: "test_ws",
        version: "1.0",
        name: "Test",
        components: {
          main: {
            id: "main",
            name: "main",
            width: 1024,
            height: 768,
            root: { id: "root", type: "box" },
          },
        },
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return workspaceId;
  },
});
```

---

## 6. Package.json Updates

### Root package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:ci": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0"
  }
}
```

### CLI Package

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "memfs": "^4.0.0"
  }
}
```

### Types Package

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

### Web App

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:convex": "vitest run convex/**/*.test.ts",
    "test:e2e": "node test/backendHarness.js 'npm run test:e2e:run'",
    "test:e2e:run": "just convex env set IS_TEST true && just convex deploy && vitest run e2e/"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "convex-test": "^0.1.0",
    "@edge-runtime/vm": "^4.0.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0"
  }
}
```

---

## 7. Turbo Pipeline

```json
// turbo.json (add to existing)
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": false
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "outputs": [],
      "cache": false
    }
  }
}
```

---

## 8. CI/CD Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm test:ci

  e2e-tests:
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
      - run: pnpm install
      - name: E2E Tests
        run: pnpm --filter @repo/polychromos test:e2e
        timeout-minutes: 10
```

---

## Verification Checklist

- [ ] `pnpm test` runs from root and discovers all test files
- [ ] `pnpm --filter @polychromos/cli test` runs CLI tests
- [ ] `pnpm --filter @polychromos/types test` runs types tests
- [ ] `pnpm --filter @repo/polychromos test` runs app tests
- [ ] `just run-local-backend` starts Convex locally
- [ ] `just reset-local-backend` clears all data
- [ ] Backend harness starts/stops cleanly

---

## Next Steps

After completing this infrastructure setup, proceed to:
- **Research 2**: Unit Test Implementation (validators, generators, version manager)
- **Research 3**: Integration Test Implementation (CLI commands, Convex sync)
- **Research 4**: E2E Test Implementation (full flow testing)
