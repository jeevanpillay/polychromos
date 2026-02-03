# CI Testing Pipeline Optimization Implementation Plan

## Overview

Implement comprehensive CI/CD optimizations to reduce test execution time, eliminate redundant runs, and improve developer experience. This plan addresses all 8 recommendations from the CI testing pipeline evaluation research.

**Related Research**: `thoughts/shared/research/2026-02-03-ci-testing-pipeline-evaluation.md`

## Current State Analysis

### Existing Workflows
- `.github/workflows/test.yml` - Unit tests + E2E tests (runs on ALL PRs, no path filtering)
- `.github/workflows/e2e.yml` - Playwright E2E tests (path-filtered)
- `.github/workflows/e2e-cli.yml` - CLI E2E + cross-platform tests (path-filtered)

### Key Issues
1. **Duplicate E2E execution**: `test.yml` runs E2E on every PR regardless of changes
2. **Version inconsistencies**: Node 22 vs Node 20, pnpm/action-setup v4 vs v2
3. **No browser caching**: Playwright browsers reinstalled on every run (~30-60s)
4. **No composite actions**: Setup steps duplicated across workflows
5. **No concurrency control**: Redundant runs on rapid pushes
6. **Single Playwright worker**: Underutilizes 2 vCPU runners
7. **Sequential service startup**: Polling loops instead of health check actions
8. **No remote caching**: Turborepo caching disabled

## Desired End State

A unified CI workflow (`ci.yml`) that:
- Uses path detection to run only relevant jobs
- Shares setup logic via composite actions
- Caches Playwright browsers
- Uses consistent Node 22 and pnpm v4 across all jobs
- Cancels redundant runs on rapid pushes
- Runs lint/typecheck/unit-tests in parallel via matrix strategy
- Runs E2E tests conditionally based on changed paths
- Utilizes 2 Playwright workers for parallel test execution

### Verification
- CI runs ~30-50% faster on changed paths
- CI skips E2E entirely when only docs/config changed
- No duplicate artifact names
- All tests pass with new configuration

## What We're NOT Doing

- Enabling Turborepo remote caching (requires Vercel account setup - separate task)
- Changing test configurations (vitest.config.ts, playwright.config.ts structure)
- Adding new test suites
- Modifying the actual test files

## Implementation Approach

We'll implement in 5 phases, each independently deployable and testable:

1. **Phase 1**: Standardize versions and add concurrency control (quick wins)
2. **Phase 2**: Create composite actions for reusable setup
3. **Phase 3**: Add Playwright browser caching
4. **Phase 4**: Consolidate into unified workflow with path detection
5. **Phase 5**: Optimize Playwright workers and service startup

---

## Phase 1: Standardize Versions and Add Concurrency Control

### Overview
Quick wins that immediately improve consistency and prevent redundant CI runs.

### Changes Required:

