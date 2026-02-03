---
date: 2026-02-02
author: Claude
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Clerk + Convex Authentication Integration Implementation"
tags: [plan, polychromos, clerk, convex, authentication, cli]
status: draft
priority: 1
dependencies: []
last_updated: 2026-02-02
---

# Clerk + Convex Authentication Integration Implementation Plan

## Overview

Implement Clerk + Convex authentication for the Polychromos code-driven design platform. This adds user authentication to the web app, CLI, and backend, enabling multi-user support with workspace ownership and access control.

## Current State Analysis

### Web App (`apps/polychromos-app/`)
- **Router** (`src/router.tsx:38-42`): Only `ConvexProvider` wrapping children, no Clerk integration
- **No auth UI**: No sign-in/sign-out components
- **No protected routes**: All routes accessible without authentication

### Backend (`apps/polychromos-app/convex/`)
- **Schema** (`schema.ts:5-31`): No `ownerId` or `userId` fields on any table
- **Mutations** (`workspaces.ts`): No auth checks - anyone can create, update, undo, redo
- **Queries** (`workspaces.ts:15-20`): `list` returns ALL workspaces, no filtering
- **No auth.config.ts**: JWT verification not configured

### CLI (`packages/polychromos/`)
- **No auth commands**: Missing `login`, `logout`, `whoami` commands (`src/index.ts`)
- **Config** (`src/lib/config.ts:4-7`): Only stores `convexUrl` and `workspaceId`
- **Dev command** (`src/commands/dev.ts:27`): Creates unauthenticated `ConvexHttpClient`

### Testing
- **Convex tests** (`convex/__tests__/workspaces.test.ts`): All tests run without `withIdentity()`
- **No E2E auth tests**: No `@clerk/testing` setup

### Environment
- **turbo.json** (lines 64-66): Clerk env vars declared but not configured in polychromos-app
- **No .env.local Clerk vars**: Only Convex URL configured

## Desired End State

After implementation:

1. **Web App**: Users must sign in to access workspaces. Each user only sees their own workspaces.
2. **Backend**: All mutations require authentication. Workspaces have `ownerId` field. Queries filter by owner.
3. **CLI**: Users authenticate via `polychromos login` (browser OAuth). Token stored securely. All commands require auth.
4. **Tests**: All convex-test tests use `withIdentity()`. E2E tests authenticate with `@clerk/testing`.

### Verification

- Unauthenticated users see sign-in prompt, cannot access workspaces
- Creating a workspace sets `ownerId` to current user's Clerk subject
- User A cannot see or modify User B's workspaces
- CLI `dev` command requires login, syncs with auth token
- All existing tests pass with `withIdentity()` added

## What We're NOT Doing

