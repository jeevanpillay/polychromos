---
date: 2026-02-02T08:41:09+00:00
researcher: Claude
git_commit: 88ad07c4d638598241f88da07b801ee954a263b1
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Authentication Testing Strategy for Polychromos"
tags: [research, testing, polychromos, authentication, convex-auth, clerk, e2e, integration-tests, cli]
status: complete
priority: 1
dependencies: [2026-02-02-polychromos-testing-3-integration-tests.md, 2026-02-02-polychromos-testing-4-e2e-tests.md]
last_updated: 2026-02-02
last_updated_by: Claude
related_research: 2026-02-02-polychromos-clerk-convex-auth-integration.md
---

# Research: Authentication Testing Strategy for Polychromos

**Date**: 2026-02-02T08:41:09+00:00
**Researcher**: Claude
**Git Commit**: 88ad07c4d638598241f88da07b801ee954a263b1
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Questions

1. How will E2E and integration testing work when adding an authentication provider (Clerk or convex-auth)?
2. What considerations are needed for new CLI commands (login/logout)?
3. Should we use convex-auth for vitest testing and Clerk for production?

## Summary

This research analyzes the testing implications of adding authentication to Polychromos. The current codebase has **no authentication implementation** - it's designed as a single-user system in V1. When authentication is added, the testing infrastructure will need significant modifications.

**Key Findings:**

1. **Dual-auth strategy (convex-auth for testing, Clerk for production) is NOT recommended** - it introduces complexity without clear benefits
2. **convex-test provides built-in `withIdentity()` mocking** that works with any auth provider
3. **Clerk provides `@clerk/testing` package** with Playwright integration for E2E tests
4. **CLI authentication requires OAuth device flow or API token strategy**

---

## 1. Current State Analysis

### No Authentication Implemented

Based on codebase analysis, the Polychromos project currently has:

| Layer | Authentication Status |
|-------|----------------------|
| Convex Backend | No auth tables, no middleware, no user context |
| Frontend | No auth UI, no protected routes, no session management |
| CLI | No login/logout commands, no token storage |
| Dependencies | No auth libraries installed |

**Relevant files:**
- `apps/polychromos-app/convex/schema.ts` - Only `workspaces` and `events` tables
- `apps/polychromos-app/convex/workspaces.ts` - No auth checks on mutations
- `packages/polychromos/src/index.ts` - CLI commands: init, dev, undo, redo, history, checkpoint, export

### Existing Infrastructure Prepared for Clerk

Environment variables are configured in build pipeline (`turbo.json:64-66`):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`

Convex provides `convex/react-clerk` integration (available but unused).

---

## 2. Authentication Testing Strategies

### 2.1 Integration Testing with convex-test

**convex-test provides `withIdentity()` for mocking authentication:**

```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Authenticated workspace operations", () => {
  test("users can only see their own workspaces", async () => {
    const t = convexTest(schema, modules);

    // Create two different user contexts
    const asSarah = t.withIdentity({
      name: "Sarah",
      email: "sarah@example.com"
    });

    const asLee = t.withIdentity({
      name: "Lee",
      email: "lee@example.com"
    });

    // Sarah creates a workspace
    const sarahWorkspace = await asSarah.mutation(api.workspaces.create, {
      name: "Sarah's Design",
      data: { id: 'ws_1', version: '1.0', name: "Sarah's", components: {} }
    });

    // Lee creates a workspace
    await asLee.mutation(api.workspaces.create, {
      name: "Lee's Design",
      data: { id: 'ws_2', version: '1.0', name: "Lee's", components: {} }
    });

    // Each user should only see their own workspaces
    const sarahsWorkspaces = await asSarah.query(api.workspaces.list);
    expect(sarahsWorkspaces).toHaveLength(1);
    expect(sarahsWorkspaces[0].name).toBe("Sarah's Design");

    const leesWorkspaces = await asLee.query(api.workspaces.list);
    expect(leesWorkspaces).toHaveLength(1);
  });

  test("unauthenticated users cannot create workspaces", async () => {
    const t = convexTest(schema, modules);

    // Call without identity (unauthenticated)
    await expect(
      t.mutation(api.workspaces.create, {
        name: "Should fail",
        data: { id: 'ws_x', version: '1.0', name: "Test", components: {} }
      })
    ).rejects.toThrow("Unauthenticated");
  });
});
```

**For convex-auth specifically, use the userId|sessionId format:**

```typescript
const asUser = t.withIdentity({
  subject: "user123|session456",  // convex-auth uses pipe separator
  issuer: "https://your-deployment.convex.site"
});
```

### 2.2 E2E Testing with Clerk

**Clerk provides `@clerk/testing` package for Playwright:**

```bash
pnpm add @clerk/testing -D
```

**Setup (`playwright.config.ts`):**

```typescript
import { clerkSetup } from '@clerk/testing/playwright';

