---
date: 2026-02-02T09:24:37+00:00
researcher: Claude
git_commit: 7d166d06789a46332e6499f4bddd489285ec66c3
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Clerk + Convex Authentication Integration for Polychromos"
tags: [research, polychromos, clerk, convex, authentication, cli, e2e-testing, oauth, jwt]
status: complete
priority: 1
dependencies: [2026-02-02-polychromos-auth-testing-strategy.md]
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Clerk + Convex Authentication Integration for Polychromos

**Date**: 2026-02-02T09:24:37+00:00
**Researcher**: Claude
**Git Commit**: 7d166d06789a46332e6499f4bddd489285ec66c3
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Questions

1. Clerk + Convex integration - Official patterns for ConvexProviderWithClerk, JWT verification, ctx.auth.getUserIdentity() usage
2. CLI authentication patterns - OAuth device flow vs browser redirect for Node.js CLI tools, token storage best practices
3. Convex auth patterns - How to add auth to existing Convex functions, withIdentity() testing patterns in convex-test
4. E2E testing - @clerk/testing patterns with Playwright
5. Performance impact - Latency added by Clerk JWT verification in Convex, any cold start implications

## Summary

This research provides comprehensive documentation for implementing Clerk + Convex authentication in the Polychromos code-driven design platform, covering:

1. **Web App Integration**: ConvexProviderWithClerk pattern with TanStack Start
2. **CLI Authentication**: Browser OAuth redirect with token storage
3. **Backend Auth Patterns**: ctx.auth.getUserIdentity() and custom wrappers
4. **Schema Design**: Required ownerId/userId fields from the start
5. **E2E Testing**: @clerk/testing with Playwright

**Key Findings**:
- Use `ConvexProviderWithClerk` with Clerk's `useAuth` hook passed as prop
- CLI auth: Browser redirect flow is recommended for Clerk (no native device flow support)
- Store CLI tokens in system keychain (keytar) with XDG-compliant config files
- JWT verification adds minimal latency (<20ms median) due to Convex's V8 isolate architecture

---

## 1. Clerk + Convex Integration - Official Patterns

### 1.1 ConvexProviderWithClerk Setup

**Source**: [Convex Clerk Documentation](https://docs.convex.dev/auth/clerk)

#### Basic React/TanStack Setup

```typescript
// apps/polychromos-app/src/router.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function getRouter() {
  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      Wrap: ({ children }) => (
        <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>
      ),
    }),
    queryClient,
  );
  return router;
}
```

**Critical Provider Ordering**:
- `ClerkProvider` **must wrap** `ConvexProviderWithClerk`
- Pass Clerk's `useAuth` hook as a prop (not called)
- Use Convex's `useConvexAuth()` in components (not Clerk's `useAuth()`)

#### UI Component Usage

| ❌ Don't Use (Clerk) | ✅ Use Instead (Convex) |
|---------------------|------------------------|
| `<SignedIn>` | `<Authenticated>` |
| `<SignedOut>` | `<Unauthenticated>` |
| `<ClerkLoading>` | `<AuthLoading>` |

```tsx
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { useConvexAuth } from 'convex/react'

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  return (
    <>
      <AuthLoading>Loading...</AuthLoading>
      <Authenticated>
        <ProtectedContent />
      </Authenticated>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
    </>
  )
}
```

### 1.2 auth.config.ts Setup for JWT Verification