- **Workspace sharing/collaboration** (V3 feature)
- **User profile management** (beyond basic Clerk UI)
- **Webhook-synced users table** (can add later if needed)
- **Custom sign-in pages** (using Clerk's `<SignInButton>` modal)
- **Role-based access control** (all owners have full access to their workspaces)
- **Offline CLI support** (requires auth for all operations)

## Implementation Approach

Use the official Clerk + Convex integration pattern:
1. `ClerkProvider` wraps `ConvexProviderWithClerk` which wraps the app
2. `ConvexProviderWithClerk` automatically passes Clerk JWT to Convex
3. Backend validates JWT via `auth.config.ts` and `ctx.auth.getUserIdentity()`
4. CLI uses browser OAuth redirect to get Clerk session, then extracts JWT for Convex

---

## Phase 1: Infrastructure Setup

### Overview
Configure Clerk application, add JWT verification to Convex, update schema with ownership fields, and set up environment variables.

### Changes Required

#### 1. Clerk Dashboard Configuration (Manual)

**Action**: Create Clerk application and JWT template

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create new application or use existing
3. Navigate to **JWT Templates** → **New Template** → Select **"Convex"**
4. **CRITICAL**: Do NOT rename the template - it MUST be called "convex"
5. Copy the **Issuer URL** (e.g., `https://verb-noun-00.clerk.accounts.dev`)
6. Copy the **Publishable Key** from API Keys page

#### 2. Convex Auth Configuration
**File**: `apps/polychromos-app/convex/auth.config.ts` (NEW)

```typescript
import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

#### 3. Schema Updates
**File**: `apps/polychromos-app/convex/schema.ts`

```typescript
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
    ownerId: v.string(), // NEW: Clerk user subject
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"]), // NEW: Index for filtering

  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(), // NEW: Who made this change
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
});
```

#### 4. Environment Variables
**File**: `apps/polychromos-app/.env.local`

Add these lines (values from Clerk Dashboard):

```bash
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
```

#### 5. Install Dependencies
**File**: `apps/polychromos-app/package.json`

```bash
cd apps/polychromos-app
pnpm add @clerk/clerk-react convex
```

Note: `convex` should already be installed. The `@clerk/clerk-react` package provides `ClerkProvider`, `useAuth`, `SignInButton`, etc.

### Success Criteria

#### Automated Verification:
- [x] `auth.config.ts` file exists: `test -f apps/polychromos-app/convex/auth.config.ts`
- [x] Schema has `ownerId` field: `grep -q "ownerId: v.string()" apps/polychromos-app/convex/schema.ts`
- [x] Schema has `by_owner` index: `grep -q 'index("by_owner"' apps/polychromos-app/convex/schema.ts`
- [x] Events table has `userId` field: `grep -q "userId: v.string()" apps/polychromos-app/convex/schema.ts`
- [x] Dependencies installed: `grep -q "@clerk/clerk-react" apps/polychromos-app/package.json`
- [ ] TypeScript compiles: `pnpm --filter polychromos-app typecheck` (pre-existing test type errors unrelated to auth)
- [ ] Convex deploys: `cd apps/polychromos-app && npx convex dev --once` (requires Clerk env vars)

#### Manual Verification:
- [ ] Clerk JWT template named "convex" exists in Clerk Dashboard
- [ ] Environment variables set in `.env.local`

**Implementation Note**: After completing this phase, pause for manual confirmation that Clerk is configured correctly before proceeding.

---

## Phase 2: Web App Integration

### Overview
Wrap the app with Clerk and Convex auth providers, add sign-in/sign-out UI, and use Convex auth components for conditional rendering.

### Changes Required

#### 1. Router Provider Setup
**File**: `apps/polychromos-app/src/router.tsx`

Replace the entire file:

```typescript
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CLERK_PUBLISHABLE_KEY = (import.meta as any).env
    .VITE_CLERK_PUBLISHABLE_KEY as string;

  if (!CONVEX_URL) {
    console.error("missing envar VITE_CONVEX_URL");
  }
  if (!CLERK_PUBLISHABLE_KEY) {
    console.error("missing envar VITE_CLERK_PUBLISHABLE_KEY");
  }

  const convex = new ConvexReactClient(CONVEX_URL);

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
      defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
      defaultNotFoundComponent: () => <p>not found</p>,
      Wrap: ({ children }) => (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
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

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

#### 2. Home Page with Auth UI
**File**: `apps/polychromos-app/src/routes/index.tsx`

Add auth imports and wrap content with auth conditionals. Key changes:

```typescript
// Add these imports at the top
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

// In the component, wrap the main content:
export default function Home() {
  // ... existing hooks ...

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-2xl font-bold">Welcome to Polychromos</h1>
          <p className="text-gray-600">Sign in to access your designs</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Sign In
            </button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Polychromos</h1>
          <UserButton afterSignOutUrl="/" />
        </div>
        {/* Existing workspace content here */}
      </Authenticated>
    </div>
  );
}
```

#### 3. Auth Helper for Backend Calls
**File**: `apps/polychromos-app/convex/lib/auth.ts` (NEW)

```typescript
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter polychromos-app typecheck` (pre-existing test type errors unrelated to auth)
- [x] Lint passes: `pnpm --filter polychromos-app lint`
- [ ] Build succeeds: `pnpm --filter polychromos-app build` (requires Clerk env vars)
- [x] Auth helper exists: `test -f apps/polychromos-app/convex/lib/auth.ts`

#### Manual Verification:
- [ ] App loads without errors at `http://localhost:3001`
- [ ] Unauthenticated users see sign-in prompt
- [ ] Clicking "Sign In" opens Clerk modal
- [ ] After sign-in, user sees workspace content
- [ ] `UserButton` shows user avatar and allows sign-out
- [ ] After sign-out, redirects to sign-in state

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation of the auth UI flow before proceeding.

---

## Phase 3: Backend Authorization

### Overview
Update all Convex mutations and queries to require authentication, check workspace ownership, and filter by owner.

### Changes Required

#### 1. Workspaces Module
**File**: `apps/polychromos-app/convex/workspaces.ts`

Replace with authenticated version:

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Operation } from "rfc6902";
import { v } from "convex/values";
import { createPatch, applyPatch } from "rfc6902";

