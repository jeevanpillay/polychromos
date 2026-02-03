# Polychromos CLI Browser-Based Authentication Flow

## Overview

Upgrade the Polychromos CLI authentication from manual token copy-paste to an automated browser-based flow using Convex polling. Users will authenticate in their browser, and the CLI will automatically receive the token without manual intervention.

## Current State Analysis

**Current Flow (Manual):**
1. User runs `polychromos login`
2. CLI displays instructions to copy `__session` cookie from browser DevTools
3. User manually pastes token into CLI prompt
4. Token stored in `~/.polychromos/credentials.json`

**Key Files:**
- `packages/polychromos/src/commands/login.ts:1-47` - Current login command
- `packages/polychromos/src/lib/credentials.ts:1-85` - Token storage/retrieval
- `apps/polychromos-app/convex/auth.config.ts:1-10` - Convex auth configuration

**Limitations:**
- Poor UX requiring DevTools navigation
- Error-prone manual copy-paste
- No token expiry tracking from Clerk

## Desired End State

**New Flow (Browser-based polling):**
1. User runs `polychromos login`
2. CLI generates unique session code and creates pending session in Convex
3. CLI opens browser to `https://app.polychromos.io/cli-auth?code=XXX`
4. User authenticates with Clerk in browser
5. Web app stores Convex token in the pending session
6. CLI polls Convex until token is available (with timeout)
7. CLI saves token with expiry to `~/.polychromos/credentials.json`
8. On token expiry, CLI prompts user to re-login

**Verification:**
- [ ] `polychromos login` opens browser and completes auth without manual token copy
- [ ] Token is saved with correct expiry (7 days)
- [ ] `polychromos whoami` works after login
- [ ] Expired tokens trigger clear re-login prompt
- [ ] Timeout works if user doesn't complete auth in browser

## What We're NOT Doing

- Automatic token refresh (requires Clerk backend API complexity)
- System keychain storage (keytar) - keeping simple file storage
- Local HTTP callback server (using polling instead)
- OAuth device flow (not supported by Clerk)

## Implementation Approach

Use Convex as the intermediary for token exchange:
1. CLI creates a pending auth session in Convex with a unique code
2. Web app completes the session by storing the authenticated user's token
3. CLI polls for the token until available or timeout

This approach:
- Works in restricted environments (firewalls, WSL, containers)
- No local server port conflicts
- Simple implementation
- Leverages existing Convex infrastructure

---

## Phase 1: Convex Schema & Functions for CLI Auth Sessions

### Overview
Add Convex infrastructure to store pending CLI auth sessions and facilitate token exchange.

### Changes Required:

#### 1. Update Convex Schema
**File**: `apps/polychromos-app/convex/schema.ts`
**Changes**: Add `cliAuthSessions` table

```typescript
// Add to schema.ts
cliAuthSessions: defineTable({
  code: v.string(),              // Unique session code (e.g., "pol_abc123xyz")
  status: v.string(),            // "pending" | "completed" | "expired"
  token: v.optional(v.string()), // Convex token once auth completes
  expiresAt: v.number(),         // Token expiry timestamp (ms)
  createdAt: v.number(),         // Session creation timestamp
  completedAt: v.optional(v.number()), // When auth completed
  userId: v.optional(v.string()), // Clerk user ID once authenticated
})
  .index("by_code", ["code"])
  .index("by_status_created", ["status", "createdAt"]),
```

#### 2. Create CLI Auth Convex Functions
**File**: `apps/polychromos-app/convex/cliAuth.ts` (new file)
**Changes**: Add mutations and queries for CLI auth flow

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Session expires after 10 minutes if not completed
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Create a pending CLI auth session.
 * Called by CLI when user runs `polychromos login`.
 */
export const createSession = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if code already exists
    const existing = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Session code already exists");
    }

    const now = Date.now();
    return ctx.db.insert("cliAuthSessions", {
      code: args.code,
      status: "pending",
      createdAt: now,
      expiresAt: 0, // Will be set when completed
    });
  },
});

