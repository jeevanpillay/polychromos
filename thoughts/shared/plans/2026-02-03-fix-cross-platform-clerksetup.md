# Fix Cross-Platform E2E Tests - Missing clerkSetup Implementation Plan

## Overview

The cross-platform E2E tests in GitHub Actions are failing because `setupClerkTestingToken()` is called in `cli-to-web.spec.ts` without first calling `clerkSetup()` in a global setup. This plan adds the missing `clerkSetup()` call, creates a PR, and iteratively verifies the fix against the `e2e-cli-fast` GitHub Action until all tests pass.

## Current State Analysis

### The Problem

From the research document (`thoughts/shared/research/2026-02-03-e2e-cross-platform-clerk-setup-failure.md`):

**Error Message:**
```
Error: The Clerk Frontend API URL is required to bypass bot protection.
Make sure the clerkSetup function is called during your global setup
before setupClerkTestingToken is called.
```

**Failing Tests:**
1. `cli-to-web.spec.ts:93` - "CLI changes sync to Convex and can be verified via API"
2. `cli-to-web.spec.ts:159` - "CLI undo changes Convex state correctly"

### Root Cause

The `cli-to-web.spec.ts` file calls `setupClerkTestingToken({ page })` in `test.beforeEach()` (line 49), but the required `clerkSetup()` function was never called in any global setup file. According to [Clerk's documentation](https://clerk.com/docs/testing/playwright), `clerkSetup()` must be called once during global setup before `setupClerkTestingToken()` can be used.

### Key Discoveries:

| File | Line | Issue |
|------|------|-------|
| `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` | 49 | Calls `setupClerkTestingToken()` without prior `clerkSetup()` |
| `apps/polychromos-app/e2e/global.setup.ts` | 10-57 | Performs manual authentication but does NOT call `clerkSetup()` |
| `apps/polychromos-app/playwright.config.ts` | 41-47 | Cross-platform project has no setup dependency |
| `apps/polychromos-app/test/e2eRunner.cjs` | 110-116 | Runs cross-platform tests without running setup project first |

### Authentication Patterns in Use

1. **Browser Tests** (`e2e/browser/`): Use custom `authenticatedPage` fixture that performs direct UI authentication. Does NOT use `setupClerkTestingToken`.

2. **Cross-Platform Tests** (`e2e/cross-platform/cli-to-web.spec.ts`): Use `setupClerkTestingToken()` which REQUIRES `clerkSetup()` to be called first.

3. **CLI E2E Tests** (`packages/polychromos/e2e/`): Rely on the setup project to create `playwright/.clerk/user.json` for token extraction.

## Desired End State

All cross-platform E2E tests pass in the `e2e-cli-fast` GitHub Action workflow:
- 2 tests in `cli-to-web.spec.ts` should pass
- No `clerkSetup` errors

### Verification

Push to a new branch, create a PR, and verify the `e2e-cli-fast` GitHub Action passes with 0 failures.

## What We're NOT Doing

- Not changing the browser test authentication pattern (they use a different approach intentionally)
- Not modifying the CLI E2E tests
- Not changing the cross-platform test logic itself (just fixing the setup)
- Not adding new test cases

## Implementation Approach

The fix requires:
1. Add `clerkSetup()` call to the global setup file
2. Ensure the cross-platform project runs the setup project first
3. Create a branch and PR for iterative testing

---

## Phase 1: Add clerkSetup to Global Setup

### Overview

Modify `global.setup.ts` to call `clerkSetup()` before any authentication happens. This provides the Testing Token that `setupClerkTestingToken()` needs.

### Changes Required:

#### 1. Update Global Setup
**File**: `apps/polychromos-app/e2e/global.setup.ts`
**Changes**: Add `clerkSetup()` call at the beginning

```typescript
import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

// Configure serial mode - required for Playwright parallel mode
setup.describe.configure({ mode: "serial" });

// Initialize Clerk testing environment FIRST
setup("clerk setup", async ({}) => {
  await clerkSetup();
});

// Then perform authentication
setup("authenticate", async ({ page }) => {
  // Create auth directory
  await mkdir(path.dirname(authFile), { recursive: true });

  // Navigate to sign-in page
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email) throw new Error("E2E_CLERK_USER_EMAIL not set");
  if (!password) throw new Error("E2E_CLERK_USER_PASSWORD not set");

  // Fill email step
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Fill password step
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for authentication
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  // CRITICAL: Wait for Clerk session to be fully established
  // The authenticated element appears when Convex confirms auth, but Clerk's
  // client needs additional time to fully initialize the session with all tokens
  await page.waitForFunction(
    () => {
      const clerk = (window as any).Clerk;
      return (
        clerk?.loaded &&
        clerk?.session?.id &&
        clerk?.user?.id &&
        clerk?.session?.lastActiveAt
      );
    },
    { timeout: 10000 }
  );

  // Give Clerk an extra moment to finalize any async session setup
  await page.waitForTimeout(2000);

  // Save storage state
  await page.context().storageState({ path: authFile });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Setup project runs without errors: `pnpm --filter @repo/app test:e2e:setup`
- [ ] TypeScript compiles: `pnpm --filter @repo/app typecheck`
- [ ] Linting passes: `pnpm --filter @repo/app lint`

#### Manual Verification:
- [ ] Verify `clerkSetup` is imported and called before authentication

**Implementation Note**: This phase adds the missing `clerkSetup()` call to initialize the Clerk testing environment.

---

## Phase 2: Configure Cross-Platform Project Dependency

### Overview

Update the Playwright configuration so the cross-platform project depends on the setup project, ensuring `clerkSetup()` runs before cross-platform tests.

### Changes Required:

#### 1. Update Playwright Config
**File**: `apps/polychromos-app/playwright.config.ts`
**Changes**: Add setup dependency to cross-platform project

```typescript
import { defineConfig, devices } from "@playwright/test";

const webAppPort = process.env.WEB_APP_PORT || "3001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${webAppPort}`;

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
      },
    },
    {
      name: "cross-platform",
      testDir: "./e2e/cross-platform",
      testMatch: /\.spec\.ts/,
      dependencies: ["setup"],  // <-- ADD THIS LINE
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  // webServer is now managed by e2eRunner.cjs
  // This allows consistent behavior between CI and local
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Playwright config is valid: `pnpm --filter @repo/app test:e2e:playwright:direct --list`
- [ ] Cross-platform project shows setup dependency

#### Manual Verification:
- [ ] Verify the `dependencies: ["setup"]` line was added

**Implementation Note**: This ensures `clerkSetup()` is called before any cross-platform tests run.

---

## Phase 3: Update E2E Runner to Run Setup Before Cross-Platform

### Overview

Update `e2eRunner.cjs` to explicitly run the setup project before cross-platform tests. This ensures the Clerk testing token is available.

### Changes Required:

#### 1. Update E2E Runner
**File**: `apps/polychromos-app/test/e2eRunner.cjs`
**Changes**: Add setup execution before cross-platform tests

The runner at line 110-116 already runs the setup for CLI tests (line 93-99). We need to ensure it also runs for cross-platform when run standalone.

However, since we added `dependencies: ["setup"]` to the Playwright config in Phase 2, Playwright will automatically run the setup project first. No changes are needed to the runner.

### Alternative: If dependencies don't work as expected

If the Playwright `dependencies` approach doesn't work (because the runner runs projects directly), we may need to modify the runner:

```javascript
// Run cross-platform tests
if (runCrossPlatform) {
  // Ensure setup runs first for clerkSetup()
  console.log('\n[E2E] Setting up authentication for cross-platform tests...');
  execSync('pnpm exec playwright test --project=setup', {
    cwd: CWD,
    stdio: 'inherit',
    env: process.env
  });

  await runCommand(
    'Cross-Platform E2E Tests',
    'pnpm',
    ['exec', 'playwright', 'test', '--project=cross-platform']
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Local test passes: `pnpm --filter @repo/app test:e2e:cross-platform`
- [ ] No `clerkSetup` errors in output

#### Manual Verification:
- [ ] Verify setup project runs before cross-platform tests in console output

**Implementation Note**: Playwright's dependency mechanism should handle this automatically, but we have a fallback if needed.

---

## Phase 4: Create Branch and Initial PR

### Overview

Create a new branch, commit the changes, and create a pull request to trigger the `e2e-cli-fast` GitHub Action.

### Steps:

1. **Create new branch**:
```bash
git checkout -b fix/cross-platform-clerk-setup
```

2. **Stage and commit changes**:
```bash
git add apps/polychromos-app/e2e/global.setup.ts
git add apps/polychromos-app/playwright.config.ts
git commit -m "fix: add clerkSetup() to global setup for cross-platform tests

The cross-platform E2E tests were failing because setupClerkTestingToken()
requires clerkSetup() to be called first during global setup to initialize
the Clerk testing environment and obtain a Testing Token.

Changes:
- Add clerkSetup() call to e2e/global.setup.ts
- Add setup dependency to cross-platform project in playwright.config.ts
- Configure serial mode for setup tests

Fixes failing tests:
- cli-to-web.spec.ts:93 - CLI changes sync to Convex
- cli-to-web.spec.ts:159 - CLI undo changes Convex state

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

3. **Push branch**:
```bash
git push -u origin fix/cross-platform-clerk-setup
```

4. **Create PR**:
```bash
gh pr create --title "fix: add clerkSetup() for cross-platform E2E tests" --body "$(cat <<'EOF'
## Summary
- Adds `clerkSetup()` call to global setup to initialize Clerk testing environment
- Adds setup dependency to cross-platform Playwright project
- Fixes failing cross-platform E2E tests in CI

## Problem
The cross-platform tests (`cli-to-web.spec.ts`) were failing with:
```
Error: The Clerk Frontend API URL is required to bypass bot protection.
Make sure the clerkSetup function is called during your global setup
before setupClerkTestingToken is called.
```

## Solution
Added `clerkSetup()` from `@clerk/testing/playwright` to the global setup file, which initializes the Clerk testing environment and provides the Testing Token that `setupClerkTestingToken()` needs.

## Test plan
- [ ] `e2e-cli-fast` GitHub Action passes
- [ ] Cross-platform tests pass (4 passed, 0 failed)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Success Criteria:

#### Automated Verification:
- [ ] Branch created and pushed
- [ ] PR created with correct description
- [ ] `e2e-cli-fast` workflow triggered

#### Manual Verification:
- [ ] PR appears in GitHub
- [ ] Workflow starts running

**Implementation Note**: After creating the PR, monitor the GitHub Action and proceed to Phase 5 for iterative fixes if needed.

---

## Phase 5: Monitor and Fix - Iteration Loop

### Overview

Monitor the `e2e-cli-fast` GitHub Action. If tests fail, diagnose the issue, apply a fix, push, and repeat until all tests pass.

### Iteration Process:

1. **Check GitHub Action status**:
```bash
gh run watch
```

2. **If failed, download logs**:
```bash
gh run download <run-id>
# or view in browser
gh run view <run-id> --web
```

3. **Diagnose issue from logs**:
   - Look for specific error messages
   - Check which test(s) failed
   - Review Playwright report artifact

4. **Apply fix locally**:
   - Modify the relevant file
   - Test locally if possible: `pnpm --filter @repo/app test:e2e:cross-platform`

5. **Commit and push**:
```bash
git add <modified-files>
git commit -m "fix: <description of fix>"
git push
```

6. **Wait for new workflow run and repeat**

### Common Issues and Fixes:

#### Issue A: `clerkSetup` not found in module
**Cause**: Import path incorrect or package version issue
**Fix**: Verify import and check `@clerk/testing` version in package.json

#### Issue B: Setup still not running before cross-platform
**Cause**: Playwright dependencies not respected when running project directly
**Fix**: Explicitly run setup project in e2eRunner.cjs before cross-platform (see Phase 3 alternative)

#### Issue C: Clerk credentials not available
**Cause**: GitHub secrets not passed correctly
**Fix**: Verify secrets are set in repository settings and workflow env

#### Issue D: Timeout waiting for authentication
**Cause**: Web app not ready or slow CI environment
**Fix**: Increase timeout or add explicit wait

### Success Criteria:

#### Automated Verification:
- [ ] `e2e-cli-fast` workflow shows green checkmark
- [ ] All CLI E2E tests pass
- [ ] All cross-platform tests pass

#### Manual Verification:
- [ ] Download Playwright report artifact and verify test results
- [ ] No skipped or flaky tests

**Implementation Note**: This phase may require multiple iterations. Each iteration should have a focused fix based on the specific error.

---

## Phase 6: Final Verification and Merge

### Overview

Once all tests pass, perform final verification and merge the PR.

### Steps:

1. **Verify all checks pass**:
```bash
gh pr checks
```

2. **Request review if needed**:
```bash
gh pr edit --add-reviewer <reviewer>
```

3. **Merge PR**:
```bash
gh pr merge --squash --delete-branch
```

### Success Criteria:

#### Automated Verification:
- [ ] All GitHub Action checks pass
- [ ] PR is merged to main

#### Manual Verification:
- [ ] Main branch CI runs successfully after merge
- [ ] No regressions in other tests

---

## Testing Strategy

### Unit Tests:
- Not applicable for E2E test infrastructure changes

### Integration Tests:
- The E2E tests themselves serve as integration tests
- Cross-platform tests verify CLI-to-web sync functionality

### Manual Testing Steps:
1. Run cross-platform tests locally 3 times to verify stability
2. Check GitHub Action logs for any warnings
3. Review Playwright report for timing information

## Performance Considerations

- **Serial setup**: The setup tests run serially as required by Clerk, which may add a few seconds to test startup
- **Dependency chain**: Adding setup dependency means an extra project runs before cross-platform, but this is necessary and minimal overhead

## Migration Notes

No migration needed - this is purely a test infrastructure fix.

## References

- Research document: `thoughts/shared/research/2026-02-03-e2e-cross-platform-clerk-setup-failure.md`
- Clerk testing docs: https://clerk.com/docs/testing/playwright
- Clerk test helpers: https://clerk.com/docs/guides/development/testing/playwright/test-helpers
- GitHub Actions workflow: `.github/workflows/e2e-cli-fast.yml`
- Playwright config: `apps/polychromos-app/playwright.config.ts`
- Global setup: `apps/polychromos-app/e2e/global.setup.ts`
- Failing test file: `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts`
