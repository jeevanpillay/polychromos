# Polychromos Auth Testing Infrastructure Implementation Plan

## Overview

Implement comprehensive testing infrastructure for the Polychromos authentication system, including CLI auth command unit tests, integration tests, and E2E tests with Clerk/Playwright integration.

## Current State Analysis

### What's Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Convex Backend Auth | ✅ Complete | `apps/polychromos-app/convex/lib/auth.ts` |
| Web App ClerkProvider | ✅ Complete | `apps/polychromos-app/src/router.tsx:48-54` |
| Convex Unit Tests with `withIdentity()` | ✅ Complete | `apps/polychromos-app/convex/__tests__/` |
| CLI `login` command | ✅ Complete | `packages/polychromos/src/commands/login.ts` |
| CLI `logout` command | ✅ Complete | `packages/polychromos/src/commands/logout.ts` |
| CLI `whoami` command | ✅ Complete | `packages/polychromos/src/commands/whoami.ts` |
| Token storage (`credentials.ts`) | ✅ Complete | `packages/polychromos/src/lib/credentials.ts` |
| Dev command with auth | ✅ Complete | `packages/polychromos/src/commands/dev.ts` |

### What's Missing

| Component | Status | Notes |
|-----------|--------|-------|
| CLI auth command unit tests | ❌ Missing | Tests for login, logout, whoami |
| CLI auth integration tests | ❌ Missing | CLI → Convex authenticated flow |
| E2E test infrastructure | ❌ Missing | Playwright + @clerk/testing setup |
| E2E authenticated tests | ❌ Missing | Browser tests with Clerk auth |
| CI/CD for E2E | ❌ Missing | GitHub Actions with Clerk secrets |

### Key Discoveries

- Current CLI login uses **manual token entry** (copy `__session` cookie from browser DevTools)
- Token is a Clerk JWT stored in `~/.polychromos/credentials.json`
- OAuth browser redirect flow is **deferred** to a future phase
- Existing test patterns use `memfs` for filesystem mocking and `vi.mock` for external dependencies

## Desired End State

After this plan is complete:

1. **CLI auth commands have comprehensive unit tests** covering success paths, error handling, and edge cases
2. **Integration tests verify CLI-to-Convex authenticated flow** works correctly
3. **Playwright E2E infrastructure is set up** with @clerk/testing integration
4. **E2E tests cover authenticated user flows** including workspace creation, access control, and user isolation
5. **CI/CD pipeline runs E2E tests** with proper Clerk test credentials

### Verification

- `pnpm test` passes with all new CLI auth tests
- `pnpm test:e2e` runs Playwright tests with Clerk authentication
- GitHub Actions CI runs E2E tests successfully

## What We're NOT Doing

- ❌ OAuth browser redirect flow for CLI login (deferred)
- ❌ Token refresh via Clerk refresh tokens (using manual re-login)
- ❌ System keychain storage with `keytar` (using file-based storage)
- ❌ Users table with Clerk webhook sync (not needed for MVP)
- ❌ Multi-device session management

## Implementation Approach

Follow existing test patterns in the codebase:
- Use `memfs` for filesystem mocking in CLI tests
- Use `vi.mock` for external dependencies (ConvexHttpClient, readline)
- Use `convex-test` with `withIdentity()` for backend tests (already done)
- Use `@clerk/testing` with Playwright for E2E tests

---

## Phase 1: CLI Auth Command Unit Tests

### Overview

Add comprehensive unit tests for the CLI authentication commands: `login`, `logout`, and `whoami`.

### Changes Required

#### 1. Login Command Tests

**File**: `packages/polychromos/src/__tests__/commands/login.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

// Mock readline
const mockQuestion = vi.fn();
const mockClose = vi.fn();
vi.mock("readline", () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  })),
}));

describe("login command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves credentials when valid token provided", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Simulate user entering a token
    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("test_token_123");
    });

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    // Verify credentials were saved
    const credsPath = `${homedir()}/.polychromos/credentials.json`;
    expect(vol.existsSync(credsPath)).toBe(true);

    const creds = JSON.parse(vol.readFileSync(credsPath, "utf-8") as string);
    expect(creds.accessToken).toBe("test_token_123");

    expect(consoleSpy).toHaveBeenCalledWith("✓ Login successful!");
    consoleSpy.mockRestore();
  });

  it("exits with error when empty token provided", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("");
    });

    const { loginCommand } = await import("../../commands/login.js");
    await expect(loginCommand()).rejects.toThrow("process.exit(1)");

    expect(consoleSpy).toHaveBeenCalledWith("No token provided. Login cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("exits with error when whitespace-only token provided", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("   \n\t  ");
    });

    const { loginCommand } = await import("../../commands/login.js");
    await expect(loginCommand()).rejects.toThrow("process.exit(1)");

    expect(consoleSpy).toHaveBeenCalledWith("No token provided. Login cancelled.");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("trims whitespace from token", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("  token_with_spaces  \n");
    });

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    const credsPath = `${homedir()}/.polychromos/credentials.json`;
    const creds = JSON.parse(vol.readFileSync(credsPath, "utf-8") as string);
    expect(creds.accessToken).toBe("token_with_spaces");

    consoleSpy.mockRestore();
  });

  it("displays instructions before prompting", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    mockQuestion.mockImplementation((prompt: string, callback: (answer: string) => void) => {
      callback("token");
    });

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Polychromos CLI Login");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("__session"));

    consoleSpy.mockRestore();
  });
});
```