/**
 * Complete a CLI auth session with the user's token.
 * Called by web app after user authenticates.
 */
export const completeSession = mutation({
  args: {
    code: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to complete CLI auth");
    }

    const session = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status !== "pending") {
      throw new Error("Session already completed or expired");
    }

    // Check if session has timed out
    if (Date.now() > session.createdAt + SESSION_TIMEOUT_MS) {
      await ctx.db.patch(session._id, { status: "expired" });
      throw new Error("Session expired");
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      token: args.token,
      expiresAt: args.expiresAt,
      completedAt: Date.now(),
      userId: identity.subject,
    });

    return { success: true };
  },
});

/**
 * Poll for CLI auth session status and token.
 * Called by CLI while waiting for user to authenticate.
 */
export const getSession = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!session) {
      return { status: "not_found" as const };
    }

    // Check if session has timed out
    if (
      session.status === "pending" &&
      Date.now() > session.createdAt + SESSION_TIMEOUT_MS
    ) {
      return { status: "expired" as const };
    }

    if (session.status === "completed" && session.token) {
      return {
        status: "completed" as const,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    }

    return { status: session.status as "pending" | "expired" };
  },
});

/**
 * Clean up old CLI auth sessions.
 * Can be called periodically via cron or manually.
 */
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Find old sessions
    const oldSessions = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_status_created")
      .filter((q) => q.lt(q.field("createdAt"), oneDayAgo))
      .collect();

    // Delete them
    for (const session of oldSessions) {
      await ctx.db.delete(session._id);
    }

    return { deleted: oldSessions.length };
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Schema migration applies: `pnpm --filter @repo/app dev` starts without errors
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Convex dashboard shows `cliAuthSessions` table
- [ ] Can manually test mutations in Convex dashboard

**Implementation Note**: After completing this phase, run `pnpm --filter @repo/app dev` to ensure Convex syncs the new schema, then proceed to Phase 2.

---

## Phase 2: Web App CLI Auth Page

### Overview
Create a dedicated route in the web app for CLI authentication that handles the browser-side of the auth flow.

### Changes Required:

#### 1. Create CLI Auth Route
**File**: `apps/polychromos-app/src/routes/cli-auth.tsx` (new file)
**Changes**: Add route for CLI authentication

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useAuth, SignIn, useClerk } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/cli-auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || "",
  }),
  component: CLIAuthPage,
});

function CLIAuthPage() {
  const { code } = Route.useSearch();
  const { isSignedIn, isLoaded } = useAuth();
  const { session } = useClerk();
  const completeSession = useMutation(api.cliAuth.completeSession);
  const [status, setStatus] = useState<"loading" | "success" | "error" | "invalid">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !session) {
      setStatus("loading");
      return;
    }

    // User is signed in, complete the CLI auth session
    const completeAuth = async () => {
      try {
        // Get the Convex token with CLI template (7 day expiry)
        const token = await session.getToken({ template: "polychromos-cli" });

        if (!token) {
          throw new Error("Failed to get authentication token");
        }

        // Calculate expiry (7 days from now)
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

        await completeSession({
          code,
          token,
          expiresAt,
        });

        setStatus("success");
      } catch (err) {
        console.error("CLI auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setStatus("error");
      }
    };

    void completeAuth();
  }, [code, isSignedIn, isLoaded, session, completeSession]);

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Request</h1>
          <p className="mt-2 text-gray-600">
            Missing authentication code. Please run `polychromos login` from your terminal.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Polychromos CLI Login
          </h1>
          <p className="text-gray-600 mb-6">
            Sign in to authenticate the Polychromos CLI
          </p>
          <SignIn
            routing="hash"
            afterSignInUrl={`/cli-auth?code=${code}`}
          />
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900">
            CLI Authenticated Successfully
          </h1>
          <p className="mt-2 text-gray-600">
            You can close this window and return to your terminal.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">✗</div>
          <h1 className="text-2xl font-bold text-red-600">
            Authentication Failed
          </h1>
          <p className="mt-2 text-gray-600">{error}</p>
          <p className="mt-4 text-sm text-gray-500">
            Please try running `polychromos login` again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:app`

#### Manual Verification:
- [ ] Navigate to `/cli-auth` without code shows "Invalid Request" message
- [ ] Navigate to `/cli-auth?code=test123` when signed out shows Clerk sign-in
- [ ] After sign-in, page shows success message

**Implementation Note**: After completing this phase, test the web app route manually before proceeding to Phase 3.

---

## Phase 3: CLI Login Command Update

### Overview
Update the CLI login command to use the browser-based polling flow.

### Changes Required:

#### 1. Add Dependencies
**File**: `packages/polychromos/package.json`
**Changes**: Add `open` package for opening browser

```bash
cd packages/polychromos && pnpm add open
```

#### 2. Update Credentials Interface
**File**: `packages/polychromos/src/lib/credentials.ts`
**Changes**: Ensure expiresAt is properly handled

```typescript
// Update the TokenData interface (if not already correct)
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Timestamp in milliseconds
}