**Source**: [Clerk Integration Guide](https://clerk.com/docs/guides/development/integrations/databases/convex)

```typescript
// apps/polychromos-app/convex/auth.config.ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

**Setup Steps**:

1. **Create JWT Template in Clerk Dashboard**:
   - Navigate to JWT Templates → New Template → Select "Convex"
   - **CRITICAL**: Do NOT rename - it MUST be called "convex"

2. **Get Issuer URL** (copy from JWT template):
   - Development: `https://verb-noun-00.clerk.accounts.dev`
   - Production: `https://clerk.<your-domain>.com`

3. **Configure Environment Variables**:
   ```bash
   # .env.local
   CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
   ```

4. **Deploy**: Must redeploy after creating auth.config.ts

### 1.3 ctx.auth.getUserIdentity() Usage

**Source**: [Auth in Functions](https://docs.convex.dev/auth/functions-auth)

```typescript
// apps/polychromos-app/convex/workspaces.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
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

    return ctx.db.insert("workspaces", {
      ...args,
      ownerId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

**UserIdentity Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `tokenIdentifier` | string | Globally unique (subject + issuer) |
| `subject` | string | User ID from Clerk |
| `issuer` | string | Clerk domain |
| `email` | string? | User's email |
| `name` | string? | Full name |
| Custom claims | any | From JWT template |

---

## 2. CLI Authentication Patterns

### 2.1 Recommended: Browser OAuth Redirect Flow

**Source**: [OAuth in Node.js CLI Apps](https://thecodebarbarian.com/oauth-in-nodejs-cli-apps.html)

Clerk does not support OAuth Device Flow (RFC 8628). Use browser redirect instead.

```typescript
// packages/polychromos/src/commands/login.ts
import open from 'open';
import http from 'http';
import { URL } from 'url';
import { saveCredentials } from '../lib/credentials.js';

const CALLBACK_PORT = 9876;
const CLERK_OAUTH_URL = process.env.CLERK_OAUTH_URL!;

export async function loginCommand(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authentication failed: ${error}</h1>`);
          server.close();
          reject(new Error(error));
          return;
        }

        try {
          // Exchange code for tokens
          const tokens = await exchangeCodeForTokens(code!);
          await saveCredentials(tokens);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Login successful! You can close this window.</h1>');
          console.log('✓ Login successful!');
          server.close();
          resolve();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Failed to complete authentication</h1>');
          server.close();
          reject(err);
        }
      }
    });

    server.listen(CALLBACK_PORT, () => {
      const authUrl = `${CLERK_OAUTH_URL}?redirect_uri=http://localhost:${CALLBACK_PORT}/callback`;
      console.log('Opening browser for authentication...');
      console.log(`If browser doesn't open, visit: ${authUrl}`);
      open(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out'));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await fetch(`${CLERK_OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `http://localhost:${CALLBACK_PORT}/callback`,
    }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}
```

### 2.2 Token Storage Best Practices

**Source**: [GitHub CLI Token Storage](https://github.com/cli/cli/discussions/7109)

#### Recommended: System Keychain (Most Secure)

```typescript
// packages/polychromos/src/lib/credentials.ts
import keytar from 'keytar';
import { xdgConfig } from '@folder/xdg';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const SERVICE_NAME = 'polychromos-cli';
const ACCOUNT_NAME = 'default';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Store sensitive tokens in system keychain
export async function saveCredentials(tokens: TokenData): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(tokens));
}

export async function loadCredentials(): Promise<TokenData | null> {
  const data = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (!data) return null;
  return JSON.parse(data);
}

export async function clearCredentials(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

// Store non-sensitive config in XDG-compliant directory
const CONFIG_DIR = join(xdgConfig(), 'polychromos');

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(join(CONFIG_DIR, 'config.json'), JSON.stringify(config, null, 2));
}