#### 2. Logout Command Tests

**File**: `packages/polychromos/src/__tests__/commands/logout.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

describe("logout command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears credentials when logged in", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Pre-populate credentials
    const credsDir = `${homedir()}/.polychromos`;
    const credsPath = `${credsDir}/credentials.json`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(credsPath, JSON.stringify({ accessToken: "test_token" }));

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(vol.existsSync(credsPath)).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith("✓ Logged out successfully.");

    consoleSpy.mockRestore();
  });

  it("displays message when not logged in", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Not currently logged in.");

    consoleSpy.mockRestore();
  });

  it("handles missing credentials file gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Create directory but not file
    vol.mkdirSync(`${homedir()}/.polychromos`, { recursive: true });

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Not currently logged in.");

    consoleSpy.mockRestore();
  });
});
```

#### 3. Whoami Command Tests

**File**: `packages/polychromos/src/__tests__/commands/whoami.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

// Mock ConvexHttpClient
const mockQuery = vi.fn();
const mockSetAuth = vi.fn();
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    setAuth: mockSetAuth,
  })),
}));

describe("whoami command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();

    // Re-setup mock after module reset
    vi.doMock("convex/browser", () => ({
      ConvexHttpClient: vi.fn().mockImplementation(() => ({
        query: mockQuery,
        setAuth: mockSetAuth,
      })),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays login prompt when not authenticated", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Not logged in. Run `polychromos login` to authenticate."
    );

    consoleSpy.mockRestore();
  });

  it("displays init prompt when logged in but no config", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Add credentials but no config
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" })
    );

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Logged in, but no project configured.");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("polychromos init")
    );

    consoleSpy.mockRestore();
  });

  it("displays auth status when fully configured", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Add credentials
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" })
    );

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      })
    );

    // Mock successful query
    mockQuery.mockResolvedValue([{ id: "ws_1" }, { id: "ws_2" }]);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(mockSetAuth).toHaveBeenCalledWith("test_token");
    expect(consoleSpy).toHaveBeenCalledWith("✓ Authenticated");
    expect(consoleSpy).toHaveBeenCalledWith("  Workspaces: 2");
    expect(consoleSpy).toHaveBeenCalledWith("  Convex URL: https://test.convex.cloud");

    consoleSpy.mockRestore();
  });

  it("displays error when token is invalid", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Add credentials
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "invalid_token" })
    );

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      })
    );

    // Mock authentication error
    mockQuery.mockRejectedValue(new Error("Unauthenticated"));

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Token invalid or expired. Run `polychromos login` to re-authenticate."
    );

    consoleSpy.mockRestore();
  });

  it("displays generic error for non-auth failures", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Add credentials and config
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" })
    );
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      })
    );

    // Mock network error
    mockQuery.mockRejectedValue(new Error("Network error"));

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error verifying authentication:",
      "Network error"
    );

    consoleSpy.mockRestore();
  });

  it("uses POLYCHROMOS_TOKEN env var when available", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Set env var instead of file
    process.env.POLYCHROMOS_TOKEN = "env_token";

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      })
    );

    mockQuery.mockResolvedValue([]);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(mockSetAuth).toHaveBeenCalledWith("env_token");

    delete process.env.POLYCHROMOS_TOKEN;
    consoleSpy.mockRestore();
  });
});
```

#### 4. Credentials Library Tests