export default defineConfig({
  testDir: './e2e/browser',
  globalSetup: require.resolve('./e2e/global.setup.ts'),
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.clerk/user.json'  // Reuse auth state
      },
      dependencies: ['setup']
    }
  ],
});
```

**Global setup for authentication (`e2e/global.setup.ts`):**

```typescript
import { clerkSetup, clerk } from '@clerk/testing/playwright';
import { chromium } from '@playwright/test';

export default async function globalSetup() {
  await clerkSetup();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!
    }
  });

  // Save authenticated state
  await page.context().storageState({
    path: 'playwright/.clerk/user.json'
  });

  await browser.close();
}
```

**Test file using saved auth state:**

```typescript
// apps/polychromos-app/e2e/browser/authenticated-flow.spec.ts
import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.use({ storageState: 'playwright/.clerk/user.json' });

test('authenticated user can create workspace', async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto('/');

  // Already authenticated from saved state
  await expect(page.getByText('Create New Design')).toBeVisible();
  await page.getByRole('button', { name: 'Create New Design' }).click();
  await page.waitForURL(/workspace=/);

  const workspaceId = new URL(page.url()).searchParams.get('workspace');
  expect(workspaceId).toBeTruthy();
});
```

**Required environment variables:**

```bash
# .env.test
E2E_CLERK_USER_USERNAME=test-user
E2E_CLERK_USER_PASSWORD=test-password
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

---

## 3. CLI Authentication Commands

### Proposed Commands

| Command | Description |
|---------|-------------|
| `polychromos login` | Authenticate via browser OAuth or device code |
| `polychromos logout` | Clear stored credentials |
| `polychromos whoami` | Display current authenticated user |

### Implementation Pattern

**Token storage location:** `~/.polychromos/credentials.json` or system keychain

**Login command options:**

#### Option A: Browser OAuth Flow (Recommended for Clerk)

