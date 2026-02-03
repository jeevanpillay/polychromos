---
date: 2026-02-03T08:15:00-08:00
researcher: Claude
git_commit: 7f7440a61ca999a25c8a02d005aea79ff5ac743e
branch: main
repository: jeevanpillay/polychromos
topic: "E2E Cross-Platform Tests Failing - Missing clerkSetup"
tags: [research, e2e-testing, playwright, clerk, cross-platform]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: E2E Cross-Platform Tests Failing - Missing clerkSetup

**Date**: 2026-02-03T08:15:00-08:00
**Researcher**: Claude
**Git Commit**: 7f7440a61ca999a25c8a02d005aea79ff5ac743e
**Branch**: main
**Repository**: jeevanpillay/polychromos
**GitHub Actions Run**: https://github.com/jeevanpillay/polychromos/actions/runs/21621826329/job/62312616119

## Research Question

Investigate the E2E CLI test failures in GitHub Actions run 21621826329.

## Summary

The GitHub Actions job "E2E CLI Tests" failed during the **cross-platform tests** phase. The CLI E2E tests (17 tests in 3 files) passed successfully, but the cross-platform Playwright tests failed with 2 tests failing due to a missing `clerkSetup()` call.

### Failure Details

**Error Message:**
```
Error: The Clerk Frontend API URL is required to bypass bot protection.
Make sure the clerkSetup function is called during your global setup
before setupClerkTestingToken is called.
```

**Failing Tests:**
1. `cli-to-web.spec.ts:93` - "CLI changes sync to Convex and can be verified via API"
2. `cli-to-web.spec.ts:159` - "CLI undo changes Convex state correctly"

**Test Results Summary:**
- CLI E2E Tests: 17 passed (auth.spec.ts, dev.spec.ts, version.spec.ts)
- Cross-Platform Tests: 4 passed, 2 failed

## Detailed Findings

### Cross-Platform Test File Structure

The failing tests are located in:
- `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts`

This test file imports `setupClerkTestingToken` from `@clerk/testing/playwright` and calls it in `test.beforeEach()`:

```typescript
// cli-to-web.spec.ts:2
import { setupClerkTestingToken } from '@clerk/testing/playwright';

// cli-to-web.spec.ts:48-49
test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  // ...
});
```

### Playwright Configuration

The `playwright.config.ts` defines the cross-platform project:

```typescript
// playwright.config.ts:41-47
{
  name: "cross-platform",
  testDir: "./e2e/cross-platform",
  testMatch: /\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
  },
}
```

The cross-platform project does **not** specify a dependency on the `setup` project, unlike how browser tests would work.

### Browser Tests Authentication Pattern

The browser tests use a custom fixture (`e2e/fixtures/auth.ts`) that performs direct authentication without using `setupClerkTestingToken`:

```typescript
// e2e/fixtures/auth.ts:18-53
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Direct sign-in flow via UI
    await page.goto("/sign-in");
    await page.fill('input[type="email"]', email);
    // ...
  },
});
```

### Global Setup File

The `e2e/global.setup.ts` performs authentication and saves storage state to `playwright/.clerk/user.json`, but does **not** call `clerkSetup()`:

```typescript
// e2e/global.setup.ts:10-57
setup("authenticate", async ({ page }) => {
  // Navigate to sign-in page
  await page.goto("/sign-in");
  // ... performs authentication ...
  await page.context().storageState({ path: authFile });
});
```

### E2E Runner Configuration

The `test/e2eRunner.cjs` runs cross-platform tests after CLI tests:

```javascript
// test/e2eRunner.cjs:110-116
if (runCrossPlatform) {
  await runCommand(
    'Cross-Platform E2E Tests',
    'pnpm',
    ['exec', 'playwright', 'test', '--project=cross-platform']
  );
}
```

The cross-platform tests are run directly without first running the setup project.

### The Missing Piece: clerkSetup()

According to the Clerk testing documentation and the error message, `clerkSetup()` must be called in a global setup file before `setupClerkTestingToken()` can be used. This function:
- Initializes the Clerk testing environment
- Sets up the Clerk Frontend API URL for bot protection bypass
- Should be called once per test suite run

## Code References

| File | Line | Description |
|------|------|-------------|
| `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` | 2 | Imports `setupClerkTestingToken` |
| `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts` | 49 | Calls `setupClerkTestingToken({ page })` in beforeEach |
| `apps/polychromos-app/playwright.config.ts` | 41-47 | Cross-platform project configuration |
| `apps/polychromos-app/e2e/global.setup.ts` | 10-57 | Global setup (missing `clerkSetup()` call) |
| `apps/polychromos-app/test/e2eRunner.cjs` | 110-116 | Cross-platform test invocation |
| `apps/polychromos-app/e2e/fixtures/auth.ts` | 18-53 | Browser test auth fixture (doesn't use Clerk testing helpers) |

## Architecture Documentation

### Current E2E Test Structure

```
apps/polychromos-app/
├── e2e/
│   ├── browser/              # Browser tests (use custom auth fixture)
│   │   ├── auth-ui.spec.ts
│   │   ├── workspace-flow.spec.ts
│   │   └── ...
│   ├── cross-platform/       # Cross-platform tests (use Clerk testing helpers)
│   │   └── cli-to-web.spec.ts
│   ├── fixtures/
│   │   └── auth.ts           # Custom auth fixture for browser tests
│   └── global.setup.ts       # Global setup (authentication only)
├── playwright.config.ts      # Playwright configuration
└── test/
    └── e2eRunner.cjs         # E2E orchestration script
```

### Authentication Approaches in Use

1. **Browser Tests**: Use custom `authenticatedPage` fixture that performs direct UI authentication each time. Does not rely on `setupClerkTestingToken`.

2. **Cross-Platform Tests**: Use `setupClerkTestingToken()` which requires `clerkSetup()` to be called first in global setup.

3. **CLI Tests**: Use Playwright authentication setup (via setup project) to generate storage state, then extract Convex token from the authenticated browser session.

## Test Output from CI

**CLI Tests (Passed):**
- auth.spec.ts: 3 tests passed
- dev.spec.ts: 5 tests passed
- version.spec.ts: 9 tests passed
- Total: 17 passed in 22.51s

**Cross-Platform Tests (Partial Failure):**
- 4 passed
- 2 failed (both in cli-to-web.spec.ts due to `clerkSetup` error)
- Tests retry 3 times before failing

## Related Research

- `thoughts/shared/plans/2026-02-03-e2e-browser-tests-fix.md` - Contains code samples showing `clerkSetup()` usage
- `thoughts/shared/research/2026-02-03-clerk-custom-auth-ssr-requirements.md` - Documents Clerk testing patterns
- `thoughts/shared/plans/2026-02-03-complete-testing-infrastructure-rework.md` - Shows intended `clerkSetup()` integration

## Open Questions

1. Should the cross-platform project in `playwright.config.ts` depend on a setup project that calls `clerkSetup()`?
2. Should `clerkSetup()` be added to the existing `global.setup.ts` or a separate setup file?
3. Is the browser test approach (custom fixture without Clerk testing helpers) intentional to avoid this dependency?
