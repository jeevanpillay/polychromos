# E2E Browser Tests Fix - Implementation Plan

## Overview

The E2E browser tests in CI are failing with "element(s) not found" errors for the `[data-testid='authenticated']` selector. This plan systematically diagnoses and fixes the issue through iterative testing until all tests pass.

## Current State Analysis

### Failing Tests
1. **"can create a new workspace"** - Fails at `[data-testid='authenticated']` visibility check
2. **"workspace persists after page reload"** - Same failure point
3. **"workspace preview shows after creation"** - Same failure point

### Root Cause Hypothesis

Based on the research, the most likely causes are:

1. **Authentication State Not Persisting** - The `setupClerkTestingToken({ page })` in `beforeEach` may not be sufficient to establish authenticated state in CI
2. **Storage State File Missing/Invalid** - The `playwright/.clerk/user.json` may not be created or loaded correctly
3. **Clerk Authentication Not Completing** - The global setup may be failing silently or timing out
4. **Convex Auth Configuration Issue** - `CLERK_JWT_ISSUER_DOMAIN` may not be set correctly in the local Convex backend

### Test Flow
1. `e2eRunner.cjs` starts local Convex backend → deploys schema with env vars → starts web app
2. `global.setup.ts` runs Clerk sign-in and saves storage state to `playwright/.clerk/user.json`
3. `workspace-flow.spec.ts` loads storage state and calls `setupClerkTestingToken({ page })`
4. Tests wait for `[data-testid='authenticated']` which only renders after full auth flow completes

## Desired End State

All three failing tests pass consistently:
- `can create a new workspace` - Creates workspace, URL updates with `?workspace=` param
- `workspace persists after page reload` - Workspace ID preserved after reload
- `workspace preview shows after creation` - Workspace name heading visible after creation

### Verification
```bash
pnpm --filter @repo/app test:e2e:browser
```
All tests should pass with 0 failures.

## What We're NOT Doing

- Not changing the core authentication architecture
- Not modifying production code (only test infrastructure)
- Not adding new E2E test cases
- Not changing the Clerk/Convex integration patterns

## Implementation Approach

We'll use an iterative debugging approach:
1. Add diagnostic logging to understand current state
2. Run tests locally with `--debug` flag
3. Identify specific failure point
4. Apply targeted fix
5. Verify fix locally
6. Run in CI environment simulation
7. Repeat until all tests pass

---

## Phase 1: Add Debug Logging to Global Setup

### Overview
Add detailed logging to `global.setup.ts` to understand exactly where authentication fails.

### Changes Required:

#### 1. Enhanced Global Setup Logging
**File**: `apps/polychromos-app/e2e/global.setup.ts`
**Changes**: Add step-by-step logging and screenshots on failure

```typescript
import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("global setup", async () => {
  console.log("[Setup] Initializing Clerk testing environment...");
  await clerkSetup();
  console.log("[Setup] Clerk testing environment initialized");
});

setup("authenticate", async ({ page }) => {
  console.log("[Auth] Starting authentication flow...");
  console.log("[Auth] Auth file path:", authFile);

  // Navigate to the app
  console.log("[Auth] Navigating to /...");
  await page.goto("/");

  // Wait for Clerk to load
  console.log("[Auth] Waiting for network idle...");
  await page.waitForLoadState("networkidle");

  // Take screenshot of initial state
  await page.screenshot({ path: "test-results/auth-step-1-initial.png" });
  console.log("[Auth] Screenshot: auth-step-1-initial.png");

  // Click the Sign In button to open modal
  console.log("[Auth] Looking for Sign In button...");
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeVisible({ timeout: 10000 });
  console.log("[Auth] Sign In button found, clicking...");
  await signInButton.click();

  // Wait for Clerk modal
  console.log("[Auth] Waiting for Clerk modal (.cl-modalContent)...");
  await page.waitForSelector(".cl-modalContent", { timeout: 10000 });
  await page.screenshot({ path: "test-results/auth-step-2-modal.png" });
  console.log("[Auth] Screenshot: auth-step-2-modal.png");

  const email = process.env.E2E_CLERK_USER_EMAIL;
  if (!email) throw new Error("E2E_CLERK_USER_EMAIL not set");
  console.log("[Auth] Email env var set:", email.substring(0, 3) + "***");

  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (!password) throw new Error("E2E_CLERK_USER_PASSWORD not set");
  console.log("[Auth] Password env var set: ***");

  // Clerk two-step email/password flow
  // Step 1: Enter email and click Continue
  console.log("[Auth] Step 1: Entering email...");
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.screenshot({ path: "test-results/auth-step-3-email-entered.png" });
  console.log("[Auth] Screenshot: auth-step-3-email-entered.png");

  // Step 2: Enter password and click Continue
  console.log("[Auth] Step 2: Waiting for password input...");
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  const passwordInput = page.getByRole("textbox", { name: /password/i });
  await passwordInput.fill(password);
  console.log("[Auth] Clicking Continue to submit credentials...");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.screenshot({ path: "test-results/auth-step-4-password-entered.png" });
  console.log("[Auth] Screenshot: auth-step-4-password-entered.png");

  // Wait for authentication to complete (redirect back to app)
  console.log("[Auth] Waiting for authenticated content (30s timeout)...");
  try {
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 30000,
    });
    console.log("[Auth] Authenticated content visible!");
  } catch (error) {
    console.error("[Auth] Failed to find authenticated content!");
    await page.screenshot({ path: "test-results/auth-step-5-failed.png" });
    console.log("[Auth] Screenshot: auth-step-5-failed.png");
    console.log("[Auth] Current URL:", page.url());
    console.log("[Auth] Page content:", await page.content());
    throw error;
  }

  await page.screenshot({ path: "test-results/auth-step-5-success.png" });
  console.log("[Auth] Screenshot: auth-step-5-success.png");

  // Save authentication state
  console.log("[Auth] Saving storage state to:", authFile);
  await page.context().storageState({ path: authFile });
  console.log("[Auth] Authentication complete!");
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests run without syntax errors: `pnpm --filter @repo/app test:e2e:browser --project=setup`
- [ ] Screenshots are generated in `test-results/` directory
- [ ] Console output shows each step of authentication

#### Manual Verification:
- [ ] Review screenshots to identify failure point
- [ ] Check console output for error messages

**Implementation Note**: After completing this phase and all automated verification passes, analyze the screenshots and logs to identify where authentication is failing before proceeding.

---

## Phase 2: Add Debug Logging to Test File

### Overview
Add logging to `workspace-flow.spec.ts` to understand test-level failures.

### Changes Required:

#### 1. Enhanced Test Logging
**File**: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts`
**Changes**: Add logging and better error handling