// Update getValidToken to provide clearer error message
export async function getValidToken(): Promise<string> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run `polychromos login` first.");
  }

  // Check expiry if available (with 5-minute buffer)
  if (creds.expiresAt) {
    const bufferMs = 5 * 60 * 1000;
    if (Date.now() > creds.expiresAt - bufferMs) {
      throw new Error(
        "Session expired. Run `polychromos login` to authenticate again."
      );
    }
  }

  return creds.accessToken;
}
```

#### 3. Add Code Generation Utility
**File**: `packages/polychromos/src/lib/auth.ts` (new file)
**Changes**: Add utilities for browser auth flow

```typescript
import { randomBytes } from "crypto";

/**
 * Generate a unique session code for CLI auth.
 * Format: pol_<random-hex>
 */
export function generateSessionCode(): string {
  const random = randomBytes(16).toString("hex");
  return `pol_${random}`;
}

/**
 * Get the web app URL for CLI auth.
 */
export function getAuthUrl(code: string): string {
  // Use environment variable or default to production
  const baseUrl = process.env.POLYCHROMOS_APP_URL || "https://app.polychromos.io";
  return `${baseUrl}/cli-auth?code=${encodeURIComponent(code)}`;
}
```

#### 4. Update Login Command
**File**: `packages/polychromos/src/commands/login.ts`
**Changes**: Implement browser-based polling flow

```typescript
import open from "open";
import { ConvexHttpClient } from "convex/browser";
import { saveCredentials } from "../lib/credentials.js";
import { loadConfig } from "../lib/config.js";
import { generateSessionCode, getAuthUrl } from "../lib/auth.js";
import { api } from "../convex/_generated/api.js";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute timeout