import { mutation, query } from "./_generated/server";
import { requireAuth, requireWorkspaceAccess } from "./lib/auth";

export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Return null for unauthenticated, don't throw
    }

    const workspace = await ctx.db.get(args.id);
    if (!workspace || workspace.ownerId !== identity.subject) {
      return null; // Don't reveal existence of other users' workspaces
    }

    return workspace;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return []; // Return empty for unauthenticated
    }

    return await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      data: args.data,
      baseData: args.data,
      eventVersion: 0,
      maxEventVersion: 0,
      version: 1,
      ownerId: identity.subject, // Set owner
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("workspaces"),
    data: v.any(),
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity, workspace: existing } = await requireWorkspaceAccess(
      ctx,
      args.id
    );

    if (existing.version !== args.expectedVersion) {
      throw new Error("Version conflict");
    }

    const patches = createPatch(existing.data, args.data);

    if (patches.length === 0) {
      return { success: true, noChanges: true };
    }

    if (existing.eventVersion < existing.maxEventVersion) {
      const futureEvents = await ctx.db
        .query("events")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
        .filter((q) => q.gt(q.field("version"), existing.eventVersion))
        .collect();

      for (const event of futureEvents) {
        await ctx.db.delete(event._id);
      }
    }

    const newEventVersion = existing.eventVersion + 1;

    await ctx.db.insert("events", {
      workspaceId: args.id,
      version: newEventVersion,
      timestamp: Date.now(),
      userId: identity.subject, // Track who made change
      patches,
    });

    await ctx.db.patch(args.id, {
      data: args.data,
      eventVersion: newEventVersion,
      maxEventVersion: newEventVersion,
      version: existing.version + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const undo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion <= 0) {
      return { success: false, message: "Nothing to undo" };
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .filter((q) => q.lte(q.field("version"), workspace.eventVersion - 1))
      .order("asc")
      .collect();

    const state = structuredClone(workspace.baseData);
    for (const event of events) {
      applyPatch(state, event.patches as Operation[]);
    }

    const newEventVersion = workspace.eventVersion - 1;

    await ctx.db.patch(args.id, {
      data: state,
      eventVersion: newEventVersion,
      version: workspace.version + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state,
      previousVersion: workspace.eventVersion,
      currentVersion: newEventVersion,
    };
  },
});

export const redo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion >= workspace.maxEventVersion) {
      return { success: false, message: "Nothing to redo" };
    }

    const nextEvent = await ctx.db
      .query("events")
      .withIndex("by_workspace_version", (q) =>
        q.eq("workspaceId", args.id).eq("version", workspace.eventVersion + 1)
      )
      .first();

    if (!nextEvent) {
      return { success: false, message: "Event not found" };
    }

    const state = structuredClone(workspace.data);
    applyPatch(state, nextEvent.patches as Operation[]);

    const newEventVersion = workspace.eventVersion + 1;

    await ctx.db.patch(args.id, {
      data: state,
      eventVersion: newEventVersion,
      version: workspace.version + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state,
      previousVersion: workspace.eventVersion,
      currentVersion: newEventVersion,
    };
  },
});
```

#### 2. Events Module
**File**: `apps/polychromos-app/convex/events.ts`

Update to check ownership:

```typescript
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAuth, requireWorkspaceAccess } from "./lib/auth";