```typescript
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Authenticated Workspace Flow", () => {
  test.beforeEach(async ({ page }) => {
    console.log("[Test] Setting up Clerk testing token...");
    await setupClerkTestingToken({ page });
    console.log("[Test] Clerk testing token set");
  });

  test("can create a new workspace", async ({ page }) => {
    console.log("[Test] Starting: can create a new workspace");

    console.log("[Test] Navigating to /...");
    await page.goto("/");

    console.log("[Test] Current URL:", page.url());
    await page.screenshot({ path: "test-results/test-1-initial.png" });

    // Log page state
    const authElement = page.locator("[data-testid='authenticated']");
    const unauthElement = page.locator("button", { hasText: /sign in/i });
    const loadingElement = page.locator("text=Loading...");

    console.log("[Test] Checking page state...");
    console.log("[Test] - Auth element exists:", await authElement.count());
    console.log("[Test] - Unauth element exists:", await unauthElement.count());
    console.log("[Test] - Loading element exists:", await loadingElement.count());

    // Should see authenticated content
    console.log("[Test] Waiting for authenticated content...");
    try {
      await expect(authElement).toBeVisible({ timeout: 15000 });
      console.log("[Test] Authenticated content visible");
    } catch (error) {
      console.error("[Test] Failed to find authenticated content");
      await page.screenshot({ path: "test-results/test-1-auth-failed.png" });
      console.log("[Test] Current HTML:", await page.locator("body").innerHTML());
      throw error;
    }

    await page.screenshot({ path: "test-results/test-1-authenticated.png" });

    // Click create workspace button
    console.log("[Test] Looking for Create New Design button...");
    const createButton = page.getByRole("button", { name: /create new design/i });
    await expect(createButton).toBeVisible();
    console.log("[Test] Clicking Create New Design button...");
    await createButton.click();

    // Wait for workspace to be created and URL to update
    console.log("[Test] Waiting for URL to contain workspace=...");
    await page.waitForURL(/workspace=/);
    console.log("[Test] URL updated:", page.url());

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    console.log("[Test] Workspace ID:", workspaceId);
    expect(workspaceId).toBeTruthy();

    await page.screenshot({ path: "test-results/test-1-complete.png" });
    console.log("[Test] Test complete: can create a new workspace");
  });

  test("workspace persists after page reload", async ({ page }) => {
    console.log("[Test] Starting: workspace persists after page reload");

    await page.goto("/");
    console.log("[Test] Navigated to /, URL:", page.url());

    // Wait for authenticated content
    console.log("[Test] Waiting for authenticated content...");
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 10000,
    });

    // Create workspace
    console.log("[Test] Creating workspace...");
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    console.log("[Test] Workspace created:", workspaceId);

    // Reload page
    console.log("[Test] Reloading page...");
    await page.reload();
    console.log("[Test] Page reloaded, URL:", page.url());

    // Should still have same workspace in URL
    const newUrl = new URL(page.url());
    const persistedId = newUrl.searchParams.get("workspace");
    console.log("[Test] Workspace after reload:", persistedId);
    expect(persistedId).toBe(workspaceId);

    console.log("[Test] Test complete: workspace persists after page reload");
  });

  test("workspace preview shows after creation", async ({ page }) => {
    console.log("[Test] Starting: workspace preview shows after creation");

    await page.goto("/");

    // Wait for authenticated content
    console.log("[Test] Waiting for authenticated content...");
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 10000,
    });

    // Create workspace
    console.log("[Test] Creating workspace...");
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);
    console.log("[Test] Workspace created, URL:", page.url());

    // Should see the workspace name heading (not the button)
    console.log("[Test] Waiting for workspace heading...");
    await expect(
      page.getByRole("heading", { name: /new design|untitled design/i }),
    ).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({ path: "test-results/test-3-workspace-preview.png" });
    console.log("[Test] Test complete: workspace preview shows after creation");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests run and produce detailed logs: `pnpm --filter @repo/app test:e2e:browser`
- [ ] Screenshots captured at failure points

#### Manual Verification:
- [ ] Review logs to determine if authentication token is being set correctly
- [ ] Compare auth state between setup and test execution

**Implementation Note**: After Phase 1 and Phase 2 are complete, run the tests locally and analyze the output to identify the specific failure point.

---

## Phase 3: Run Local Diagnosis

### Overview
Execute the tests locally with debug output to understand the current behavior.

### Steps:

1. **Ensure environment is set up**:
```bash
cd apps/polychromos-app
# Verify environment variables are present
cat .vercel/.env.development.local | grep E2E_CLERK
```

2. **Run tests with DEBUG flag**:
```bash
DEBUG=1 pnpm --filter @repo/app test:e2e:browser 2>&1 | tee e2e-debug.log
```

3. **Check generated artifacts**:
```bash
ls -la apps/polychromos-app/test-results/
ls -la apps/polychromos-app/playwright-report/
ls -la apps/polychromos-app/playwright/.clerk/
```

4. **Analyze failure**:
- If `auth-step-X-failed.png` exists, the failure is in global setup
- If `test-1-auth-failed.png` exists, the failure is in test execution
- Check if `user.json` was created and contains valid data

### Success Criteria:

#### Automated Verification:
- [ ] `e2e-debug.log` captured
- [ ] Screenshots generated showing exact failure state

#### Manual Verification:
- [ ] Identify which specific step fails
- [ ] Document error message and stack trace

**Implementation Note**: This phase is diagnostic only. Based on findings, proceed to the appropriate fix phase.

---

## Phase 4: Fix Authentication Token Setup (If Needed)

### Overview
Based on Phase 3 diagnosis, apply the appropriate fix. This phase covers the most common issue: storage state not being loaded correctly.

### Potential Fixes:

#### Fix A: Ensure Storage State Directory Exists
**File**: `apps/polychromos-app/e2e/global.setup.ts`
**Changes**: Create directory before saving storage state

```typescript
import * as fs from "fs";

