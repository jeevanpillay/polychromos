---
date: 2026-02-03T08:30:00Z
researcher: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "CI Testing Pipeline Evaluation and Optimization"
tags: [research, ci-cd, testing, github-actions, vitest, playwright, performance, optimization]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
last_updated_note: "Removed 'just' command runner - replaced with npm scripts"
---

# Research: CI Testing Pipeline Evaluation and Optimization

**Date**: 2026-02-03T08:30:00Z
**Researcher**: Claude
**Git Commit**: cedfb4bbf2f1a7801785b0d985611f71b95f4049
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Evaluate the current CI testing pipeline for performance, speed, efficiency, and proper workflow. Document what exists and provide recommendations for improvement.

## Summary

The monorepo has **3 separate GitHub Actions workflows** for testing with significant overlap and inefficiencies:

1. **test.yml** - Unit tests + duplicate E2E tests (runs both on every PR)
2. **e2e.yml** - Playwright browser E2E tests (path-filtered)
3. **e2e-cli.yml** - CLI E2E + cross-platform tests (path-filtered)

Key issues identified:
- **Duplicate E2E execution** in test.yml (always runs) vs e2e.yml/e2e-cli.yml (path-filtered)
- **No caching optimization** - Each workflow reinstalls dependencies from scratch
- **No parallelization** - Jobs run sequentially instead of in parallel where possible
- **Inconsistent Node versions** - test.yml uses Node 22, e2e.yml uses Node 20
- **Inconsistent pnpm action versions** - v4 vs v2
- **No dependency caching** for Playwright browsers

## Current State Analysis

### Workflow 1: test.yml

```yaml
name: Test
on:
  pull_request:
  push:
    branches: [main]
```

**Jobs:**
1. `unit-tests` - Runs `pnpm test:ci` (vitest)
2. `e2e-tests` - Runs `pnpm --filter @repo/polychromos-app test:e2e`

**Issues:**
- E2E tests run on EVERY PR, even if no changes to polychromos-app
- No path filtering for efficiency

**Recent Change:** The `just` command runner was removed and replaced with npm scripts, eliminating the need to install Just CLI in CI.

### Workflow 2: e2e.yml

```yaml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    paths:
      - "apps/polychromos-app/**"
      - "packages/polychromos/**"
      - ".github/workflows/e2e.yml"
```

**Strengths:**
- Path filtering for efficiency
- Uploads test artifacts

**Issues:**
- Duplicates E2E already in test.yml
- Uses Node 20 (inconsistent with test.yml's Node 22)
- Uses pnpm/action-setup@v2 (outdated)

### Workflow 3: e2e-cli.yml

```yaml
name: CLI E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    paths:
      - "packages/polychromos/**"
      - "apps/polychromos-app/convex/**"
      - ".github/workflows/e2e-cli.yml"
```

**Strengths:**
- Path filtering
- Complex setup with local Convex backend
- Cross-platform test coverage

**Issues:**
- 20-minute timeout is excessive
- Sequential polling for service readiness (slow)
- Uses Node 20 (inconsistent)

## Configuration Analysis

### Turbo Configuration (turbo.json)

```json
{
  "test": {
    "dependsOn": ["^build"],
    "cache": false
  },
  "test:ci": {
    "dependsOn": ["^build"],
    "cache": false
  },
  "test:e2e:playwright": {
    "dependsOn": ["build"],
    "cache": false
  }
}
```

**Issue:** All test tasks have `cache: false`, preventing Turborepo from skipping unchanged tests.

### Vitest Configuration

**Root vitest.config.ts:**
```typescript
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

**Issue:** Projects are defined but workspace feature not fully utilized.

### Playwright Configuration

```typescript
export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,  // Single worker in CI
  retries: process.env.CI ? 2 : 0,
  projects: [
    { name: "setup" },
    { name: "unauthenticated" },
    { name: "chromium", dependencies: ["setup"] },
    { name: "cross-platform", dependencies: ["setup"] },
  ],
});
```

**Issue:** `workers: 1` in CI negates `fullyParallel: true`.

## Evaluation & Recommendations

### 1. Consolidate Workflows (High Impact)

**Current:** 3 workflows with overlap
**Proposed:** Single unified workflow with conditional jobs

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.filter.outputs.packages }}
      polychromos-app: ${{ steps.filter.outputs.polychromos-app }}
      polychromos-cli: ${{ steps.filter.outputs.polychromos-cli }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            packages:
              - 'packages/**'
            polychromos-app:
              - 'apps/polychromos-app/**'
            polychromos-cli:
              - 'packages/polychromos/**'

  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup  # Reusable setup
      - run: pnpm lint && pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: pnpm test:ci

  e2e-browser:
    runs-on: ubuntu-latest
    needs: [changes, unit-tests]
    if: needs.changes.outputs.polychromos-app == 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - uses: ./.github/actions/playwright-setup
      - run: pnpm --filter @repo/polychromos-app test:e2e:playwright

  e2e-cli:
    runs-on: ubuntu-latest
    needs: [changes, unit-tests]
    if: needs.changes.outputs.polychromos-cli == 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - uses: ./.github/actions/playwright-setup
      - run: pnpm --filter @polychromos/cli test:e2e
```

