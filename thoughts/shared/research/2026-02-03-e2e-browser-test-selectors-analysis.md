---
date: 2026-02-03T00:00:00Z
researcher: Claude
git_commit: b441a7d528e29d1b88fb51696a90399f9ad0d67a
branch: main
repository: jeevanpillaystudios/polychromos
topic: "E2E Browser Test Selectors and Workspace Flow Analysis"
tags: [research, e2e-testing, playwright, clerk, workspace, polychromos-app]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: E2E Browser Test Selectors and Workspace Flow Analysis

**Date**: 2026-02-03
**Researcher**: Claude
**Git Commit**: b441a7d528e29d1b88fb51696a90399f9ad0d67a
**Branch**: main
**Repository**: jeevanpillaystudios/polychromos

## Research Question

The E2E Browser Tests in CI are failing with "expect(locator).toBeVisible() failed - element(s) not found" errors. The failing tests are:
1. "can create a new workspace"
2. "persists after page reload"
3. "review shows after creation"

This research documents the E2E test setup to understand what selectors the tests use and what components should render those elements.

## Summary

The E2E browser tests are located in `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts` and use Playwright with Clerk authentication. The tests wait for a `[data-testid='authenticated']` element to become visible, which is rendered by the `<Authenticated>` component wrapper in `apps/polychromos-app/src/routes/index.tsx`. The workspace creation flow involves clicking a "Create New Design" button, which calls a Convex mutation to create a workspace, then navigates to `/?workspace={id}`.

## Detailed Findings

### 1. E2E Test Directory Structure

The E2E tests are located at:

```
apps/polychromos-app/
├── playwright.config.ts                 # Playwright configuration
└── e2e/
    ├── README.md                        # E2E documentation
    ├── global.setup.ts                  # Clerk authentication setup
    ├── browser/                         # Browser-specific tests
    │   ├── workspace-flow.spec.ts       # Failing tests
    │   ├── auth-ui.spec.ts              # Auth UI tests (authenticated)
    │   ├── auth-ui.unauth.spec.ts       # Auth UI tests (unauthenticated)
    │   ├── access-control.spec.ts       # Access control tests
    │   └── access-control.unauth.spec.ts
    └── cross-platform/
        └── cli-to-web.spec.ts           # CLI-to-web sync tests
```

### 2. Failing Test Selectors

**File**: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts`

The three failing tests use the following selectors:

#### Test: "can create a new workspace" (lines 9-25)
```typescript
// Wait for authenticated content
await expect(page.locator("[data-testid='authenticated']")).toBeVisible();

// Click create workspace button
await page.getByRole("button", { name: /create new design/i }).click();

// Wait for workspace creation and URL update
await page.waitForURL(/workspace=/);
```

#### Test: "workspace persists after page reload" (lines 27-48)
```typescript
// Wait for authenticated content
await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
  timeout: 10000,
});

// Create workspace
await page.getByRole("button", { name: /create new design/i }).click();
await page.waitForURL(/workspace=/);
```

#### Test: "workspace preview shows after creation" (lines 50-68)
```typescript
// Wait for authenticated content
await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
  timeout: 10000,
});

// Create workspace
await page.getByRole("button", { name: /create new design/i }).click();
await page.waitForURL(/workspace=/);

// Should see the workspace name heading
await expect(
  page.getByRole("heading", { name: /new design|untitled design/i }),
).toBeVisible({
  timeout: 10000,
});
```

### 3. App Components That Render Test Elements

**File**: `apps/polychromos-app/src/routes/index.tsx`

The main route component renders three states based on auth:

```typescript
function HomePage() {
  return (
    <div className="bg-background min-h-screen">
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>

      <Unauthenticated>
        <SignInButton mode="modal">
          <button>Sign In</button>
        </SignInButton>
      </Unauthenticated>

      <Authenticated>
        <div data-testid="authenticated">   // <-- This is the test element
          <AuthenticatedContent />
        </div>
      </Authenticated>
    </div>
  );
}
```

**The `data-testid="authenticated"` element**:
- Located at line 52 of `apps/polychromos-app/src/routes/index.tsx`
- Only renders when the `<Authenticated>` Convex component resolves
- Contains the `AuthenticatedContent` component

**The "Create New Design" button**:
- Located at lines 126-131 of `apps/polychromos-app/src/routes/index.tsx`
- Inside `AuthenticatedContent` component
- Exact text: "Create New Design"

```typescript
<button
  onClick={handleCreateNewDesign}
  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-3 font-semibold"