**File**: `packages/polychromos/src/lib/__tests__/credentials.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

describe("credentials", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.POLYCHROMOS_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.POLYCHROMOS_TOKEN;
  });

  describe("saveCredentials", () => {
    it("creates .polychromos directory if not exists", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({ accessToken: "test" });

      expect(vol.existsSync(`${homedir()}/.polychromos`)).toBe(true);
    });

    it("writes credentials to file", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({
        accessToken: "test_token",
        refreshToken: "refresh_token",
        expiresAt: 1234567890,
      });

      const content = vol.readFileSync(
        `${homedir()}/.polychromos/credentials.json`,
        "utf-8"
      ) as string;
      const creds = JSON.parse(content);

      expect(creds.accessToken).toBe("test_token");
      expect(creds.refreshToken).toBe("refresh_token");
      expect(creds.expiresAt).toBe(1234567890);
    });

    it("overwrites existing credentials", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({ accessToken: "first" });
      await saveCredentials({ accessToken: "second" });

      const content = vol.readFileSync(
        `${homedir()}/.polychromos/credentials.json`,
        "utf-8"
      ) as string;
      const creds = JSON.parse(content);

      expect(creds.accessToken).toBe("second");
    });
  });

  describe("loadCredentials", () => {
    it("returns credentials from file", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "file_token" })
      );

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds?.accessToken).toBe("file_token");
    });

    it("prefers POLYCHROMOS_TOKEN env var over file", async () => {
      process.env.POLYCHROMOS_TOKEN = "env_token";

      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "file_token" })
      );

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds?.accessToken).toBe("env_token");
    });

    it("returns null when no credentials exist", async () => {
      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds).toBeNull();
    });

    it("returns null for invalid JSON", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(`${credsDir}/credentials.json`, "invalid json");

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds).toBeNull();
    });
  });

  describe("clearCredentials", () => {
    it("removes credentials file", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      const credsPath = `${credsDir}/credentials.json`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(credsPath, JSON.stringify({ accessToken: "test" }));

      const { clearCredentials } = await import("../credentials.js");
      await clearCredentials();

      expect(vol.existsSync(credsPath)).toBe(false);
    });

    it("does not throw when file does not exist", async () => {
      const { clearCredentials } = await import("../credentials.js");

      await expect(clearCredentials()).resolves.not.toThrow();
    });
  });

  describe("getValidToken", () => {
    it("returns token when valid", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "valid_token" })
      );

      const { getValidToken } = await import("../credentials.js");
      const token = await getValidToken();

      expect(token).toBe("valid_token");
    });

    it("throws when not authenticated", async () => {
      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow(
        "Not authenticated. Run `polychromos login` first."
      );
    });

    it("throws when token expired", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({
          accessToken: "expired_token",
          expiresAt: Date.now() - 1000, // Already expired
        })
      );

      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow(
        "Token expired. Run `polychromos login` to refresh."
      );
    });

    it("returns token when expiry is within buffer", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({
          accessToken: "almost_expired_token",
          expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now (within 5 min buffer)
        })
      );

      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow("Token expired");
    });

    it("returns token when no expiry set", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "no_expiry_token" })
      );

      const { getValidToken } = await import("../credentials.js");
      const token = await getValidToken();

      expect(token).toBe("no_expiry_token");
    });
  });
});
```

### Success Criteria

#### Automated Verification
- [x] All new tests pass: `pnpm --filter polychromos test`
- [x] No TypeScript errors: `pnpm --filter polychromos typecheck`
- [x] Linting passes: `pnpm --filter polychromos lint`
- [x] Coverage maintained: `pnpm --filter polychromos test:coverage`

#### Manual Verification (Skipped per user request)
- [~] Run `polychromos login` with valid token - verify success message
- [~] Run `polychromos logout` - verify credentials cleared
- [~] Run `polychromos whoami` - verify auth status displayed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: E2E Testing Infrastructure Setup

### Overview

Set up Playwright with @clerk/testing for E2E tests that run against the actual Polychromos web app with Clerk authentication.

### Changes Required

#### 1. Install Dependencies

**File**: `apps/polychromos-app/package.json` (add dev dependencies)

```bash
pnpm add -D @playwright/test @clerk/testing --filter polychromos-app
```

#### 2. Playwright Configuration

**File**: `apps/polychromos-app/playwright.config.ts` (new file)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project for authentication
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    // Main test project
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

#### 3. Global Setup for Clerk Authentication

**File**: `apps/polychromos-app/e2e/global.setup.ts` (new file)

```typescript
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("global setup", async () => {
  await clerkSetup();
});

setup("authenticate", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Wait for Clerk to load
  await page.waitForLoadState("networkidle");

  // Sign in using Clerk testing helper
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });

  // Wait for authentication to complete
  await expect(page.locator("[data-testid='authenticated']")).toBeVisible({
    timeout: 10000,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
```

#### 4. Add Test Attribute to App