```typescript
// packages/polychromos/src/commands/login.ts
import open from 'open';
import http from 'http';

export async function loginCommand(): Promise<void> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      // Exchange code for token
      const token = await exchangeCodeForToken(code);
      await saveCredentials(token);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Login successful! You can close this window.</h1>');
      server.close();
    }
  });

  const port = 9876;
  server.listen(port);

  const authUrl = `https://your-app.clerk.dev/sign-in?redirect_uri=http://localhost:${port}/callback`;
  console.log('Opening browser for authentication...');
  await open(authUrl);
}
```

#### Option B: Device Code Flow (Better for CLI UX)

```typescript
// packages/polychromos/src/commands/login.ts
export async function loginCommand(): Promise<void> {
  // Request device code from auth server
  const { device_code, user_code, verification_uri } = await requestDeviceCode();

  console.log(`\nTo authenticate, visit: ${verification_uri}`);
  console.log(`And enter code: ${user_code}\n`);

  // Poll for completion
  const token = await pollForToken(device_code);
  await saveCredentials(token);

  console.log('✓ Login successful!');
}
```

### Testing CLI Authentication

**Integration test with mocked OAuth:**

```typescript
// packages/polychromos/src/__tests__/commands/login.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { homedir } from 'os';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('open', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('login command', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(`${homedir()}/.polychromos`, { recursive: true });
  });

  afterEach(() => {
    vol.reset();
    vi.clearAllMocks();
  });

  it('stores credentials on successful login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        access_token: 'test_token_123',
        refresh_token: 'refresh_456',
        expires_in: 3600,
      }),
    });

    const { loginCommand } = await import('../../commands/login.js');

    // Simulate callback with auth code
    await loginCommand({ code: 'auth_code_from_oauth' });

    const creds = JSON.parse(
      vol.readFileSync(`${homedir()}/.polychromos/credentials.json`, 'utf-8')
    );

    expect(creds.accessToken).toBe('test_token_123');
    expect(creds.refreshToken).toBe('refresh_456');
  });

  it('handles auth errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    });

    const consoleSpy = vi.spyOn(console, 'error');
    const { loginCommand } = await import('../../commands/login.js');

    await expect(loginCommand({ code: 'bad_code' })).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
  });
});
```

**Logout command test:**

```typescript
// packages/polychromos/src/__tests__/commands/logout.test.ts
describe('logout command', () => {
  it('removes credentials file', async () => {
    vol.fromJSON({
      [`${homedir()}/.polychromos/credentials.json`]: JSON.stringify({
        accessToken: 'token',
        refreshToken: 'refresh',
      }),
    });

    const { logoutCommand } = await import('../../commands/logout.js');
    await logoutCommand();

    expect(vol.existsSync(`${homedir()}/.polychromos/credentials.json`)).toBe(false);
  });

  it('handles already logged out state', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { logoutCommand } = await import('../../commands/logout.js');

    await logoutCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already logged out'));
  });
});
```

---

## 4. Dual-Auth Strategy Analysis

### Question: Should we use convex-auth for testing and Clerk for production?

### Answer: **No, this is not recommended.**

#### Reasons Against Dual-Auth:

| Concern | Details |
|---------|---------|
| **Complexity** | Maintaining two auth systems doubles configuration, debugging, and security audit surface |
| **Divergent Behavior** | convex-auth and Clerk have different token formats, session handling, and edge cases |
| **False Positives/Negatives** | Tests may pass with convex-auth but fail in production with Clerk (or vice versa) |
| **Maintenance Burden** | Schema changes must be synchronized between two auth systems |
| **Learning Curve** | Team must understand both systems |

#### Recommended Approach:

**Use Clerk for both production AND testing, with different strategies per test type:**

| Test Type | Strategy | Why |
|-----------|----------|-----|
| **Unit Tests** | Mock `ctx.auth.getUserIdentity()` | Fast, isolated, no external dependencies |
| **Integration Tests (Convex)** | Use `convex-test` with `withIdentity()` | Mocks auth at Convex level, works with any provider |
| **E2E Tests (Playwright)** | Use `@clerk/testing` with real Clerk | Tests full auth flow, catches production issues |

#### Example: convex-test Works With Any Auth Provider

The `withIdentity()` method in convex-test creates a mock identity that your Convex functions receive via `ctx.auth.getUserIdentity()`. This works regardless of whether you use Clerk, convex-auth, or any other provider:

```typescript
// This test works the same way whether production uses Clerk or convex-auth
const asUser = t.withIdentity({
  name: "Test User",
  email: "test@example.com"
});