export const recordEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { identity, workspace } = await requireWorkspaceAccess(
      ctx,
      args.workspaceId
    );

    const version = workspace.eventVersion + 1;

    await ctx.db.insert("events", {
      workspaceId: args.workspaceId,
      version,
      timestamp: Date.now(),
      userId: identity.subject,
      patches: args.patches,
    });

    return { version };
  },
});

export const getHistory = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify ownership before returning history
    await requireWorkspaceAccess(ctx, args.workspaceId);

    return await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .collect();
  },
});
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm --filter polychromos-app typecheck` (pre-existing test type errors unrelated to auth)
- [x] Lint passes: `pnpm --filter polychromos-app lint`
- [ ] Convex deploys: `cd apps/polychromos-app && npx convex dev --once` (requires Clerk env vars)

#### Manual Verification:
- [ ] Creating a workspace as User A sets correct ownerId
- [ ] User A can see their workspaces in list
- [ ] User A cannot access a workspace with different ownerId (would need database seed or second user)
- [ ] Undo/Redo operations work for owned workspaces
- [ ] Unauthenticated API calls return null/empty (not errors)

**Implementation Note**: After completing this phase, pause for manual confirmation that ownership checks work correctly before proceeding.

---

## Phase 4: CLI Integration

### Overview
Add authentication commands to the CLI, implement secure token storage, and update existing commands to require authentication.

### Changes Required

#### 1. Install CLI Dependencies
**File**: `packages/polychromos/package.json`

```bash
cd packages/polychromos
pnpm add keytar open
pnpm add -D @types/keytar
```

Note: `keytar` requires native compilation. If this causes issues in CI, we'll add env var fallback.

#### 2. Credentials Module
**File**: `packages/polychromos/src/lib/credentials.ts` (NEW)

```typescript
import keytar from "keytar";

const SERVICE_NAME = "polychromos-cli";
const ACCOUNT_NAME = "default";

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function saveCredentials(tokens: TokenData): Promise<void> {
  // Try keytar first, fall back to env var warning
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, JSON.stringify(tokens));
  } catch (error) {
    console.warn("Could not save to system keychain. Token will not persist.");
    throw error;
  }
}

export async function loadCredentials(): Promise<TokenData | null> {
  // Check environment variable first (for CI/headless)
  const envToken = process.env.POLYCHROMOS_TOKEN;
  if (envToken) {
    return { accessToken: envToken };
  }

  try {
    const data = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    if (!data) return null;
    return JSON.parse(data) as TokenData;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  } catch {
    // Ignore errors when clearing
  }
}

export async function getValidToken(): Promise<string> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run `polychromos login` first.");
  }

  // Check expiry if available
  if (creds.expiresAt && Date.now() > creds.expiresAt - 5 * 60 * 1000) {
    throw new Error("Token expired. Run `polychromos login` to refresh.");
  }

  return creds.accessToken;
}
```

#### 3. Login Command
**File**: `packages/polychromos/src/commands/login.ts` (NEW)

```typescript
import http from "http";
import { URL } from "url";
import open from "open";
import { saveCredentials } from "../lib/credentials.js";
import { loadConfig } from "../lib/config.js";

const CALLBACK_PORT = 9876;