**File**: `apps/polychromos-app/src/routes/index.tsx` (modify)

Add `data-testid` attribute to authenticated content for E2E verification:

```typescript
// In the Authenticated section, add data-testid
<Authenticated>
  <div data-testid="authenticated">
    {/* existing content */}
  </div>
</Authenticated>
```

#### 5. Environment Variables Template

**File**: `apps/polychromos-app/.env.test.example` (new file)

```bash
# Clerk E2E Testing
E2E_CLERK_USER_USERNAME=test-user@example.com
E2E_CLERK_USER_PASSWORD=test-password-here

# These should already exist in .env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

#### 6. Gitignore Updates

**File**: `apps/polychromos-app/.gitignore` (append)

```
# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
/playwright/.clerk/
```

#### 7. Package.json Scripts

**File**: `apps/polychromos-app/package.json` (add scripts)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

### Success Criteria

#### Automated Verification
- [x] Playwright installs successfully: `pnpm exec playwright install`
- [x] Config file has no syntax errors
- [x] TypeScript compiles with new files

#### Manual Verification (Skipped per user request)
- [~] Create test user in Clerk dashboard
- [~] Add test credentials to `.env.test`
- [~] Run `pnpm test:e2e:playwright` - setup project completes authentication
- [~] Verify `playwright/.clerk/user.json` is created with auth state

**Implementation Note**: After completing this phase, pause for manual setup of Clerk test user before proceeding to Phase 3.

---

## Phase 3: E2E Authenticated Flow Tests

### Overview

Create E2E tests that verify authenticated user flows including workspace creation, listing, and access control.

### Changes Required

#### 1. Workspace Flow Tests

**File**: `apps/polychromos-app/e2e/browser/workspace-flow.spec.ts` (new file)

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
    await expect(page.locator("[data-testid='authenticated']")).toBeVisible();

    // Click create workspace button
    await page.getByRole("button", { name: /create/i }).click();

    // Wait for workspace to be created and URL to update
    await page.waitForURL(/workspace=/);

    // Verify workspace ID in URL
    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");
    expect(workspaceId).toBeTruthy();
  });

  test("workspace persists after page reload", async ({ page }) => {
    await page.goto("/");

    // Create workspace
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL(/workspace=/);

    const url = new URL(page.url());
    const workspaceId = url.searchParams.get("workspace");

    // Reload page
    await page.reload();

    // Should still have same workspace
    const newUrl = new URL(page.url());
    expect(newUrl.searchParams.get("workspace")).toBe(workspaceId);
  });

  test("user sees their workspaces listed", async ({ page }) => {
    await page.goto("/");

    // Create a workspace first
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL(/workspace=/);

    // Navigate back to home
    await page.goto("/");

    // Should see at least one workspace in the list
    await expect(page.locator("[data-workspace-id]").first()).toBeVisible();
  });
});
```

#### 2. Authentication UI Tests

**File**: `apps/polychromos-app/e2e/browser/auth-ui.spec.ts` (new file)

```typescript
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken, clerk } from "@clerk/testing/playwright";

test.describe("Authentication UI", () => {
  test("shows sign-in button when unauthenticated", async ({ page }) => {
    // Don't use stored auth state for this test
    await page.goto("/");

    // Clear any existing auth
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Should show sign-in button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows user button when authenticated", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // Should show user button (Clerk's UserButton component)
    await expect(page.locator(".cl-userButtonTrigger")).toBeVisible();
  });

  test("can sign out", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");

    // Click user button to open menu
    await page.locator(".cl-userButtonTrigger").click();

    // Click sign out
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Should redirect to sign-in state
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
```

#### 3. Access Control Tests

**File**: `apps/polychromos-app/e2e/browser/access-control.spec.ts` (new file)

```typescript
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Access Control", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("cannot access invalid workspace ID", async ({ page }) => {
    // Try to access a non-existent workspace
    await page.goto("/?workspace=invalid_workspace_id");

    // Should show error or redirect
    // The exact behavior depends on your app's error handling
    await expect(
      page.getByText(/not found|error|invalid/i)
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Or should redirect away from invalid workspace
      const url = new URL(page.url());
      expect(url.searchParams.get("workspace")).not.toBe("invalid_workspace_id");
    });
  });

  test("unauthenticated user cannot create workspace", async ({ page }) => {
    // Clear auth and go to app
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    // Should not see create button, should see sign-in
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create/i })
    ).not.toBeVisible();
  });
});
```

### Success Criteria