// Before saving storage state:
const authDir = path.dirname(authFile);
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
  console.log("[Auth] Created auth directory:", authDir);
}
await page.context().storageState({ path: authFile });
```

#### Fix B: Add Wait After Sign In Click
**File**: `apps/polychromos-app/e2e/global.setup.ts`
**Changes**: Add explicit wait after clicking Continue to allow redirect

```typescript
// After clicking Continue for password:
await page.getByRole("button", { name: "Continue" }).click();

// Wait for modal to close
await page.waitForSelector(".cl-modalContent", { state: "hidden", timeout: 10000 });

// Wait for navigation to complete
await page.waitForLoadState("networkidle");
```

#### Fix C: Verify Clerk Testing Token Integration
**File**: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts`
**Changes**: Add explicit page navigation after token setup

```typescript
test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
  // Force page reload to apply token
  await page.goto("/");
  await page.waitForLoadState("networkidle");
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Tests pass locally: `pnpm --filter @repo/app test:e2e:browser`
- [ ] Storage state file is created: `ls apps/polychromos-app/playwright/.clerk/user.json`

#### Manual Verification:
- [ ] All three workspace tests pass
- [ ] No authentication-related errors in console

**Implementation Note**: Apply fixes one at a time and verify each before proceeding.

---

## Phase 5: Verify Convex Backend Auth Configuration

### Overview
Ensure the local Convex backend is properly configured for Clerk JWT validation.

### Checks:

1. **Verify CLERK_JWT_ISSUER_DOMAIN is being set**:
```bash
cd apps/polychromos-app
./scripts/local-backend.sh convex env list
```
Should include `CLERK_JWT_ISSUER_DOMAIN`.

2. **Check e2eRunner.cjs sets the env var**:
The current code in `e2eRunner.cjs:54-59` only sets `CLERK_JWT_ISSUER_DOMAIN` if it exists in `process.env`. Verify it's present:
```bash
echo $CLERK_JWT_ISSUER_DOMAIN
```

### Potential Fix:
**File**: `apps/polychromos-app/test/e2eRunner.cjs`
**Changes**: Add error if CLERK_JWT_ISSUER_DOMAIN is missing

```javascript
// After line 59:
if (!process.env.CLERK_JWT_ISSUER_DOMAIN) {
  console.warn('[E2E] WARNING: CLERK_JWT_ISSUER_DOMAIN not set - Clerk auth may fail');
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `convex env list` shows CLERK_JWT_ISSUER_DOMAIN
- [ ] E2E runner outputs no warnings about missing env vars

#### Manual Verification:
- [ ] Convex backend accepts authenticated requests

---

## Phase 6: Apply Final Fixes and Clean Up

### Overview
Remove debug logging and apply production-ready fixes.

### Changes Required:

1. **Remove excessive logging from global.setup.ts** - Keep only essential logs
2. **Remove excessive logging from workspace-flow.spec.ts** - Keep only essential logs
3. **Keep diagnostic screenshots on failure only**

### Final Test File:
**File**: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Authenticated Workspace Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("can create a new workspace", async ({ page }) => {
    await page.goto("/");

    // Should see authenticated content
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Click create workspace button
    await page.getByRole("button", { name: /create new design/i }).click();

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/workspace=/);

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    expect(workspaceId).toBeTruthy();
  });

  test("workspace persists after page reload", async ({ page }) => {
    await page.goto("/");

    // Wait for authenticated content
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");

    // Reload page
    await page.reload();

    // Wait for auth to re-establish
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Should still have same workspace in URL
    const newUrl = new URL(page.url());
    expect(newUrl.searchParams.get("workspace")).toBe(workspaceId);
  });

  test("workspace preview shows after creation", async ({ page }) => {
    await page.goto("/");

    // Wait for authenticated content
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
      timeout: 15000,
    });

    // Create workspace
    await page.getByRole("button", { name: /create new design/i }).click();
    await page.waitForURL(/workspace=/);

    // Should see the workspace name heading
    await expect(
      page.getByRole("heading", { name: /new design|untitled design/i }),
    ).toBeVisible({
      timeout: 15000,
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass locally: `pnpm --filter @repo/app test:e2e:browser`
- [ ] No debug output in logs
- [ ] Playwright report shows 3 passing tests

#### Manual Verification:
- [ ] Tests run in under 60 seconds
- [ ] No console errors or warnings

---

## Phase 7: CI Simulation and Final Verification

### Overview
Simulate CI environment locally to verify the fix works in CI.

### Steps:

1. **Set CI environment variable**:
```bash
export CI=true
```

2. **Clear any cached state**:
```bash
rm -rf apps/polychromos-app/playwright/.clerk/
rm -rf apps/polychromos-app/test-results/
rm -rf apps/polychromos-app/playwright-report/
```

3. **Run full E2E suite**:
```bash
cd apps/polychromos-app
node test/e2eRunner.cjs --browser
```

4. **Verify results**:
```bash
cat apps/polychromos-app/playwright-report/index.html | grep -o '"passed":[0-9]*'
```
Should show `"passed":3` or more.

### Success Criteria:

#### Automated Verification:
- [ ] All browser tests pass: `node test/e2eRunner.cjs --browser` exits with code 0
- [ ] Playwright report shows all tests passed

#### Manual Verification:
- [ ] Tests complete within CI timeout (15 minutes)
- [ ] No flaky failures on repeated runs (run 3 times)

---

## Testing Strategy

### Unit Tests:
- Not applicable for E2E test infrastructure changes

### Integration Tests:
- E2E tests themselves serve as integration tests

### Manual Testing Steps:
1. Run E2E tests locally 3 times to verify stability
2. Verify each test creates workspace correctly
3. Check Playwright report for timing information
4. Review test-results folder for any failure screenshots

## Performance Considerations

- **Timeout increases**: Increased from 10s to 15s for auth visibility checks to handle slower CI environments
- **Network idle wait**: Helps ensure Clerk and Convex are fully loaded before interactions
- **Storage state reuse**: Authenticated state is saved once and reused across tests

## References

- Original research: `thoughts/shared/research/2026-02-03-e2e-browser-test-selectors-analysis.md`
- Playwright config: `apps/polychromos-app/playwright.config.ts`
- E2E runner: `apps/polychromos-app/test/e2eRunner.cjs`
- Global setup: `apps/polychromos-app/e2e/global.setup.ts`
- Failing tests: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts`
- CI workflow: `.github/workflows/ci.yml:64-107`