export async function loginCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("No configuration found. Run `polychromos init <name>` first.");
    process.exit(1);
  }

  // For now, we'll use a simplified flow that opens Clerk sign-in
  // and captures the session token. In production, this would use
  // a proper OAuth flow with a dedicated CLI OAuth app.

  console.log("Opening browser for authentication...");
  console.log("");
  console.log("After signing in, copy your session token from the browser");
  console.log("and paste it here when prompted.");
  console.log("");

  // Open the app's auth page
  const authUrl = config.convexUrl.replace("convex.cloud", "convex.site") + "/auth";

  // For MVP, we'll prompt for manual token entry
  // A full implementation would start a local server and use OAuth redirect

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your Clerk session token: ", async (token) => {
      rl.close();

      if (!token.trim()) {
        console.error("No token provided. Login cancelled.");
        process.exit(1);
      }

      try {
        await saveCredentials({ accessToken: token.trim() });
        console.log("");
        console.log("✓ Login successful!");
        console.log("You can now use polychromos commands.");
        resolve();
      } catch (error) {
        console.error("Failed to save credentials:", error);
        process.exit(1);
      }
    });
  });
}
```

#### 4. Logout Command
**File**: `packages/polychromos/src/commands/logout.ts` (NEW)

```typescript
import { clearCredentials, loadCredentials } from "../lib/credentials.js";

export async function logoutCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not currently logged in.");
    return;
  }

  await clearCredentials();
  console.log("✓ Logged out successfully.");
}
```

#### 5. Whoami Command
**File**: `packages/polychromos/src/commands/whoami.ts` (NEW)

```typescript
import { ConvexHttpClient } from "convex/browser";
import { loadCredentials } from "../lib/credentials.js";
import { loadConfig } from "../lib/config.js";

export async function whoamiCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not logged in. Run `polychromos login` to authenticate.");
    return;
  }

  const config = await loadConfig();
  if (!config) {
    console.log("Logged in, but no project configured.");
    console.log("Run `polychromos init <name>` to set up a project.");
    return;
  }

  // Verify token by making an authenticated request
  try {
    const client = new ConvexHttpClient(config.convexUrl);
    client.setAuth(creds.accessToken);

    // Try to list workspaces - if it works, we're authenticated
    const workspaces = await client.query("workspaces:list" as never, {} as never);

    console.log("✓ Authenticated");
    console.log(`  Workspaces: ${(workspaces as unknown[]).length}`);
    console.log(`  Convex URL: ${config.convexUrl}`);
  } catch (error) {
    console.error("Token invalid or expired. Run `polychromos login` to re-authenticate.");
  }
}
```

#### 6. Update CLI Entry Point
**File**: `packages/polychromos/src/index.ts`

Add the new commands:

```typescript
#!/usr/bin/env node
import { Command } from "commander";

import { checkpointCommand } from "./commands/checkpoint.js";
import { devCommand } from "./commands/dev.js";
import { exportCommand } from "./commands/export.js";
import { historyCommand } from "./commands/history.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { redoCommand } from "./commands/redo.js";
import { undoCommand } from "./commands/undo.js";
import { whoamiCommand } from "./commands/whoami.js";

const program = new Command();

program
  .name("polychromos")
  .description("Code-driven design platform CLI")
  .version("1.0.0");

// Auth commands
program
  .command("login")
  .description("Authenticate with Polychromos")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out of Polychromos")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Show current authentication status")
  .action(whoamiCommand);

// Existing commands
program
  .command("init <name>")
  .description("Initialize a new design file")
  .action(initCommand);

program
  .command("dev")
  .description("Watch and sync design file to Convex")
  .action(devCommand);

program.command("undo").description("Undo last change").action(undoCommand);

program.command("redo").description("Redo undone change").action(redoCommand);

program
  .command("history")
  .description("Show version history")
  .action(historyCommand);

program
  .command("checkpoint <name>")
  .description("Create a named checkpoint")
  .action(checkpointCommand);

program
  .command("export <format>")
  .description("Export design (html, tailwind)")
  .action(exportCommand);

program.parse();
```

#### 7. Update Dev Command with Auth
**File**: `packages/polychromos/src/commands/dev.ts`

Update to require authentication:

```typescript
import { readFile } from "fs/promises";
import chokidar from "chokidar";
import { ConvexHttpClient } from "convex/browser";

import { loadConfig } from "../lib/config.js";
import { getValidToken } from "../lib/credentials.js";

let pendingMutation: Promise<void> | null = null;
let pendingData: unknown = null;