### 2. Create Reusable Composite Actions (High Impact)

**.github/actions/setup/action.yml:**
```yaml
name: 'Setup'
description: 'Setup pnpm and Node.js with caching'
runs:
  using: 'composite'
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'pnpm'

    - name: Get pnpm store directory
      id: pnpm-cache
      shell: bash
      run: echo "store=$(pnpm store path)" >> $GITHUB_OUTPUT

    - name: Cache pnpm dependencies
      uses: actions/cache@v4
      with:
        path: ${{ steps.pnpm-cache.outputs.store }}
        key: pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: pnpm-store-

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile

    - name: Build packages
      shell: bash
      run: pnpm build
```

**.github/actions/playwright-setup/action.yml:**
```yaml
name: 'Playwright Setup'
description: 'Setup Playwright with browser caching'
runs:
  using: 'composite'
  steps:
    - name: Get Playwright version
      id: playwright-version
      shell: bash
      run: echo "version=$(pnpm list @playwright/test --json | jq -r '.[0].dependencies["@playwright/test"].version')" >> $GITHUB_OUTPUT

    - name: Cache Playwright browsers
      uses: actions/cache@v4
      id: playwright-cache
      with:
        path: ~/.cache/ms-playwright
        key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}

    - name: Install Playwright browsers
      if: steps.playwright-cache.outputs.cache-hit != 'true'
      shell: bash
      run: pnpm exec playwright install --with-deps chromium
```

### 3. Enable Turborepo Remote Caching (High Impact)

Add to workflows:
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Enable caching for tests in turbo.json:
```json
{
  "test:ci": {
    "dependsOn": ["^build"],
    "outputs": ["coverage/**"],
    "inputs": ["src/**", "test/**", "vitest.config.ts"],
    "cache": true
  }
}
```

### 4. Increase Playwright Workers (Medium Impact)

```typescript
// playwright.config.ts
workers: process.env.CI ? 2 : undefined,  // Increase from 1 to 2
```

GitHub-hosted runners have 2 vCPUs - utilize them.

### 5. Optimize Service Startup in e2e-cli.yml (Medium Impact)

Replace polling loops with health check actions:
```yaml
- name: Start local Convex backend
  run: npx convex dev &

- name: Wait for Convex
  uses: iFaxity/wait-on-action@v1
  with:
    resource: http://127.0.0.1:3210/version
    timeout: 60000

- name: Start web app
  run: pnpm dev:web &

- name: Wait for web app
  uses: iFaxity/wait-on-action@v1
  with:
    resource: http://localhost:3001
    timeout: 60000
```

### 6. Standardize Node.js Version (Low Impact, High Consistency)