export async function loginCommand(): Promise<void> {
  console.log("Polychromos CLI Login");
  console.log("");

  // Load config to get Convex URL
  const config = await loadConfig();
  if (!config?.convexUrl) {
    console.error("Not initialized. Run `polychromos init` first.");
    process.exit(1);
  }

  const client = new ConvexHttpClient(config.convexUrl);
  const code = generateSessionCode();

  try {
    // Create pending session in Convex
    console.log("Creating authentication session...");
    await client.mutation(api.cliAuth.createSession, { code });

    // Open browser
    const authUrl = getAuthUrl(code);
    console.log("");
    console.log("Opening browser for authentication...");
    console.log(`If browser doesn't open, visit: ${authUrl}`);
    console.log("");

    await open(authUrl);

    // Poll for completion
    console.log("Waiting for authentication...");
    const startTime = Date.now();
    let dots = 0;

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      const result = await client.query(api.cliAuth.getSession, { code });

      if (result.status === "completed" && result.token) {
        // Save credentials
        await saveCredentials({
          accessToken: result.token,
          expiresAt: result.expiresAt,
        });

        console.log("");
        console.log("✓ Login successful!");
        console.log("You can now use polychromos commands.");
        return;
      }

      if (result.status === "expired" || result.status === "not_found") {
        console.log("");
        console.error("Authentication session expired. Please try again.");
        process.exit(1);
      }

      // Show progress
      process.stdout.write(`\rWaiting for authentication${".".repeat((dots % 3) + 1)}   `);
      dots++;

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout
    console.log("");
    console.error("Authentication timed out. Please try again.");
    process.exit(1);
  } catch (error) {
    console.error(
      "Login failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
```

#### 5. Export Auth Utilities
**File**: `packages/polychromos/src/lib/index.ts`
**Changes**: Export new auth utilities

```typescript
// Add to existing exports
export * from "./auth.js";
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Unit tests pass: `pnpm test`
- [ ] Package builds: `pnpm --filter polychromos build`

#### Manual Verification:
- [ ] `polychromos login` opens browser
- [ ] Completing auth in browser shows success in CLI
- [ ] `polychromos whoami` works after login
- [ ] Token is saved with expiry in `~/.polychromos/credentials.json`

**Implementation Note**: After completing this phase, test the full flow end-to-end manually before proceeding to Phase 4.

---

## Phase 4: Testing & Polish

### Overview
Add tests, improve error handling, and polish the user experience.

### Changes Required:

#### 1. Update Login Command Tests
**File**: `packages/polychromos/src/__tests__/commands/login.test.ts`
**Changes**: Update tests for new flow

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginCommand } from "../../commands/login.js";

// Mock dependencies
vi.mock("open", () => ({ default: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: vi.fn(),
    query: vi.fn(),
  })),
}));
vi.mock("../../lib/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({ convexUrl: "https://test.convex.cloud" }),
}));
vi.mock("../../lib/credentials.js", () => ({
  saveCredentials: vi.fn(),
}));

describe("loginCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if not initialized", async () => {
    const { loadConfig } = await import("../../lib/config.js");
    vi.mocked(loadConfig).mockResolvedValueOnce(null);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(loginCommand()).rejects.toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should open browser with auth URL", async () => {
    const open = (await import("open")).default;
    const { ConvexHttpClient } = await import("convex/browser");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        status: "completed",
        token: "test-token",
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as any);

    await loginCommand();

    expect(open).toHaveBeenCalledWith(expect.stringContaining("/cli-auth?code="));
  });

  it("should save credentials on successful auth", async () => {
    const { saveCredentials } = await import("../../lib/credentials.js");
    const { ConvexHttpClient } = await import("convex/browser");

    const testToken = "test-token-123";
    const testExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        status: "completed",
        token: testToken,
        expiresAt: testExpiry,
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as any);

    await loginCommand();

    expect(saveCredentials).toHaveBeenCalledWith({
      accessToken: testToken,
      expiresAt: testExpiry,
    });
  });
});
```

#### 2. Add Auth Utility Tests
**File**: `packages/polychromos/src/lib/__tests__/auth.test.ts` (new file)
**Changes**: Add tests for auth utilities

```typescript
import { describe, it, expect } from "vitest";
import { generateSessionCode, getAuthUrl } from "../auth.js";

describe("generateSessionCode", () => {
  it("should generate unique codes", () => {
    const code1 = generateSessionCode();
    const code2 = generateSessionCode();
    expect(code1).not.toBe(code2);
  });

  it("should start with pol_ prefix", () => {
    const code = generateSessionCode();
    expect(code).toMatch(/^pol_[a-f0-9]{32}$/);
  });
});