// Your Convex function receives this identity
await asUser.mutation(api.workspaces.create, { ... });
```

The key insight: **convex-test mocks at the identity level, not the provider level.** Your Convex functions don't care which provider issued the identity.

---

## 5. Modified Testing Infrastructure

### Updates to Existing Test Files

Based on the current testing research documents, here are the modifications needed when auth is added:

#### 5.1 Convex Schema Updates

```typescript
// apps/polychromos-app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    data: v.any(),
    version: v.number(),
    ownerId: v.string(),           // NEW: User who owns the workspace
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),  // NEW: Index for user's workspaces

  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(),            // NEW: User who made the change
    patches: v.array(v.object({
      op: v.string(),
      path: v.string(),
      value: v.optional(v.any()),
    })),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_version", ["workspaceId", "version"]),
});
```

#### 5.2 Authenticated Convex Functions

```typescript
// apps/polychromos-app/convex/workspaces.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    return ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const now = Date.now();
    return ctx.db.insert("workspaces", {
      name: args.name,
      data: args.data,
      version: 1,
      ownerId: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

#### 5.3 Updated Integration Tests

```typescript
// apps/polychromos-app/convex/__tests__/workspaces.test.ts
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import { api } from '../_generated/api';
import schema from '../schema';

const modules = import.meta.glob('../**/*.ts');

describe('workspaces mutations (authenticated)', () => {
  describe('create', () => {
    it('creates workspace with owner', async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Test User" });

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: 'My Design',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const workspace = await asUser.query(api.workspaces.get, { id: workspaceId });
      expect(workspace?.name).toBe('My Design');
    });

    it('rejects unauthenticated create', async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(api.workspaces.create, {
          name: 'Should Fail',
          data: { id: 'ws_x', version: '1.0', name: 'Test', components: {} },
        })
      ).rejects.toThrow('Unauthenticated');
    });
  });

  describe('list', () => {
    it('only returns user own workspaces', async () => {
      const t = convexTest(schema, modules);
      const asAlice = t.withIdentity({ name: "Alice" });
      const asBob = t.withIdentity({ name: "Bob" });

      await asAlice.mutation(api.workspaces.create, {
        name: "Alice's Design",
        data: { id: 'ws_a', version: '1.0', name: 'Alice', components: {} },
      });

      await asBob.mutation(api.workspaces.create, {
        name: "Bob's Design",
        data: { id: 'ws_b', version: '1.0', name: 'Bob', components: {} },
      });

      const aliceWorkspaces = await asAlice.query(api.workspaces.list);
      const bobWorkspaces = await asBob.query(api.workspaces.list);

      expect(aliceWorkspaces).toHaveLength(1);
      expect(aliceWorkspaces[0].name).toBe("Alice's Design");

      expect(bobWorkspaces).toHaveLength(1);
      expect(bobWorkspaces[0].name).toBe("Bob's Design");
    });
  });
});
```

#### 5.4 CLI Dev Command with Auth

```typescript
// packages/polychromos/src/commands/dev.ts (modified for auth)
import { ConvexHttpClient } from 'convex/browser';
import { loadCredentials } from '../lib/credentials.js';

export async function devCommand(): Promise<void> {
  const credentials = await loadCredentials();

  if (!credentials) {
    console.error('Not authenticated. Run `polychromos login` first.');
    process.exit(1);
  }

  const config = await loadConfig();
  const client = new ConvexHttpClient(config.convexUrl);

  // Set auth token for all requests
  client.setAuth(credentials.accessToken);

  // ... rest of dev command with authenticated client
}
```

#### 5.5 E2E Test Updates

```typescript
// apps/polychromos-app/e2e/browser/workspace-flow.spec.ts
import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, homedir } from 'path';

const TEST_DIR = '/tmp/polychromos-playwright';

test.describe('Authenticated Workspace Flow', () => {
  test.use({ storageState: 'playwright/.clerk/user.json' });

  test('CLI syncs to authenticated workspace', async ({ page }) => {
    await setupClerkTestingToken({ page });

    // Navigate and create workspace
    await page.goto('/');
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    const workspaceId = new URL(page.url()).searchParams.get('workspace');

    // Setup CLI with test credentials (pre-authenticated)
    mkdirSync(`${homedir()}/.polychromos`, { recursive: true });
    writeFileSync(
      `${homedir()}/.polychromos/credentials.json`,
      JSON.stringify({
        accessToken: process.env.E2E_CLI_ACCESS_TOKEN,
        refreshToken: process.env.E2E_CLI_REFRESH_TOKEN,
      })
    );

    // Setup workspace config
    mkdirSync(join(TEST_DIR, '.polychromos'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.polychromos/config.json'),
      JSON.stringify({
        convexUrl: process.env.VITE_CONVEX_URL,
        workspaceId,
      })
    );

    // Write design file
    writeFileSync(
      join(TEST_DIR, 'design.json'),
      JSON.stringify({
        id: workspaceId,
        version: '1.0',
        name: 'CLI Updated Design',
        components: {
          main: {
            id: 'main',
            name: 'main',
            width: 800,
            height: 600,
            root: {
              id: 'root',
              type: 'box',
              children: [{
                id: 'text-1',
                type: 'text',
                text: { content: 'Updated via authenticated CLI', fontSize: 24 },
              }],
            },
          },
        },
      }, null, 2)
    );

    // Start CLI
    const cli = spawn('npx', ['polychromos', 'dev'], {
      cwd: TEST_DIR,
      env: { ...process.env },
      stdio: 'pipe',
    });

    // Wait and verify
    await expect(
      page.getByText('Updated via authenticated CLI')
    ).toBeVisible({ timeout: 10000 });

    cli.kill();
  });
});
```

---

## 6. Implementation Recommendations

### Phase 1: Prepare Auth Infrastructure (Before V2)

1. Install Clerk packages:
   ```bash
   pnpm add @clerk/clerk-react @clerk/testing -D
   ```

2. Add auth schema tables to Convex

3. Create CLI credentials module with token storage

4. Update convex-test integration tests with `withIdentity()`

### Phase 2: Implement Authentication (V2)

1. Add ClerkProvider to React app

2. Create login/logout CLI commands

3. Add auth middleware to Convex functions

4. Update E2E tests with `@clerk/testing`

### Phase 3: CI/CD Updates

1. Add Clerk secrets to GitHub Actions
2. Create dedicated test user in Clerk
3. Configure Playwright with auth state caching
4. Update test scripts in package.json

---

## Code References

- `apps/polychromos-app/convex/schema.ts` - Current schema (no auth)
- `apps/polychromos-app/convex/workspaces.ts` - Current mutations (no auth checks)
- `packages/polychromos/src/index.ts` - CLI entry point
- `packages/polychromos/src/commands/dev.ts` - Dev command with Convex sync
- `packages/polychromos/src/lib/config.ts` - Config module (extend for credentials)
- `turbo.json:64-66` - Clerk environment variables already configured

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-02-polychromos-mvp-implementation.md` - V1 excludes auth
- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - Raises CLI auth question
- `thoughts/shared/research/2026-02-02-polychromos-testing-3-integration-tests.md` - Current integration test patterns
- `thoughts/shared/research/2026-02-02-polychromos-testing-4-e2e-tests.md` - Current E2E test patterns

## Related Research

- [convex-test | Convex Developer Hub](https://docs.convex.dev/testing/convex-test)
- [Testing with Playwright - Clerk Docs](https://clerk.com/docs/guides/development/testing/playwright/overview)
- [@clerk/testing npm package](https://www.npmjs.com/package/@clerk/testing)
- [Testing patterns for peace of mind](https://stack.convex.dev/testing-patterns)

## Open Questions

1. **Token refresh strategy for CLI**: How to handle expired tokens during long dev sessions?
2. **Multi-device CLI sessions**: Should we support concurrent CLI logins from multiple machines?
3. **Workspace sharing**: When auth is added, how will workspace collaboration affect testing?
4. **Offline support**: Should CLI cache credentials for offline scenarios?

---

## Comprehensive Implementation Guide

**See**: [`2026-02-02-polychromos-clerk-convex-auth-integration.md`](./2026-02-02-polychromos-clerk-convex-auth-integration.md)

For full end-to-end implementation details including:
- ConvexProviderWithClerk setup with TanStack Start
- CLI browser OAuth redirect flow implementation
- Token storage with system keychain (keytar)
- Schema migration with Convex Migrations Component
- @clerk/testing E2E patterns with auth state caching
- CI/CD configuration with Clerk secrets
- Performance considerations for JWT verification