export async function loadConfig(): Promise<Record<string, unknown> | null> {
  try {
    const data = await readFile(join(CONFIG_DIR, 'config.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
```

**Dependencies**:
```bash
pnpm add keytar @folder/xdg
```

**Note**: `keytar` requires native compilation. For CI/CD or headless environments, provide `POLYCHROMOS_TOKEN` environment variable as fallback.

### 2.3 Refresh Token Handling

```typescript
// packages/polychromos/src/lib/auth.ts
import { loadCredentials, saveCredentials } from './credentials.js';

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

export async function getValidToken(): Promise<string> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error('Not authenticated. Run `polychromos login` first.');
  }

  // Check if token needs refresh
  if (Date.now() > creds.expiresAt - TOKEN_REFRESH_THRESHOLD) {
    const newTokens = await refreshAccessToken(creds.refreshToken);
    await saveCredentials(newTokens);
    return newTokens.accessToken;
  }

  return creds.accessToken;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const response = await fetch(`${CLERK_OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed. Please run `polychromos login` again.');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
}
```

### 2.4 ConvexHttpClient with Auth

```typescript
// packages/polychromos/src/commands/dev.ts
import { ConvexHttpClient } from 'convex/browser';
import { getValidToken } from '../lib/auth.js';
import { loadConfig } from '../lib/credentials.js';

export async function devCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config?.convexUrl) {
    console.error('Not initialized. Run `polychromos init` first.');
    process.exit(1);
  }

  const token = await getValidToken();
  const client = new ConvexHttpClient(config.convexUrl as string);
  client.setAuth(token);

  // Refresh token periodically for long-running sessions
  const refreshInterval = setInterval(async () => {
    try {
      const newToken = await getValidToken();
      client.setAuth(newToken);
    } catch (err) {
      console.error('Failed to refresh token:', err);
    }
  }, 45 * 60 * 1000); // Every 45 minutes

  // ... rest of dev command

  process.on('SIGINT', () => {
    clearInterval(refreshInterval);
    process.exit(0);
  });
}
```

---

## 3. Convex Auth Patterns

### 3.1 Wrapper-as-Middleware Pattern

**Source**: [Authentication: Wrappers as Middleware](https://stack.convex.dev/wrappers-as-middleware-authentication)

```typescript
// apps/polychromos-app/convex/lib/auth.ts
import { QueryCtx, MutationCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return identity;
}

export async function requireWorkspaceAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const identity = await requireAuth(ctx);
  const workspace = await ctx.db.get(workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if (workspace.ownerId !== identity.subject) {
    throw new Error("Access denied");
  }

  return { identity, workspace };
}
```

### 3.2 Custom Function Wrappers (Type-Safe)

**Source**: [convex-helpers](https://github.com/get-convex/convex-helpers)

```typescript
// apps/polychromos-app/convex/lib/functions.ts
import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";

export const authenticatedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return { ctx: { ...ctx, userId: identity.subject }, args };
  },
});

export const authenticatedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return { ctx: { ...ctx, userId: identity.subject }, args };
  },
});

// Usage:
// export const myQuery = authenticatedQuery({
//   args: { ... },
//   handler: async (ctx, args) => {
//     // ctx.userId is available and typed
//   },
// });
```

### 3.3 withIdentity() Testing Pattern in convex-test

**Source**: [convex-test Documentation](https://docs.convex.dev/testing/convex-test)

```typescript
// apps/polychromos-app/convex/__tests__/workspaces.auth.test.ts
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("Authenticated workspace operations", () => {
  test("users can only see their own workspaces", async () => {
    const t = convexTest(schema, modules);

    // Create authenticated contexts for different users
    const asSarah = t.withIdentity({
      name: "Sarah",
      email: "sarah@example.com",
      subject: "user_sarah_123",
      issuer: "https://clerk.example.com",
    });

    const asLee = t.withIdentity({
      name: "Lee",
      email: "lee@example.com",
      subject: "user_lee_456",
      issuer: "https://clerk.example.com",
    });

    // Sarah creates a workspace
    await asSarah.mutation(api.workspaces.create, {
      name: "Sarah's Design",
      data: { id: "ws_1", version: "1.0", name: "Sarah's", components: {} },
    });

    // Lee creates a workspace
    await asLee.mutation(api.workspaces.create, {
      name: "Lee's Design",
      data: { id: "ws_2", version: "1.0", name: "Lee's", components: {} },
    });

    // Each user only sees their own workspace
    const sarahWorkspaces = await asSarah.query(api.workspaces.list);
    expect(sarahWorkspaces).toHaveLength(1);
    expect(sarahWorkspaces[0].name).toBe("Sarah's Design");

    const leeWorkspaces = await asLee.query(api.workspaces.list);
    expect(leeWorkspaces).toHaveLength(1);
    expect(leeWorkspaces[0].name).toBe("Lee's Design");
  });

  test("unauthenticated users cannot create workspaces", async () => {
    const t = convexTest(schema, modules);

    // No withIdentity() = unauthenticated
    await expect(
      t.mutation(api.workspaces.create, {
        name: "Should Fail",
        data: { id: "ws_x", version: "1.0", name: "Test", components: {} },
      })
    ).rejects.toThrow("Unauthenticated");
  });

  test("user cannot access another user's workspace", async () => {
    const t = convexTest(schema, modules);

    const asSarah = t.withIdentity({ subject: "user_sarah" });
    const asLee = t.withIdentity({ subject: "user_lee" });

    const workspaceId = await asSarah.mutation(api.workspaces.create, {
      name: "Sarah's Private Design",
      data: { id: "ws_private", version: "1.0", name: "Private", components: {} },
    });

    // Lee tries to access Sarah's workspace
    await expect(
      asLee.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_private", version: "1.0", name: "Hacked", components: {} },
        expectedVersion: 1,
      })
    ).rejects.toThrow("Access denied");
  });
});
```

---

## 4. Schema with Authentication

Since this is a greenfield implementation (not in production), add `ownerId` as required from the start.

```typescript
// apps/polychromos-app/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    data: v.any(),
    baseData: v.any(),
    eventVersion: v.number(),
    maxEventVersion: v.number(),
    version: v.number(),
    ownerId: v.string(),  // Required: Clerk user subject
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(),  // Required: Who made this change
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      }),
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_version", ["workspaceId", "version"]),

  // Users table for storing Clerk user data (via webhook sync)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),
});
```

---

## 5. E2E Testing with @clerk/testing

### 5.1 Installation and Setup

```bash
pnpm add @clerk/testing -D
```

**Required Environment Variables**:
```bash
# .env.test
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
E2E_CLERK_USER_USERNAME=test-user
E2E_CLERK_USER_PASSWORD=test-password
```

### 5.2 Playwright Configuration

```typescript
// apps/polychromos-app/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/browser',
  globalSetup: require.resolve('./e2e/global.setup.ts'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.clerk/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 5.3 Global Setup for Auth State Caching

```typescript
// apps/polychromos-app/e2e/global.setup.ts
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.clerk/user.json');

setup('global setup', async ({}) => {
  await clerkSetup();
});

setup('authenticate', async ({ page }) => {
  await page.goto('/');

  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });

  // Verify authentication
  await page.waitForSelector('[data-testid="authenticated"]');

  // Save auth state for reuse
  await page.context().storageState({ path: authFile });
});
```

### 5.4 E2E Test Example

```typescript
// apps/polychromos-app/e2e/browser/workspace-flow.spec.ts
import { test, expect } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

test.use({ storageState: 'playwright/.clerk/user.json' });

test.describe('Authenticated Workspace Flow', () => {
  test('can create and edit workspace', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/');

    // Create workspace
    await page.getByRole('button', { name: 'Create New Design' }).click();
    await page.waitForURL(/workspace=/);

    const workspaceId = new URL(page.url()).searchParams.get('workspace');
    expect(workspaceId).toBeTruthy();

    // Verify workspace is associated with user
    await page.goto('/');
    await expect(page.getByText('My Workspaces')).toBeVisible();
    await expect(page.locator(`[data-workspace-id="${workspaceId}"]`)).toBeVisible();
  });

  test('cannot access another user workspace', async ({ page, context }) => {
    await setupClerkTestingToken({ page });

    // Try to access a workspace that doesn't belong to this user
    const response = await page.goto('/workspace?id=other_user_workspace_id');

    // Should redirect or show error
    await expect(page.getByText('Access denied')).toBeVisible();
  });
});
```

### 5.5 CI/CD Configuration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      E2E_CLERK_USER_USERNAME: ${{ secrets.E2E_CLERK_USER_USERNAME }}
      E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 6. Performance Considerations

### 6.1 JWT Verification Latency

**Source**: [How We Horizontally Scaled Functions](https://stack.convex.dev/horizontally-scaling-functions)

- **V8 Isolate Startup**: ~10ms (vs 500ms-10s for AWS Lambda)
- **Median Query Execution**: <20ms
- **Cache Hits**: <1ms
- **JWT Verification**: Adds minimal overhead (<5ms typical)

### 6.2 Optimization: Data URI for JWKS

**Source**: [Custom JWT Provider](https://docs.convex.dev/auth/advanced/custom-jwt)

Embed JWKS directly to avoid external network call:

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
      // Embed JWKS as data URI for zero network latency
      jwks: "data:text/plain;charset=utf-8;base64,ey...",
    },
  ],
} satisfies AuthConfig;
```

### 6.3 Cold Start Mitigation

- Convex uses V8 isolates, not containers - cold starts are minimal
- First authenticated request per session may see ~10ms additional latency
- Subsequent requests benefit from warmed isolate

---

## Code References

### Current Implementation (No Auth)
- `apps/polychromos-app/convex/schema.ts:1-32` - Current schema without auth
- `apps/polychromos-app/convex/workspaces.ts:1-184` - Mutations without auth checks
- `apps/polychromos-app/src/router.tsx:1-55` - Router without Clerk provider
- `packages/polychromos/src/commands/dev.ts:1-146` - CLI without authentication
- `packages/polychromos/src/index.ts:1-48` - CLI entry point (no login/logout commands)

### Testing Infrastructure
- `apps/polychromos-app/convex/__tests__/workspaces.test.ts` - Existing convex-test patterns
- `apps/polychromos-app/test/ConvexTestingHelper.ts` - Custom testing helper
- `apps/polychromos-app/vitest.config.ts` - Vitest configuration

### Environment Configuration
- `turbo.json:64-66` - Clerk env vars already configured in build pipeline

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-02-polychromos-auth-testing-strategy.md` - Previous auth testing research (testing strategies)
- `thoughts/shared/plans/2026-02-02-polychromos-mvp-implementation.md` - V1 excludes auth
- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - Raises CLI auth question
- `thoughts/shared/research/2026-02-02-polychromos-testing-3-integration-tests.md` - Current integration test patterns
- `thoughts/shared/research/2026-02-02-polychromos-testing-4-e2e-tests.md` - Current E2E test patterns

---

## Related Research

- [Convex & Clerk Integration](https://docs.convex.dev/auth/clerk)
- [Clerk Convex Integration Guide](https://clerk.com/docs/guides/development/integrations/databases/convex)
- [Auth in Convex Functions](https://docs.convex.dev/auth/functions-auth)
- [convex-test Documentation](https://docs.convex.dev/testing/convex-test)
- [Testing with Playwright - Clerk](https://clerk.com/docs/guides/development/testing/playwright/overview)
- [Authentication Best Practices](https://stack.convex.dev/authentication-best-practices-convex-clerk-and-nextjs)
- [Intro to Migrations](https://stack.convex.dev/intro-to-migrations)
- [Convex Migrations Component](https://www.convex.dev/components/migrations)
- [GitHub CLI Token Storage](https://github.com/cli/cli/discussions/7109)
- [OAuth in Node.js CLI Apps](https://thecodebarbarian.com/oauth-in-nodejs-cli-apps.html)

---

## Open Questions

1. **Clerk OAuth Application**: Need to create OAuth application in Clerk dashboard for CLI browser redirect flow
2. **Token Refresh Strategy**: Should CLI refresh proactively or on-demand when token expires?
3. **Multi-device Sessions**: How to handle user logged into CLI on multiple machines?
4. **Workspace Sharing (V3)**: When collaboration is added, how will workspace ACLs work?
5. **Offline Support**: Should CLI cache credentials and workspace data for offline scenarios?
6. **Headless CI/CD**: Need fallback token strategy (env var) for CI environments without keychain

---

## Implementation Checklist

### Phase 1: Infrastructure Setup
- [ ] Create Clerk application and configure JWT template (must be named "convex")
- [ ] Add `auth.config.ts` to Convex
- [ ] Install dependencies: `@clerk/clerk-react`, `convex/react-clerk`, `keytar`, `@folder/xdg`
- [ ] Update schema with required `ownerId` and `userId` fields
- [ ] Create users table and webhooks for Clerk user sync

### Phase 2: Web App Integration
- [ ] Wrap router with ClerkProvider and ConvexProviderWithClerk
- [ ] Add sign-in/sign-out UI components
- [ ] Update mutations to check auth and set ownerId
- [ ] Update queries to filter by ownerId

### Phase 3: CLI Integration
- [ ] Implement `polychromos login` command with browser redirect
- [ ] Implement `polychromos logout` command
- [ ] Implement `polychromos whoami` command
- [ ] Add token storage with keytar
- [ ] Update `polychromos dev` to require auth and set token on ConvexHttpClient

### Phase 4: Testing
- [ ] Update convex-test tests with `withIdentity()` patterns
- [ ] Add E2E tests with `@clerk/testing`
- [ ] Configure CI/CD with Clerk test credentials
- [ ] Test CLI auth flow manually