export async function devCommand(): Promise<void> {
  const config = await loadConfig();

  console.log("Polychromos CLI v1.0.0");
  if (!config) {
    console.log("No Convex configuration found.");
    console.log('Run "polychromos init <name>" first to set up syncing.');
    process.exit(1);
  }

  // Require authentication
  let token: string;
  try {
    token = await getValidToken();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Authentication required");
    process.exit(1);
  }

  console.log(`Convex URL: ${config.convexUrl}`);
  console.log(`Workspace ID: ${config.workspaceId}`);
  console.log("✓ Authenticated");
  console.log("");

  // Create authenticated Convex client
  const convexClient = new ConvexHttpClient(config.convexUrl);
  convexClient.setAuth(token);

  let currentVersion = 1;
  let eventVersion = 0;

  // Fetch current workspace state
  try {
    const workspace = (await convexClient.query("workspaces:get" as never, {
      id: config.workspaceId,
    } as never)) as { version: number; eventVersion: number } | null;
    if (workspace) {
      currentVersion = workspace.version;
      eventVersion = workspace.eventVersion;
    } else {
      console.warn("⚠ Workspace not found or access denied");
    }
  } catch (error) {
    console.warn(
      "⚠ Could not fetch workspace state:",
      error instanceof Error ? error.message : error
    );
  }

  // Refresh token periodically for long sessions
  const tokenRefreshInterval = setInterval(async () => {
    try {
      const newToken = await getValidToken();
      convexClient.setAuth(newToken);
    } catch {
      console.warn("⚠ Token refresh failed. You may need to re-login.");
    }
  }, 45 * 60 * 1000); // Every 45 minutes

  const syncWithSingleFlight = async (data: unknown): Promise<void> => {
    pendingData = data;
    if (pendingMutation) return;

    while (pendingData) {
      const toSync = pendingData;
      pendingData = null;

      try {
        pendingMutation = (async () => {
          const time = new Date().toLocaleTimeString();
          console.log(`[${time}] Syncing design...`);

          try {
            const result = (await convexClient.mutation(
              "workspaces:update" as never,
              {
                id: config.workspaceId,
                data: toSync,
                expectedVersion: currentVersion,
              } as never
            )) as { success: boolean; noChanges?: boolean };

            if (result.noChanges) {
              console.log(`✓ No changes detected`);
            } else {
              currentVersion++;
              eventVersion++;
              console.log(`✓ Synced to Convex (event v${eventVersion})`);
            }
          } catch (convexError) {
            if (
              convexError instanceof Error &&
              convexError.message.includes("Version conflict")
            ) {
              console.error(
                "✗ Conflict detected - please reload to get latest version"
              );
            } else if (
              convexError instanceof Error &&
              convexError.message.includes("Unauthenticated")
            ) {
              console.error("✗ Authentication expired. Run `polychromos login`");
            } else if (
              convexError instanceof Error &&
              convexError.message.includes("Access denied")
            ) {
              console.error("✗ Access denied to this workspace");
            } else {
              console.error(
                "✗ Sync failed:",
                convexError instanceof Error ? convexError.message : convexError
              );
            }
          }
        })();

        await pendingMutation;
      } catch (error) {
        console.error("✗ Sync failed:", error);
      } finally {
        pendingMutation = null;
      }
    }
  };

  const watcher = chokidar.watch("design.json", {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  const handleChange = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const content = await readFile("design.json", "utf-8");
          const data: unknown = JSON.parse(content);
          await syncWithSingleFlight(data);
        } catch (error) {
          console.error("✗ Error reading file:", error);
        }
      })();
    }, 300);
  };

  watcher.on("change", handleChange);

  watcher.on("error", (error) => {
    console.error("Watcher error:", error);
  });

  console.log("Watching design.json for changes...");
  console.log("Press Ctrl+C to stop");
  console.log("");

  process.on("SIGINT", () => {
    clearInterval(tokenRefreshInterval);
    process.exit(0);
  });
}
```

### Success Criteria

#### Automated Verification:
- [x] CLI builds: `pnpm --filter @polychromos/cli build`
- [x] Lint passes: `pnpm --filter @polychromos/cli lint`
- [x] New commands exist: login, logout, whoami commands visible in --help

#### Manual Verification:
- [ ] `polychromos login` prompts for token
- [ ] `polychromos whoami` shows auth status
- [ ] `polychromos logout` clears credentials
- [ ] `polychromos dev` requires authentication
- [ ] `polychromos dev` syncs with authenticated token

**Implementation Note**: After completing this phase, pause for manual testing of the CLI auth flow before proceeding.

---

## Phase 5: Testing Updates

### Overview
Update all convex-test tests to use `withIdentity()` patterns and add tests for authentication/authorization behavior.

### Changes Required

#### 1. Update Workspace Tests
**File**: `apps/polychromos-app/convex/__tests__/workspaces.test.ts`

Update to use `withIdentity()`:

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

interface WorkspaceData {
  name: string;
  [key: string]: unknown;
}

// Default test user identity
const testUser = {
  name: "Test User",
  email: "test@example.com",
  subject: "user_test_123",
  issuer: "https://clerk.test.com",
};

// Second test user for isolation tests
const otherUser = {
  name: "Other User",
  email: "other@example.com",
  subject: "user_other_456",
  issuer: "https://clerk.test.com",
};

describe("workspaces mutations", () => {
  describe("create", () => {
    it("creates a workspace with ownerId from identity", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test Workspace",
        data: {
          id: "ws_123",
          version: "1.0",
          name: "Test",
          components: {},
        },
      });

      expect(workspaceId).toBeDefined();

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      expect(workspace?.name).toBe("Test Workspace");
      expect(workspace?.ownerId).toBe(testUser.subject);
      expect(workspace?.version).toBe(1);
    });

    it("rejects unauthenticated create", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(api.workspaces.create, {
          name: "Test",
          data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
        })
      ).rejects.toThrow("Unauthenticated");
    });

    it("initializes eventVersion and maxEventVersion to 0", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.eventVersion).toBe(0);
      expect(workspace?.maxEventVersion).toBe(0);
    });

    it("stores baseData equal to initial data", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const initialData = {
        id: "ws_1",
        version: "1.0",
        name: "Test",
        components: {},
      };

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: initialData,
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.baseData).toEqual(initialData);
    });
  });

  describe("list", () => {
    it("returns only workspaces owned by current user", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      // User creates a workspace
      await asUser.mutation(api.workspaces.create, {
        name: "User Workspace",
        data: { id: "ws_1", version: "1.0", name: "User", components: {} },
      });

      // Other user creates a workspace
      await asOther.mutation(api.workspaces.create, {
        name: "Other Workspace",
        data: { id: "ws_2", version: "1.0", name: "Other", components: {} },
      });

      // User only sees their own workspace
      const userWorkspaces = await asUser.query(api.workspaces.list, {});
      expect(userWorkspaces).toHaveLength(1);
      expect(userWorkspaces[0]?.name).toBe("User Workspace");

      // Other user only sees their own workspace
      const otherWorkspaces = await asOther.query(api.workspaces.list, {});
      expect(otherWorkspaces).toHaveLength(1);
      expect(otherWorkspaces[0]?.name).toBe("Other Workspace");
    });

    it("returns empty array for unauthenticated users", async () => {
      const t = convexTest(schema, modules);

      const workspaces = await t.query(api.workspaces.list, {});

      expect(workspaces).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns workspace by id for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.name).toBe("Test");
    });

    it("returns null for other user's workspace", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "User's Private Workspace",
        data: { id: "ws_1", version: "1.0", name: "Private", components: {} },
      });

      // Other user tries to get it
      const workspace = await asOther.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace).toBeNull();
    });

    it("returns null for unauthenticated users", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      // Unauthenticated query
      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace).toBeNull();
    });
  });

  describe("update", () => {
    it("updates workspace for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
        expectedVersion: 1,
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      const data = workspace?.data as WorkspaceData;
      expect(data.name).toBe("Updated");
      expect(workspace?.version).toBe(2);
    });

    it("rejects update from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await expect(
        asOther.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: "ws_1", version: "1.0", name: "Hacked", components: {} },
          expectedVersion: 1,
        })
      ).rejects.toThrow("Access denied");
    });

    it("rejects unauthenticated update", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await expect(
        t.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: "ws_1", version: "1.0", name: "Hacked", components: {} },
          expectedVersion: 1,
        })
      ).rejects.toThrow("Unauthenticated");
    });

    it("records event with userId", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      const history = await asUser.query(api.events.getHistory, { workspaceId });
      expect(history).toHaveLength(1);
      expect(history[0]?.userId).toBe(testUser.subject);
    });
  });

  describe("undo", () => {
    it("reverts to previous state for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
        expectedVersion: 1,
      });

      const result = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe("Original");
    });

    it("rejects undo from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await expect(
        asOther.mutation(api.workspaces.undo, { id: workspaceId })
      ).rejects.toThrow("Access denied");
    });
  });

  describe("redo", () => {
    it("reapplies changes after undo for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.undo, { id: workspaceId });

      const result = await asUser.mutation(api.workspaces.redo, {
        id: workspaceId,
      });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe("Updated");
    });

    it("rejects redo from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.undo, { id: workspaceId });

      await expect(
        asOther.mutation(api.workspaces.redo, { id: workspaceId })
      ).rejects.toThrow("Access denied");
    });
  });
});
```