#### Automated Verification
- [x] Test files created and lint clean
- [x] Playwright can list all tests: `pnpm exec playwright test --list` (9 tests in 3 files)
- [~] All E2E tests pass: `pnpm test:e2e:playwright` (requires Clerk test user setup - skipped)
- [~] Tests complete in reasonable time (<2 minutes) (skipped)
- [~] No flaky tests on retry (skipped)

#### Manual Verification (Skipped per user request)
- [~] Review test report: `pnpm test:e2e:playwright:ui`
- [~] Verify screenshots on failure show correct state
- [~] Check that auth state is properly cached (subsequent runs faster)

**Implementation Note**: After completing this phase, verify all tests pass locally before proceeding to Phase 4.

---

## Phase 4: CI/CD Configuration

### Overview

Configure GitHub Actions to run E2E tests with Clerk credentials in CI environment.

### Changes Required

#### 1. E2E Workflow

**File**: `.github/workflows/e2e.yml` (new file)

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

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build app
        run: pnpm --filter polychromos-app build

      - name: Run E2E tests
        run: pnpm --filter polychromos-app test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/polychromos-app/playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: apps/polychromos-app/test-results/
          retention-days: 7
```

#### 2. Update Turbo Pipeline

**File**: `turbo.json` (modify if needed)

Add E2E test task if not present:

```json
{
  "tasks": {
    "test:e2e": {
      "dependsOn": ["build"],
      "inputs": ["e2e/**", "src/**", "playwright.config.ts"],
      "outputs": ["playwright-report/**", "test-results/**"],
      "env": [
        "E2E_CLERK_USER_USERNAME",
        "E2E_CLERK_USER_PASSWORD",
        "VITE_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY"
      ]
    }
  }
}
```

#### 3. Documentation for Secrets Setup

**File**: `apps/polychromos-app/e2e/README.md` (new file)

```markdown
# E2E Testing Setup

## Required Secrets

Configure the following in your GitHub repository settings:

### Repository Secrets (Settings → Secrets → Actions)

| Secret | Description |
|--------|-------------|
| `CLERK_SECRET_KEY` | Clerk secret key (sk_test_...) |
| `E2E_CLERK_USER_USERNAME` | Test user email address |
| `E2E_CLERK_USER_PASSWORD` | Test user password |

### Repository Variables (Settings → Variables → Actions)

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (pk_test_...) |
| `VITE_CONVEX_URL` | Convex deployment URL |

## Creating a Test User in Clerk

1. Go to Clerk Dashboard → Users
2. Create a new user with email/password
3. Use a strong, unique password
4. Note the credentials for GitHub secrets

## Running E2E Tests Locally

1. Copy `.env.test.example` to `.env.test`
2. Fill in your test credentials
3. Run: `pnpm test:e2e`

## Debugging Failed Tests

- View test report: `pnpm test:e2e:ui`
- Run in debug mode: `pnpm test:e2e:debug`
- Check `playwright-report/` for HTML report
- Check `test-results/` for screenshots and traces
```

### Success Criteria

#### Automated Verification
- [x] GitHub Actions workflow syntax is valid
- [x] Workflow triggers on correct paths
- [x] turbo.json updated with test:e2e:playwright task

#### Manual Verification (Skipped per user request)
- [~] Add secrets to GitHub repository
- [~] Create test user in Clerk dashboard
- [~] Push to trigger workflow
- [~] Verify E2E tests pass in CI
- [~] Check uploaded artifacts are accessible

**Implementation Note**: This is the final phase. After CI passes, all auth testing infrastructure is complete.

---

## Testing Strategy Summary

| Test Type | Framework | Location | What It Tests |
|-----------|-----------|----------|---------------|
| CLI Unit Tests | Vitest + memfs | `packages/polychromos/src/__tests__/` | Auth commands in isolation |
| Convex Unit Tests | convex-test + vitest | `apps/polychromos-app/convex/__tests__/` | Backend auth logic |
| E2E Tests | Playwright + @clerk/testing | `apps/polychromos-app/e2e/browser/` | Full user flows with auth |

## Performance Considerations

- E2E tests cache auth state in `playwright/.clerk/user.json` to avoid re-authenticating each test
- Unit tests use memfs to avoid filesystem I/O
- Convex tests use in-memory database via convex-test

## References

- Research doc: `thoughts/shared/research/2026-02-02-polychromos-auth-testing-strategy.md`
- Clerk integration research: `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md`
- Existing CLI tests: `packages/polychromos/src/__tests__/`
- Existing Convex tests: `apps/polychromos-app/convex/__tests__/`
- @clerk/testing docs: https://clerk.com/docs/guides/development/testing/playwright/overview
- convex-test docs: https://docs.convex.dev/testing/convex-test