#### 1. Update e2e.yml versions and add concurrency
**File**: `.github/workflows/e2e.yml`

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

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_USERNAME: ${{ secrets.E2E_CLERK_USER_USERNAME }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: ${{ vars.VITE_CONVEX_URL }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build app
        run: pnpm --filter @repo/polychromos-app build

      - name: Run E2E tests
        run: pnpm --filter @repo/polychromos-app test:e2e:playwright

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-e2e
          path: apps/polychromos-app/playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-e2e
          path: apps/polychromos-app/test-results/
          retention-days: 7
```

#### 2. Update e2e-cli.yml versions and add concurrency
**File**: `.github/workflows/e2e-cli.yml`

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

concurrency:
  group: e2e-cli-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  cli-e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: http://127.0.0.1:3210

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      # ... rest of steps unchanged
```

#### 3. Add concurrency to test.yml
**File**: `.github/workflows/test.yml`

Add after `on:` block:
```yaml
concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

### Success Criteria:

#### Automated Verification:
- [x] All workflows use Node.js 22: `grep -r "node-version" .github/workflows/ | grep -v "22"` returns empty
- [x] All workflows use pnpm/action-setup@v4: `grep -r "pnpm/action-setup" .github/workflows/ | grep -v "@v4"` returns empty
- [x] All workflows have concurrency blocks: `grep -l "concurrency:" .github/workflows/*.yml | wc -l` equals 3
- [x] Artifact names are unique: `grep -h "name:" .github/workflows/*.yml | grep -E "playwright-report|test-results" | sort | uniq -d` returns empty
- [ ] CI passes on a test PR

#### Manual Verification:
- [ ] Push two commits rapidly to a PR branch - verify first run is cancelled
- [ ] Verify artifact names in GitHub Actions UI are distinct

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create Composite Actions for Reusable Setup

### Overview
Extract common setup patterns into reusable composite actions to reduce duplication and ensure consistency.

### Changes Required:

#### 1. Create setup composite action
**File**: `.github/actions/setup/action.yml`

```yaml
name: 'Setup'
description: 'Setup pnpm and Node.js with caching'

inputs:
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '22'

runs:
  using: 'composite'
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'pnpm'

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile

    - name: Build packages
      shell: bash
      run: pnpm build
```

#### 2. Create playwright-setup composite action
**File**: `.github/actions/playwright-setup/action.yml`

```yaml
name: 'Playwright Setup'
description: 'Setup Playwright with browser caching'

inputs:
  browsers:
    description: 'Browsers to install (e.g., chromium, firefox, webkit)'
    required: false
    default: 'chromium'

runs:
  using: 'composite'
  steps:
    - name: Get Playwright version
      id: playwright-version
      shell: bash
      run: |
        PLAYWRIGHT_VERSION=$(pnpm list @playwright/test --json 2>/dev/null | jq -r '.[0].dependencies["@playwright/test"].version // empty' || echo "")
        if [ -z "$PLAYWRIGHT_VERSION" ]; then
          PLAYWRIGHT_VERSION=$(pnpm list @playwright/test --depth=0 2>/dev/null | grep @playwright/test | awk '{print $2}' || echo "unknown")
        fi
        echo "version=$PLAYWRIGHT_VERSION" >> $GITHUB_OUTPUT

    - name: Cache Playwright browsers
      uses: actions/cache@v4
      id: playwright-cache
      with:
        path: ~/.cache/ms-playwright
        key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}-${{ inputs.browsers }}

    - name: Install Playwright browsers
      if: steps.playwright-cache.outputs.cache-hit != 'true'
      shell: bash
      run: pnpm exec playwright install --with-deps ${{ inputs.browsers }}

    - name: Install Playwright system dependencies (cache hit)
      if: steps.playwright-cache.outputs.cache-hit == 'true'
      shell: bash
      run: pnpm exec playwright install-deps ${{ inputs.browsers }}
```

#### 3. Update test.yml to use composite actions
**File**: `.github/workflows/test.yml`

```yaml
name: Test

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

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

      - name: Setup
        uses: ./.github/actions/setup

      - name: Run E2E Tests
        run: pnpm --filter @repo/polychromos-app test:e2e
        timeout-minutes: 10
```

### Success Criteria:

#### Automated Verification:
- [x] Composite actions exist: `ls .github/actions/setup/action.yml .github/actions/playwright-setup/action.yml`
- [x] test.yml uses composite action: `grep "uses: ./.github/actions/setup" .github/workflows/test.yml`
- [ ] CI passes on a test PR
- [ ] Lint passes: `pnpm lint` (pre-existing lint errors unrelated to workflow changes)

#### Manual Verification:
- [ ] Review GitHub Actions logs to confirm composite actions are invoked
- [ ] Verify setup steps appear as a single collapsed group in CI logs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Add Playwright Browser Caching

### Overview
Integrate Playwright browser caching into E2E workflows to save 30-60 seconds per run.

### Changes Required:

#### 1. Update e2e.yml to use composite actions
**File**: `.github/workflows/e2e.yml`

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

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_USERNAME: ${{ secrets.E2E_CLERK_USER_USERNAME }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: ${{ vars.VITE_CONVEX_URL }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

      - name: Setup Playwright
        uses: ./.github/actions/playwright-setup

      - name: Run E2E tests
        run: pnpm --filter @repo/polychromos-app test:e2e:playwright

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-e2e
          path: apps/polychromos-app/playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-e2e
          path: apps/polychromos-app/test-results/
          retention-days: 7
```

#### 2. Update e2e-cli.yml to use composite actions
**File**: `.github/workflows/e2e-cli.yml`

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

concurrency:
  group: e2e-cli-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  cli-e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20

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

      - name: Start local Convex backend
        run: |
          cd apps/polychromos-app
          npx convex dev &
          for i in {1..30}; do
            if curl -s http://127.0.0.1:3210/version > /dev/null 2>&1; then
              echo "Convex backend ready"
              break
            fi
            echo "Waiting for Convex backend... ($i/30)"
            sleep 2
          done

      - name: Start web app
        run: |
          cd apps/polychromos-app
          pnpm dev:web &
          for i in {1..30}; do
            if curl -s http://localhost:3001 > /dev/null 2>&1; then
              echo "Web app ready"
              break
            fi
            echo "Waiting for web app... ($i/30)"
            sleep 2
          done

      - name: Run Playwright setup (authenticate)
        run: |
          cd apps/polychromos-app
          pnpm exec playwright test --project=setup

      - name: Run CLI E2E tests
        run: pnpm --filter polychromos test:e2e

      - name: Run cross-platform tests
        run: |
          cd apps/polychromos-app
          pnpm exec playwright test --project=cross-platform

      - name: Upload CLI E2E test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cli-e2e-results
          path: packages/polychromos/test-results/
          retention-days: 7

      - name: Upload cross-platform test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cross-platform-results
          path: apps/polychromos-app/test-results/
          retention-days: 7

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-cli
          path: apps/polychromos-app/playwright-report/
          retention-days: 7
```

### Success Criteria:

#### Automated Verification:
- [x] e2e.yml uses playwright-setup action: `grep "uses: ./.github/actions/playwright-setup" .github/workflows/e2e.yml`
- [x] e2e-cli.yml uses playwright-setup action: `grep "uses: ./.github/actions/playwright-setup" .github/workflows/e2e-cli.yml`
- [ ] CI passes on a test PR
- [x] No duplicate artifact names in workflows

#### Manual Verification:
- [ ] Run CI twice on same branch - second run should show "Cache hit" for Playwright browsers
- [ ] Verify browser installation is skipped when cache hits
- [ ] Compare CI times before/after - expect 30-60s improvement on cache hit

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Consolidate into Unified Workflow with Path Detection

### Overview
Create a single unified CI workflow that uses path detection to run only relevant jobs, eliminating the duplicate E2E execution in test.yml.

### Changes Required:

#### 1. Create unified CI workflow
**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  # Detect which paths changed
  changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.filter.outputs.packages }}
      polychromos-app: ${{ steps.filter.outputs.polychromos-app }}
      polychromos-cli: ${{ steps.filter.outputs.polychromos-cli }}
      convex: ${{ steps.filter.outputs.convex }}
    steps:
      - uses: actions/checkout@v4

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
            convex:
              - 'apps/polychromos-app/convex/**'

  # Lint, typecheck, and unit tests run in parallel
  quality:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        task:
          - { name: 'Lint', cmd: 'pnpm lint' }
          - { name: 'Typecheck', cmd: 'pnpm typecheck' }
          - { name: 'Unit Tests', cmd: 'pnpm test:ci' }
    name: ${{ matrix.task.name }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

      - name: ${{ matrix.task.name }}
        run: ${{ matrix.task.cmd }}

      - name: Upload coverage
        if: matrix.task.name == 'Unit Tests'
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  # E2E Browser tests - only when polychromos-app changes
  e2e-browser:
    needs: [changes, quality]
    if: needs.changes.outputs.polychromos-app == 'true' || needs.changes.outputs.polychromos-cli == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 15

    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_USERNAME: ${{ secrets.E2E_CLERK_USER_USERNAME }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
      VITE_CONVEX_URL: ${{ vars.VITE_CONVEX_URL }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: ./.github/actions/setup

      - name: Setup Playwright
        uses: ./.github/actions/playwright-setup

      - name: Run E2E tests
        run: pnpm --filter @repo/polychromos-app test:e2e:playwright

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-browser
          path: apps/polychromos-app/playwright-report/
          retention-days: 7

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results-browser
          path: apps/polychromos-app/test-results/
          retention-days: 7

  # CLI E2E tests - only when polychromos CLI or convex changes
  e2e-cli:
    needs: [changes, quality]
    if: needs.changes.outputs.polychromos-cli == 'true' || needs.changes.outputs.convex == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 20

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

      - name: Start local Convex backend
        run: |
          cd apps/polychromos-app
          npx convex dev &
          for i in {1..30}; do
            if curl -s http://127.0.0.1:3210/version > /dev/null 2>&1; then
              echo "Convex backend ready"
              break
            fi
            echo "Waiting for Convex backend... ($i/30)"
            sleep 2
          done

      - name: Start web app
        run: |
          cd apps/polychromos-app
          pnpm dev:web &
          for i in {1..30}; do
            if curl -s http://localhost:3001 > /dev/null 2>&1; then
              echo "Web app ready"
              break
            fi
            echo "Waiting for web app... ($i/30)"
            sleep 2
          done

      - name: Run Playwright setup (authenticate)
        run: |
          cd apps/polychromos-app
          pnpm exec playwright test --project=setup

      - name: Run CLI E2E tests
        run: pnpm --filter polychromos test:e2e

      - name: Run cross-platform tests
        run: |
          cd apps/polychromos-app
          pnpm exec playwright test --project=cross-platform

      - name: Upload CLI E2E test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cli-e2e-results
          path: packages/polychromos/test-results/
          retention-days: 7

      - name: Upload cross-platform test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cross-platform-results
          path: apps/polychromos-app/test-results/
          retention-days: 7

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-cli
          path: apps/polychromos-app/playwright-report/
          retention-days: 7
```

#### 2. Remove old workflow files
**Files to delete**:
- `.github/workflows/test.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/e2e-cli.yml`

### Success Criteria:

#### Automated Verification:
- [x] ci.yml exists: `ls .github/workflows/ci.yml`
- [x] Old workflows removed: `ls .github/workflows/test.yml .github/workflows/e2e.yml .github/workflows/e2e-cli.yml 2>&1 | grep "No such file"`
- [ ] CI passes on a test PR that touches polychromos-app
- [ ] CI passes on a test PR that only touches docs (E2E jobs should be skipped)

#### Manual Verification:
- [ ] Create a PR that only changes README.md - verify E2E jobs are skipped
- [ ] Create a PR that changes packages/polychromos - verify both e2e-browser and e2e-cli run
- [ ] Create a PR that only changes apps/polychromos-app/src - verify only e2e-browser runs
- [ ] Verify GitHub branch protection rules still work with new workflow name

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 5.

---

## Phase 5: Optimize Playwright Workers and Service Startup

### Overview
Increase Playwright parallelization and improve service startup times.

### Changes Required:

#### 1. Increase Playwright workers
**File**: `apps/polychromos-app/playwright.config.ts`

Change line with `workers`:
```typescript
workers: process.env.CI ? 2 : undefined,  // Changed from 1 to 2
```

#### 2. Add wait-on for faster service startup (optional enhancement)
**File**: `.github/workflows/ci.yml`

Update the e2e-cli job's service startup steps:

```yaml
      - name: Start local Convex backend
        run: |
          cd apps/polychromos-app
          npx convex dev &
          echo "CONVEX_PID=$!" >> $GITHUB_ENV

      - name: Wait for Convex backend
        uses: iFaxity/wait-on-action@v1.2.1
        with:
          resource: http://127.0.0.1:3210/version
          timeout: 60000

      - name: Start web app
        run: |
          cd apps/polychromos-app
          pnpm dev:web &
          echo "WEB_PID=$!" >> $GITHUB_ENV

      - name: Wait for web app
        uses: iFaxity/wait-on-action@v1.2.1
        with:
          resource: http://localhost:3001
          timeout: 60000
```

### Success Criteria:

#### Automated Verification:
- [x] Playwright config uses 2 workers: `grep "workers.*2" apps/polychromos-app/playwright.config.ts`
- [ ] CI passes with new configuration
- [ ] All E2E tests pass

#### Manual Verification:
- [ ] Compare E2E test times before/after - expect 20-40% improvement
- [ ] Verify tests still pass reliably (no flakiness from parallelization)
- [ ] Check GitHub Actions logs to confirm parallel test execution

**Implementation Note**: After completing this phase and all automated verification passes, the implementation is complete.

---

## Testing Strategy

### Unit Tests
- Existing unit tests cover test configurations
- No new unit tests needed for CI changes

### Integration Tests
- Create a test PR for each phase to verify CI works
- Use a dedicated test branch for experimentation

### Manual Testing Steps
1. **Phase 1**: Push rapid commits, verify cancellation
2. **Phase 2**: Review CI logs for composite action invocation
3. **Phase 3**: Run CI twice, verify cache hit
4. **Phase 4**: Create PRs with different path changes, verify conditional job execution
5. **Phase 5**: Compare test execution times

## Rollback Plan

Each phase can be rolled back independently:
- **Phase 1**: Revert version and concurrency changes
- **Phase 2**: Remove composite actions, restore inline setup steps
- **Phase 3**: Remove cache steps from playwright-setup action
- **Phase 4**: Restore original workflow files from git history
- **Phase 5**: Revert Playwright workers to 1

## Performance Considerations

| Optimization | Expected Impact |
|-------------|-----------------|
| Playwright browser caching | 30-60s saved per run |
| Path filtering (skip E2E) | 2-5 min saved when E2E skipped |
| Parallel matrix jobs | 30-60s saved |
| Increased workers | 20-40% faster E2E |
| Concurrency control | Prevents wasted runs |

**Total expected improvement**: 30-50% faster CI on changed paths, complete skip on unchanged paths.

## References

- Research document: `thoughts/shared/research/2026-02-03-ci-testing-pipeline-evaluation.md`
- Current workflows:
  - `.github/workflows/test.yml:1-66`
  - `.github/workflows/e2e.yml:1-63`
  - `.github/workflows/e2e-cli.yml:1-112`
- Test configurations:
  - `turbo.json:39-60`
  - `apps/polychromos-app/playwright.config.ts:1-68`