#### 2. Update Events Tests
**File**: `apps/polychromos-app/convex/__tests__/events.test.ts`

Update to use `withIdentity()` (similar pattern to workspaces).

### Success Criteria

#### Automated Verification:
- [x] All Convex tests pass: `pnpm --filter polychromos-app test:convex` (36 tests passing)
- [x] Tests use withIdentity: `grep -c "withIdentity" apps/polychromos-app/convex/__tests__/workspaces.test.ts` returns > 0 (29 usages)

#### Manual Verification:
- [ ] Tests correctly verify user isolation
- [ ] Tests correctly verify access denial for non-owners

**Implementation Note**: After completing this phase, all automated verification should pass. The implementation is complete.

---

## Testing Strategy

### Unit Tests (convex-test)
- All tests use `withIdentity()` with mock user identities
- Test unauthenticated access returns null/empty (not errors for queries)
- Test unauthenticated mutations throw "Unauthenticated"
- Test cross-user access throws "Access denied"
- Test owner can perform all operations on their workspaces

### Integration Tests
- CLI auth flow (login, whoami, logout)
- CLI dev command with auth token
- Web app sign-in/sign-out flow

### Manual Testing Steps
1. Start dev server: `pnpm --filter polychromos-app dev`
2. Open `http://localhost:3001` - should see sign-in prompt
3. Sign in with Clerk - should redirect to workspaces view
4. Create a workspace - verify ownerId in Convex dashboard
5. Open incognito window - sign in as different user
6. Verify second user cannot see first user's workspaces
7. Test CLI: `polychromos login`, `polychromos whoami`, `polychromos dev`

---

## Performance Considerations

- JWT verification adds minimal latency (~5ms) due to Convex V8 isolate architecture
- First authenticated request per session may see ~10ms additional latency
- CLI token refresh every 45 minutes for long sessions
- Consider embedding JWKS as data URI in auth.config.ts for zero network latency (optional optimization)

---

## Migration Notes

Since this is greenfield (no production data):
- Schema changes can be deployed directly
- No data migration needed
- Existing test workspaces will be orphaned (no ownerId) - acceptable for dev

If there were production data:
- Would need migration to set ownerId on existing workspaces
- Would need to handle legacy workspaces gracefully
- See: https://stack.convex.dev/intro-to-migrations

---

## References

- Original research: `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md`
- Convex Clerk docs: https://docs.convex.dev/auth/clerk
- Clerk Convex integration: https://clerk.com/docs/guides/development/integrations/databases/convex
- convex-test withIdentity: https://docs.convex.dev/testing/convex-test
- @clerk/testing: https://clerk.com/docs/guides/development/testing/playwright/overview