>
  Create New Design
</button>
```

**The workspace name heading**:
- Located at lines 177-179 of `apps/polychromos-app/src/routes/index.tsx`
- Inside `WorkspacePreview` component
- Renders workspace name or "Untitled Design" as fallback

```typescript
<h2 className="text-lg font-semibold">
  {workspace.data.name || "Untitled Design"}
</h2>
```

### 4. Authentication Flow in Tests

**Global Setup** (`apps/polychromos-app/e2e/global.setup.ts`):

1. `clerkSetup()` initializes Clerk testing
2. Navigates to `/` and waits for network idle
3. Clicks "Sign In" button to open Clerk modal
4. Enters email from `E2E_CLERK_USER_EMAIL`
5. Clicks "Continue"
6. Enters password from `E2E_CLERK_USER_PASSWORD`
7. Clicks "Continue"
8. Waits for `[data-testid='authenticated']` (30s timeout)
9. Saves auth state to `playwright/.clerk/user.json`

**Test Setup** (in each test):
```typescript
test.beforeEach(async ({ page }) => {
  await setupClerkTestingToken({ page });
});
```

This uses `@clerk/testing/playwright` to set up a testing token.

**Playwright Config** (`apps/polychromos-app/playwright.config.ts`):

```typescript
projects: [
  {
    name: "setup",
    testDir: "./e2e",
    testMatch: /global\.setup\.ts/,
  },
  {
    name: "chromium",
    testDir: "./e2e/browser",
    testIgnore: /\.unauth\.spec\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: "playwright/.clerk/user.json",  // Uses saved auth
    },
    dependencies: ["setup"],  // Runs after setup
  },
]
```

### 5. Workspace Creation Flow in the App

When "Create New Design" is clicked:

1. `handleCreateNewDesign` function is called (lines 65-112)
2. Creates a default `PolychromosWorkspace` object with:
   - `name: "New Design"`
   - `components.main` with a root box containing welcome text
3. Calls `createWorkspaceMutation` (Convex mutation)
4. On success, navigates to `/?workspace={workspaceId}`

**Convex Mutation** (`apps/polychromos-app/convex/workspaces.ts:41-62`):
```typescript
export const create = mutation({
  args: {
    name: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      data: args.data,
      baseData: args.data,
      eventVersion: 0,
      maxEventVersion: 0,
      version: 1,
      ownerId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});
```

### 6. CI Configuration

**File**: `.github/workflows/ci.yml`

The E2E browser tests run in the `e2e-browser` job (lines 64-107):

```yaml
e2e-browser:
  name: E2E Browser Tests
  needs: [changes, quality]
  if: needs.changes.outputs.polychromos-app == 'true' || needs.changes.outputs.polychromos-cli == 'true'

  env:
    VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    CLERK_JWT_ISSUER_DOMAIN: ${{ vars.CLERK_JWT_ISSUER_DOMAIN }}
    E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
    E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
    VITE_CONVEX_URL: http://127.0.0.1:3210

  steps:
    - name: Run E2E Browser Tests
      working-directory: apps/polychromos-app
      run: node test/e2eRunner.cjs --browser
```

**E2E Runner** (`apps/polychromos-app/test/e2eRunner.cjs`):
1. Starts local Convex backend on port 3210
2. Deploys Convex schema with test environment variables
3. Starts web app
4. Runs Playwright auth setup (`--project=setup`)
5. Runs browser tests (`--project=chromium --project=unauthenticated`)

### 7. Selector Summary Table

| Selector | Element | Component | File:Line |
|----------|---------|-----------|-----------|
| `[data-testid='authenticated']` | Authenticated content wrapper | `HomePage` | `routes/index.tsx:52` |
| `button` with name `/create new design/i` | Create button | `AuthenticatedContent` | `routes/index.tsx:126-131` |
| `heading` with name `/new design\|untitled design/i` | Workspace name | `WorkspacePreview` | `routes/index.tsx:177-179` |
| `.cl-userButtonTrigger` | Clerk user button | Clerk component | External |
| `.cl-modalContent` | Clerk sign-in modal | Clerk component | External |
| `button` with name `/sign in/i` | Sign in button | `HomePage` (Unauthenticated) | `routes/index.tsx:43-47` |

### 8. Required Environment Variables

| Variable | Source | Usage |
|----------|--------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | GitHub vars | Clerk client initialization |
| `CLERK_SECRET_KEY` | GitHub secrets | Clerk server operations |
| `CLERK_JWT_ISSUER_DOMAIN` | GitHub vars | JWT validation |
| `E2E_CLERK_USER_EMAIL` | GitHub secrets | Test user credentials |
| `E2E_CLERK_USER_PASSWORD` | GitHub secrets | Test user credentials |
| `VITE_CONVEX_URL` | Set to `http://127.0.0.1:3210` | Local Convex backend |

## Code References

- `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts` - Failing test file
- `apps/polychromos-app/e2e/global.setup.ts` - Clerk auth setup
- `apps/polychromos-app/src/routes/index.tsx:52` - `data-testid="authenticated"` element
- `apps/polychromos-app/src/routes/index.tsx:126-131` - "Create New Design" button
- `apps/polychromos-app/src/routes/index.tsx:177-179` - Workspace name heading
- `apps/polychromos-app/playwright.config.ts` - Playwright configuration
- `apps/polychromos-app/test/e2eRunner.cjs` - Test orchestration
- `apps/polychromos-app/convex/workspaces.ts:41-62` - Workspace creation mutation
- `.github/workflows/ci.yml:64-107` - E2E browser test CI job

## Architecture Documentation

### Test Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     e2eRunner.cjs                           │
├─────────────────────────────────────────────────────────────┤
│  1. startBackend()      → Local Convex on :3210            │
│  2. deployConvexSchema  → Sets IS_TEST, JWT_ISSUER_DOMAIN  │
│  3. startWebApp()       → TanStack Start on :3001          │
│  4. Playwright setup    → Authenticates, saves user.json   │
│  5. Playwright chromium → Runs workspace-flow.spec.ts      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  workspace-flow.spec.ts                     │
├─────────────────────────────────────────────────────────────┤
│  beforeEach: setupClerkTestingToken({ page })              │
│                                                             │
│  test: page.goto("/")                                       │
│        → wait for [data-testid='authenticated']            │
│        → click "Create New Design"                         │
│        → wait for URL to contain ?workspace=               │
│        → (verify heading "New Design")                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Rendering Chain

```
HomePage (routes/index.tsx)
├── <AuthLoading>       → Shows "Loading..." during auth check
├── <Unauthenticated>   → Shows "Sign In" button
└── <Authenticated>
    └── <div data-testid="authenticated">   ← Test waits for this
        └── <AuthenticatedContent>
            ├── "Create New Design" button   ← Test clicks this
            └── <WorkspacePreview> (if workspace param exists)
                └── <h2>{workspace.data.name}</h2>  ← Test checks this
```

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-03-polychromos-app-e2e-testing-architecture.md` - Prior research on E2E testing architecture
- `thoughts/shared/research/2026-02-02-polychromos-e2e-testing-requirements.md` - E2E testing requirements
- `thoughts/shared/research/2026-02-02-polychromos-testing-4-e2e-tests.md` - Previous E2E test research

## Related Research

- `thoughts/shared/research/2026-02-03-polychromos-app-e2e-testing-architecture.md` - Comprehensive E2E architecture documentation

## Open Questions

1. **Is the `<Authenticated>` component from Convex rendering correctly?** - The test failure "element(s) not found" for `[data-testid='authenticated']` indicates the authenticated wrapper may not be rendering.

2. **Is the Clerk auth setup completing successfully?** - The global setup depends on Clerk credentials being valid and the Clerk modal appearing correctly.

3. **Are environment variables being set correctly in CI?** - Missing or incorrect `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, or `CLERK_JWT_ISSUER_DOMAIN` could prevent authentication.

4. **Is the Convex backend connection working?** - If `VITE_CONVEX_URL` is set to `http://127.0.0.1:3210` but the backend isn't running or schema isn't deployed, the Convex `<Authenticated>` component may never resolve.

5. **Is there a timing issue?** - The tests use timeouts (10s for authenticated, 30s in global setup), but if the auth flow takes longer or hangs, the tests will fail.