describe("getAuthUrl", () => {
  it("should generate correct auth URL", () => {
    const url = getAuthUrl("pol_test123");
    expect(url).toContain("/cli-auth?code=pol_test123");
  });

  it("should encode special characters", () => {
    const url = getAuthUrl("pol_test&code=bad");
    expect(url).toContain("pol_test%26code%3Dbad");
  });
});
```

#### 3. Add Convex Function Tests
**File**: `apps/polychromos-app/convex/__tests__/cliAuth.test.ts` (new file)
**Changes**: Add tests for Convex CLI auth functions

```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("cliAuth", () => {
  test("createSession creates pending session", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_test123" });

    const result = await t.query(api.cliAuth.getSession, { code: "pol_test123" });
    expect(result.status).toBe("pending");
  });

  test("createSession rejects duplicate codes", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_duplicate" });

    await expect(
      t.mutation(api.cliAuth.createSession, { code: "pol_duplicate" })
    ).rejects.toThrow("Session code already exists");
  });

  test("completeSession requires authentication", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_auth" });

    // Without identity, should fail
    await expect(
      t.mutation(api.cliAuth.completeSession, {
        code: "pol_auth",
        token: "test-token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Must be authenticated");
  });

  test("completeSession stores token", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_complete" });

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    const expiresAt = Date.now() + 86400000;
    await asUser.mutation(api.cliAuth.completeSession, {
      code: "pol_complete",
      token: "test-token-value",
      expiresAt,
    });

    const result = await t.query(api.cliAuth.getSession, { code: "pol_complete" });
    expect(result.status).toBe("completed");
    expect(result.token).toBe("test-token-value");
    expect(result.expiresAt).toBe(expiresAt);
  });

  test("getSession returns not_found for unknown code", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.cliAuth.getSession, { code: "pol_unknown" });
    expect(result.status).toBe("not_found");
  });
});
```

#### 4. Update Logout Command
**File**: `packages/polychromos/src/commands/logout.ts`
**Changes**: Add confirmation message about re-login

```typescript
import { loadCredentials, clearCredentials } from "../lib/credentials.js";

export async function logoutCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not currently logged in.");
    return;
  }

  await clearCredentials();
  console.log("✓ Logged out successfully.");
  console.log("");
  console.log("Run `polychromos login` to authenticate again.");
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `pnpm test`
- [ ] Convex tests pass: `pnpm --filter @repo/app test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] E2E tests pass (if applicable): `pnpm --filter @repo/app test:e2e:cli`

#### Manual Verification:
- [ ] Full login flow works end-to-end
- [ ] Login timeout works (wait 5+ minutes without completing)
- [ ] Expired token prompts re-login with clear message
- [ ] Logout works and shows helpful message

---

## Testing Strategy

### Unit Tests:
- Code generation produces unique, valid codes
- Auth URL generation with proper encoding
- Credentials save/load with expiry
- Convex mutations validate inputs correctly

### Integration Tests:
- CLI creates session in Convex
- Web app completes session correctly
- CLI receives token via polling

### Manual Testing Steps:
1. Run `polychromos login` - should open browser
2. Sign in with Clerk in browser
3. Browser should show "CLI Authenticated Successfully"
4. Terminal should show "Login successful!"
5. Run `polychromos whoami` - should show user info
6. Check `~/.polychromos/credentials.json` - should have token and expiresAt
7. Run `polychromos logout` - should clear credentials
8. Run `polychromos whoami` - should prompt to login

### Edge Cases to Test:
- Login without initializing (`polychromos init`)
- Closing browser without completing auth (should timeout)
- Multiple concurrent login attempts
- Login when already logged in (should work, overwrites existing)

---

## Migration Notes

No data migration required. This is a new feature that:
- Adds a new Convex table (`cliAuthSessions`)
- Adds new Convex functions
- Updates CLI login flow
- Is backward compatible (existing tokens in credentials.json still work)

---

## Performance Considerations

- **Polling Interval**: 2 seconds balances responsiveness vs API load
- **Session Timeout**: 10 minutes gives users enough time to sign in
- **Cleanup**: Old sessions should be cleaned up to avoid table bloat
- **Token Size**: Convex tokens are JWTs, typically 1-2KB

---

## Security Considerations

- Session codes are cryptographically random (32 hex chars)
- Tokens are only stored after authentication completes
- Sessions expire after 10 minutes if not completed
- Completed sessions are single-use (status changes to "completed")
- Credentials file has restricted permissions (0o600)

---

## References

- Current state research: `thoughts/shared/research/2026-02-03-polychromos-cli-authentication-current-state.md`
- Clerk + Convex integration: `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md`
- Current login implementation: `packages/polychromos/src/commands/login.ts:1-47`
- Credentials handling: `packages/polychromos/src/lib/credentials.ts:1-85`