Update all workflows to use Node 22:
- test.yml: ✓ Already Node 22
- e2e.yml: Change from 20 → 22
- e2e-cli.yml: Change from 20 → 22

### 7. Add Fail-Fast and Matrix Strategy (Medium Impact)

For running multiple test suites in parallel:
```yaml
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        suite:
          - { name: 'Unit', cmd: 'pnpm test:ci' }
          - { name: 'Lint', cmd: 'pnpm lint' }
          - { name: 'Types', cmd: 'pnpm typecheck' }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup
      - run: ${{ matrix.suite.cmd }}
```

### 8. Add Concurrency Control (Low Impact)

Prevent redundant runs on rapid pushes:
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

## Expected Impact

| Optimization | Time Saved | Complexity |
|-------------|------------|------------|
| Playwright browser caching | 30-60s | Low |
| Path filtering consolidation | 2-5 min (skipped runs) | Medium |
| Turborepo remote cache | 1-3 min | Low |
| Composite actions | 10-20s | Medium |
| Parallel matrix jobs | 30-60s | Medium |
| Increased workers | 20-40s | Low |

**Total potential improvement:** 30-50% faster CI on changed paths, complete skip on unchanged paths.

## Code References

- `.github/workflows/test.yml:1-70` - Main test workflow
- `.github/workflows/e2e.yml:1-63` - Playwright E2E workflow
- `.github/workflows/e2e-cli.yml:1-112` - CLI E2E workflow
- `turbo.json:39-60` - Test task configuration
- `vitest.config.ts:1-12` - Root vitest configuration
- `apps/polychromos-app/playwright.config.ts:1-68` - Playwright configuration

## Architecture Documentation

### Current Workflow Architecture
```
PR/Push to main
├── test.yml (always runs)
│   ├── unit-tests
│   │   └── pnpm test:ci (vitest workspace)
│   └── e2e-tests
│       └── pnpm --filter @repo/polychromos-app test:e2e
├── e2e.yml (path-filtered)
│   └── e2e
│       └── pnpm --filter @repo/polychromos-app test:e2e:playwright
└── e2e-cli.yml (path-filtered)
    └── cli-e2e
        ├── Start Convex backend
        ├── Start web app
        ├── Playwright setup auth
        ├── CLI E2E tests
        └── Cross-platform tests
```

### Proposed Workflow Architecture
```
PR/Push to main
└── ci.yml (unified)
    ├── changes (path detection)
    ├── lint-typecheck (always)
    ├── unit-tests (depends: lint-typecheck)
    ├── e2e-browser (conditional on polychromos-app changes)
    └── e2e-cli (conditional on polychromos changes)
```

## Recent Changes

### Removal of `just` Command Runner

The `just` command runner (Justfile at `apps/polychromos-app/Justfile`) has been removed and replaced with npm scripts. This eliminates:
- The need to install `just` CLI in CI workflows
- An extra dependency outside the Node.js ecosystem
- The manual `curl` installation step in `test.yml`

The Justfile previously provided:
- `just run-local-backend` → Now handled by npm scripts
- `just reset-local-backend` → Now handled by npm scripts
- `just convex <args>` → Now handled by npm scripts with hardcoded local backend URL

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2026-02-02-polychromos-testing-1-infrastructure.md` - Testing infrastructure setup
- `thoughts/shared/research/2026-02-02-polychromos-testing-4-e2e-tests.md` - E2E test implementation
- `thoughts/shared/research/2026-02-03-lightfastai-dual-npm-cicd-pipeline.md` - Reference CI/CD pipeline

## Related Research

- `thoughts/shared/plans/2026-02-02-polychromos-testing-infrastructure.md`
- `thoughts/shared/plans/2026-02-02-polychromos-e2e-testing-cli-convex.md`

## Open Questions

1. Should Turborepo remote caching be enabled? Requires Vercel account or self-hosted cache
2. Are there plans to add more apps to the monorepo that would benefit from path filtering?
3. Should the E2E tests in test.yml be removed entirely in favor of path-filtered workflows?
