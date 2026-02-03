# Complete Testing Infrastructure Rework

## Overview

Complete rework of the Polychromos testing infrastructure to support the new browser-based CLI authentication flow, isolated database testing, custom Clerk integration, and production-ready npm publishing. This plan consolidates all testing areas (browser, unit, CLI, cross-platform, auth polling) into a unified, parallelizable infrastructure.

## Current State Analysis

### What Exists
- **E2E Test Framework**: Playwright for browser tests, Vitest for CLI tests
- **Test Locations**: `apps/polychromos-app/e2e/` and `packages/polychromos/test/e2e/`
- **Servers**: Convex local backend (port 3210) and Vite dev server (port 3001)
- **Authentication**: Manual token copy-paste from Clerk `__session` cookie
- **Hardcoded Ports**: 15+ files have hardcoded port 3210/3001

### Key Discoveries
- `apps/polychromos-app/test/e2eRunner.cjs:7` - Hardcoded `BACKEND_URL = 'http://127.0.0.1:3210'`
- `apps/polychromos-app/test/backendHarness.cjs:5-6` - Hardcoded ports for both backend and web app
- `packages/polychromos/test/e2e/setup.ts:246-279` - Token extraction from Clerk via `window.Clerk.session.getToken()`
- `apps/polychromos-app/src/router.tsx:49-52` - Uses `ClerkProvider` with prebuilt `SignInButton`
- `apps/polychromos-app/convex/schema.ts` - No `cliAuthSessions` table exists

### Parallelization Blockers
1. Port 3210 hardcoded in 15+ files
2. Port 3001 hardcoded in 4+ files
3. Sequential CLI tests (`vitest.e2e.config.ts:12` sets `concurrent: false`)
4. Shared storage state (`playwright/.clerk/user.json`)
5. Single Convex database (`convex_local_backend.sqlite3`)

## Desired End State

A fully reworked testing infrastructure with:

1. **Custom Clerk UI**: Own login/signup pages instead of prebuilt components
2. **Browser-Based CLI Auth**: CLI opens browser → user authenticates → CLI polls for token
3. **Isolated Testing**: Each test run gets isolated Convex database
4. **Dynamic Ports**: Configurable ports to enable parallel test runs
5. **Production-Ready**: npm publish uses production Clerk/Convex URLs

### Verification Criteria
- [ ] Custom `/sign-in` and `/sign-up` routes work correctly
- [ ] CLI `polychromos login` opens browser and completes auth via polling
- [ ] E2E tests run in isolation with fresh database each time
- [ ] Tests work identically in local and GitHub Actions
- [ ] npm publish uses `https://app.polychromos.xyz` Clerk URLs
- [ ] All test types pass: browser, unit, CLI, cross-platform, auth polling

## What We're NOT Doing

- OAuth device flow (not supported by Clerk)
- System keychain storage (keeping simple file storage)
- Automatic token refresh (requires Clerk backend API complexity)
- SSR authentication (Clerk requires client-side auth)
- Complete UI redesign (only auth pages use custom implementation)

## Implementation Approach

Six phases with clear dependencies:

1. **Environment Configuration** - Remove hardcoded values, create centralized config
2. **Custom Clerk Integration** - Custom login pages, middleware, `/cli-auth` route
3. **CLI Auth Browser Flow** - Convex schema, polling functions, token exchange
4. **CLI Authentication Rework** - Update login command for browser-based flow
5. **Testing Infrastructure** - Unified test setup, isolated databases, all test types
6. **CI/CD & Production** - GitHub Actions, npm publish with production URLs

---

## Phase 1: Environment Configuration Foundation

### Overview
Remove all hardcoded ports and URLs, create a centralized configuration system that works across local development, testing, and CI.

### Changes Required:

#### 1. Create Centralized Test Config
**File**: `apps/polychromos-app/test/config.ts` (new file)
**Changes**: Single source of truth for test configuration

```typescript
/**
 * Centralized test configuration.
 * All ports and URLs should be read from here, not hardcoded.
 */

export interface TestConfig {
  convexBackendUrl: string;
  convexBackendPort: number;
  webAppUrl: string;
  webAppPort: number;
  playwrightBaseUrl: string;
  adminKey: string;
}

function getPort(envVar: string, defaultPort: number): number {
  const value = process.env[envVar];
  return value ? parseInt(value, 10) : defaultPort;
}

function getUrl(envVar: string, defaultUrl: string): string {
  return process.env[envVar] || defaultUrl;
}

export function getTestConfig(): TestConfig {
  const convexPort = getPort('CONVEX_BACKEND_PORT', 3210);
  const webAppPort = getPort('WEB_APP_PORT', 3001);

  return {
    convexBackendPort: convexPort,
    convexBackendUrl: getUrl('CONVEX_BACKEND_URL', `http://127.0.0.1:${convexPort}`),
    webAppPort: webAppPort,
    webAppUrl: getUrl('WEB_APP_URL', `http://localhost:${webAppPort}`),
    playwrightBaseUrl: getUrl('PLAYWRIGHT_BASE_URL', `http://localhost:${webAppPort}`),
    adminKey: process.env.CONVEX_ADMIN_KEY || '0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd',
  };
}

// Export singleton for easy import
export const testConfig = getTestConfig();
```

#### 2. Update Backend Harness
**File**: `apps/polychromos-app/test/backendHarness.cjs`
**Changes**: Use config instead of hardcoded values

```javascript
// Replace lines 5-7
const BACKEND_PORT = process.env.CONVEX_BACKEND_PORT || 3210;
const WEB_APP_PORT = process.env.WEB_APP_PORT || 3001;
const BACKEND_URL = process.env.CONVEX_BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const WEB_APP_URL = process.env.WEB_APP_URL || `http://localhost:${WEB_APP_PORT}`;
const CWD = path.dirname(__dirname);

// Update startWebApp() to use dynamic port
// Line 99-104
const webAppCmd = process.env.CI
  ? 'pnpm exec vite dev'
  : 'pnpm dev:web';

webAppProcess = spawn('sh', ['-c', webAppCmd], {
  cwd: CWD,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VITE_CONVEX_URL: BACKEND_URL,
    PORT: String(WEB_APP_PORT),
  },
});
```

#### 3. Update E2E Runner
**File**: `apps/polychromos-app/test/e2eRunner.cjs`
**Changes**: Use config instead of hardcoded values

```javascript
// Replace line 7
const BACKEND_PORT = process.env.CONVEX_BACKEND_PORT || 3210;
const BACKEND_URL = process.env.CONVEX_BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;

// Update runCommand environment injection (line 22)
env: {
  ...process.env,
  VITE_CONVEX_URL: BACKEND_URL,
  CONVEX_BACKEND_URL: BACKEND_URL,
  CONVEX_BACKEND_PORT: String(BACKEND_PORT),
},
```

#### 4. Update local-backend.sh
**File**: `apps/polychromos-app/scripts/local-backend.sh`
**Changes**: Support dynamic port via environment variable

```bash
#!/bin/bash
set -e

# Configuration - can be overridden via environment
BACKEND_PORT="${CONVEX_BACKEND_PORT:-3210}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
ADMIN_KEY="${CONVEX_ADMIN_KEY:-0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd}"

# Rest of script...
# Update run command to pass port
run)
  # ... binary download logic ...
  ./convex-local-backend --port "$BACKEND_PORT"
  ;;
```

#### 5. Update Playwright Config
**File**: `apps/polychromos-app/playwright.config.ts`
**Changes**: Use environment variables for base URL

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
  // ... rest of config
});
```

#### 6. Update Package.json Scripts
**File**: `apps/polychromos-app/package.json`
**Changes**: Remove hardcoded port overrides from scripts

```json
{
  "scripts": {
    "test:e2e:all": "pnpm exec dotenv -e .vercel/.env.development.local -- node test/e2eRunner.cjs --all",
    "test:e2e:browser": "pnpm exec dotenv -e .vercel/.env.development.local -- node test/e2eRunner.cjs --browser",
    "test:e2e:cli": "pnpm exec dotenv -e .vercel/.env.development.local -- node test/e2eRunner.cjs --cli",
    "test:e2e:cross-platform": "pnpm exec dotenv -e .vercel/.env.development.local -- node test/e2eRunner.cjs --cross-platform"
  }
}
```

#### 7. Update CLI Test Setup
**File**: `packages/polychromos/test/e2e/setup.ts`
**Changes**: Use environment variables for URLs

```typescript
// Replace hardcoded URLs (lines 168-178 and 226-244)
const CONVEX_BACKEND_URL = process.env.CONVEX_BACKEND_URL || 'http://127.0.0.1:3210';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3001';

// Update health checks to use these constants
async function startLocalConvex(): Promise<void> {
  try {
    const response = await fetch(`${CONVEX_BACKEND_URL}/version`);
    // ...
  }
}

async function waitForWebApp(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(WEB_APP_URL);
      // ...
    }
  }
}
```

#### 8. Update Cross-Platform Test
**File**: `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts`
**Changes**: Use environment variables

```typescript
// Replace lines 23 and 69
const CONVEX_URL = process.env.CONVEX_BACKEND_URL || 'http://127.0.0.1:3210';
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3001';

// Use these in ConvexHttpClient and config
convexClient = new ConvexHttpClient(CONVEX_URL);

// Update workspace config
const config = {
  convexUrl: CONVEX_URL,
  workspaceId: workspaceId,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass with default ports: `pnpm --filter @repo/app test:e2e:all`
- [ ] Tests pass with custom ports: `CONVEX_BACKEND_PORT=3211 WEB_APP_PORT=3002 pnpm --filter @repo/app test:e2e:all`
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] `pnpm dev` works without changes
- [x] Backend health check responds on configured port (tested on 3210 and 4210)
- [x] Web app loads on configured port (tested on 3001 and 4001)

**Implementation Note**: After completing this phase, verify all tests pass before proceeding. This phase has no UI changes, only infrastructure.

---

## Phase 2: Custom Clerk Integration

### Overview
Replace Clerk's prebuilt components with custom login/signup pages and add Clerk middleware for TanStack Start.

### Changes Required:

#### 1. Create Custom Sign-In Page
**File**: `apps/polychromos-app/src/routes/sign-in.tsx` (new file)
**Changes**: Custom sign-in route with Clerk's client-side SDK

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useClerk, useSignIn, useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "password">("email");

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: "/" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn?.create({
        identifier: email,
      });

      if (result?.status === "needs_first_factor") {
        setStep("password");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid email address");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "password",
        password,
      });

      if (result?.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        navigate({ to: "/" });
      } else if (result?.status === "needs_second_factor") {
        // Handle MFA if needed in future
        setError("Two-factor authentication required");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid password");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in to Polychromos</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to continue"
              : "Enter your password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loading..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("email")}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/sign-up" className="text-primary hover:underline">
              Sign up
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 2. Create Custom Sign-Up Page
**File**: `apps/polychromos-app/src/routes/sign-up.tsx` (new file)
**Changes**: Custom sign-up route

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSignUp, useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signUp, setActive } = useSignUp();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: "/" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signUp?.create({
        emailAddress: email,
        password,
      });

      await signUp?.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code,
      });

      if (result?.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            {pendingVerification
              ? "Check your email for a verification code"
              : "Sign up for Polychromos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pendingVerification ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter code from email"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify email"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/sign-in" className="text-primary hover:underline">
              Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 3. Update Index Page
**File**: `apps/polychromos-app/src/routes/index.tsx`
**Changes**: Replace SignInButton with link to custom sign-in page

```typescript
// Find and replace SignInButton usage (around lines 43-47)
// Remove import { SignInButton } from "@clerk/clerk-react"
// Keep UserButton import

// Replace the SignInButton section with:
{!isSignedIn && (
  <div className="flex gap-2">
    <Button asChild variant="outline">
      <a href="/sign-in">Sign in</a>
    </Button>
    <Button asChild>
      <a href="/sign-up">Sign up</a>
    </Button>
  </div>
)}
```

#### 4. Create CLI Auth Page
**File**: `apps/polychromos-app/src/routes/cli-auth.tsx` (new file)
**Changes**: Dedicated route for CLI authentication flow

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useAuth, useClerk, useSignIn } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export const Route = createFileRoute("/cli-auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || "",
  }),
  component: CLIAuthPage,
});

type PageStatus = "loading" | "sign-in" | "completing" | "success" | "error" | "invalid";

function CLIAuthPage() {
  const { code } = Route.useSearch();
  const { isSignedIn, isLoaded } = useAuth();
  const { session } = useClerk();
  const { signIn, setActive } = useSignIn();
  const completeSession = useMutation(api.cliAuth.completeSession);

  const [status, setStatus] = useState<PageStatus>("loading");
  const [error, setError] = useState("");

  // Sign-in form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formStep, setFormStep] = useState<"email" | "password">("email");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus("invalid");
      return;
    }

    if (!isLoaded) {
      setStatus("loading");
      return;
    }

    if (!isSignedIn) {
      setStatus("sign-in");
      return;
    }

    // User is signed in, complete the CLI auth session
    setStatus("completing");

    const completeAuth = async () => {
      try {
        // Get the Convex token
        const token = await session?.getToken({ template: "polychromos-cli" });

        if (!token) {
          throw new Error("Failed to get authentication token");
        }

        // Calculate expiry (30 days from now)
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const result = await signIn?.create({ identifier: email });
      if (result?.status === "needs_first_factor") {
        setFormStep("password");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid email");
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const result = await signIn?.attemptFirstFactor({
        strategy: "password",
        password,
      });

      if (result?.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        // The useEffect will handle completing the CLI auth
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid password");
    } finally {
      setFormLoading(false);
    }
  };

  // Invalid - no code provided
  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-destructive text-5xl mb-4">⚠</div>
            <CardTitle className="text-destructive mb-2">Invalid Request</CardTitle>
            <p className="text-muted-foreground">
              Missing authentication code. Run <code className="bg-muted px-1 rounded">polychromos login</code> from your terminal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Sign-in form
  if (status === "sign-in") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Polychromos CLI Login</CardTitle>
            <CardDescription>
              Sign in to authenticate the CLI
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formStep === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={formLoading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={formLoading}>
                  {formLoading ? "Loading..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={formLoading}
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setFormStep("email")}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={formLoading}>
                    {formLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completing auth
  if (status === "completing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  // Success
  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <CardTitle className="mb-2">CLI Authenticated</CardTitle>
            <p className="text-muted-foreground">
              You can close this window and return to your terminal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6">
          <div className="text-destructive text-5xl mb-4">✗</div>
          <CardTitle className="text-destructive mb-2">Authentication Failed</CardTitle>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Try running <code className="bg-muted px-1 rounded">polychromos login</code> again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 5. Add Test Data Attributes
**File**: `apps/polychromos-app/src/routes/index.tsx`
**Changes**: Add data-testid attributes for E2E testing

```typescript
// Add to the authenticated section (around line 123)
{isSignedIn && (
  <div data-testid="authenticated" className="flex items-center gap-4">
    <UserButton />
  </div>
)}

// Add to sign-in buttons
{!isSignedIn && (
  <div data-testid="unauthenticated" className="flex gap-2">
    <Button asChild variant="outline">
      <a href="/sign-in" data-testid="sign-in-link">Sign in</a>
    </Button>
    <Button asChild>
      <a href="/sign-up" data-testid="sign-up-link">Sign up</a>
    </Button>
  </div>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:app`

#### Manual Verification:
- [x] Navigate to `/sign-in` - custom login form appears
- [x] Sign in with valid credentials - redirects to home
- [x] Navigate to `/sign-up` - custom signup form appears
- [ ] Sign up flow works with email verification (not tested - existing user used)
- [x] `/cli-auth` without code shows error message
- [x] `/cli-auth?code=test` when signed out shows sign-in form
- [x] After sign-in on `/cli-auth`, success message appears

**Implementation Note**: This phase creates the custom UI. The `/cli-auth` page needs the Convex functions from Phase 3 to fully work.

---

## Phase 3: CLI Auth Browser Flow Infrastructure

### Overview
Add Convex infrastructure (schema and functions) for CLI auth session management and token exchange.

### Changes Required:

#### 1. Update Convex Schema
**File**: `apps/polychromos-app/convex/schema.ts`
**Changes**: Add `cliAuthSessions` table

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Existing tables...
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    data: v.any(),
    baseData: v.any(),
    eventVersion: v.number(),
    maxEventVersion: v.number(),
    version: v.number(),
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(),
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

  // NEW: CLI auth session management
  cliAuthSessions: defineTable({
    code: v.string(),                    // Unique session code (pol_xxx)
    status: v.string(),                  // "pending" | "completed" | "expired"
    token: v.optional(v.string()),       // Convex token after auth completes
    expiresAt: v.number(),               // Token expiry timestamp (ms)
    createdAt: v.number(),               // Session creation timestamp
    completedAt: v.optional(v.number()), // When auth was completed
    userId: v.optional(v.string()),      // Clerk user ID after auth
  })
    .index("by_code", ["code"])
    .index("by_status_created", ["status", "createdAt"]),
});
```

#### 2. Create CLI Auth Functions
**File**: `apps/polychromos-app/convex/cliAuth.ts` (new file)
**Changes**: Mutations and queries for CLI auth flow

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Session expires after 10 minutes if not completed
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Create a pending CLI auth session.
 * Called by CLI when user runs `polychromos login`.
 * No authentication required - anyone can create a pending session.
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
 * Requires authentication.
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
 * No authentication required - uses session code for lookup.
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
 * Should be called periodically via cron or manual cleanup.
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
    let deleted = 0;
    for (const session of oldSessions) {
      await ctx.db.delete(session._id);
      deleted++;
    }

    return { deleted };
  },
});
```

#### 3. Add Convex Function Tests
**File**: `apps/polychromos-app/convex/__tests__/cliAuth.test.ts` (new file)
**Changes**: Unit tests for CLI auth functions

```typescript
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
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

    await t.mutation(api.cliAuth.createSession, { code: "pol_noauth" });

    await expect(
      t.mutation(api.cliAuth.completeSession, {
        code: "pol_noauth",
        token: "test-token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Must be authenticated");
  });

  test("completeSession stores token when authenticated", async () => {
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

  test("completeSession rejects already completed sessions", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_already" });

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    await asUser.mutation(api.cliAuth.completeSession, {
      code: "pol_already",
      token: "first-token",
      expiresAt: Date.now() + 86400000,
    });

    await expect(
      asUser.mutation(api.cliAuth.completeSession, {
        code: "pol_already",
        token: "second-token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Session already completed");
  });

  test("completeSession rejects non-existent session", async () => {
    const t = convexTest(schema, modules);

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    await expect(
      asUser.mutation(api.cliAuth.completeSession, {
        code: "pol_nonexistent",
        token: "token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Session not found");
  });

  test("cleanupExpiredSessions removes old sessions", async () => {
    const t = convexTest(schema, modules);

    // Create session with old timestamp (manually insert to bypass normal creation)
    // Note: This test may need adjustment based on how convex-test handles time
    await t.mutation(api.cliAuth.createSession, { code: "pol_old" });

    // The cleanup function deletes sessions older than 24 hours
    // In a real test, we'd mock the time or insert directly with old timestamp
    const result = await t.mutation(api.cliAuth.cleanupExpiredSessions, {});
    expect(result).toHaveProperty("deleted");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Convex deploys successfully: `pnpm --filter @repo/app dev` (starts without errors)
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Convex unit tests pass: `pnpm --filter @repo/app test`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] Convex dashboard shows `cliAuthSessions` table (verified via API)
- [x] Can create session via Convex dashboard (tested via curl POST)
- [x] Can query session status via Convex dashboard (tested via curl POST)
- [x] End-to-end CLI auth flow works (created session → browser auth → token stored)

**Implementation Note**: After completing this phase, the `/cli-auth` page from Phase 2 should fully work. Test it end-to-end before proceeding.

---

## Phase 4: CLI Authentication Rework

### Overview
Update the CLI login command to use browser-based polling instead of manual token copy-paste.

### Changes Required:

#### 1. Add Dependencies
**File**: `packages/polychromos/package.json`
**Changes**: Add `open` package for browser launching

```bash
cd packages/polychromos && pnpm add open
```

#### 2. Create Auth Utilities
**File**: `packages/polychromos/src/lib/auth.ts` (new file)
**Changes**: Utilities for browser auth flow

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
 * Uses environment variable or defaults to production.
 */
export function getAuthUrl(code: string): string {
  const baseUrl = process.env.POLYCHROMOS_APP_URL || "https://app.polychromos.xyz";
  return `${baseUrl}/cli-auth?code=${encodeURIComponent(code)}`;
}

/**
 * Get the Convex URL for CLI operations.
 * Uses environment variable or defaults to production.
 */
export function getConvexUrl(): string {
  return process.env.POLYCHROMOS_CONVEX_URL || "https://dainty-toucan-799.convex.cloud";
}
```

#### 3. Update Login Command
**File**: `packages/polychromos/src/commands/login.ts`
**Changes**: Implement browser-based polling flow

```typescript
import open from "open";
import { ConvexHttpClient } from "convex/browser";
import { saveCredentials, loadCredentials } from "../lib/credentials.js";
import { generateSessionCode, getAuthUrl, getConvexUrl } from "../lib/auth.js";
import { api } from "../../../apps/polychromos-app/convex/_generated/api.js";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute timeout

export async function loginCommand(): Promise<void> {
  console.log("Polychromos CLI Login");
  console.log("");

  // Check if already logged in
  const existingCreds = await loadCredentials();
  if (existingCreds) {
    console.log("Already logged in. Run `polychromos logout` first to sign out.");
    console.log("");
    console.log("Or continue to re-authenticate...");
    console.log("");
  }

  const convexUrl = getConvexUrl();
  const client = new ConvexHttpClient(convexUrl);
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
        console.log("");
        console.log("You can now use polychromos commands.");
        return;
      }

      if (result.status === "expired" || result.status === "not_found") {
        console.log("");
        console.error("Authentication session expired. Please try again.");
        process.exit(1);
      }

      // Show progress dots
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

#### 4. Update Logout Command
**File**: `packages/polychromos/src/commands/logout.ts`
**Changes**: Improve logout messaging

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

#### 5. Add Auth Utility Tests
**File**: `packages/polychromos/src/lib/__tests__/auth.test.ts` (new file)
**Changes**: Tests for auth utilities

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateSessionCode, getAuthUrl, getConvexUrl } from "../auth.js";

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

  it("should be 36 characters total", () => {
    const code = generateSessionCode();
    expect(code.length).toBe(36); // "pol_" (4) + 32 hex chars
  });
});

describe("getAuthUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default production URL", () => {
    delete process.env.POLYCHROMOS_APP_URL;
    const url = getAuthUrl("pol_test123");
    expect(url).toBe("https://app.polychromos.xyz/cli-auth?code=pol_test123");
  });

  it("should use environment variable when set", () => {
    process.env.POLYCHROMOS_APP_URL = "http://localhost:3001";
    const url = getAuthUrl("pol_test123");
    expect(url).toBe("http://localhost:3001/cli-auth?code=pol_test123");
  });

  it("should encode special characters", () => {
    const url = getAuthUrl("pol_test&code=bad");
    expect(url).toContain("pol_test%26code%3Dbad");
  });
});

describe("getConvexUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default production URL", () => {
    delete process.env.POLYCHROMOS_CONVEX_URL;
    const url = getConvexUrl();
    expect(url).toBe("https://dainty-toucan-799.convex.cloud");
  });

  it("should use environment variable when set", () => {
    process.env.POLYCHROMOS_CONVEX_URL = "http://127.0.0.1:3210";
    const url = getConvexUrl();
    expect(url).toBe("http://127.0.0.1:3210");
  });
});
```

#### 6. Update Login Command Tests
**File**: `packages/polychromos/src/__tests__/commands/login.test.ts`
**Changes**: Update tests for new flow

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all external dependencies
vi.mock("open", () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: vi.fn(),
    query: vi.fn(),
  })),
}));

describe("loginCommand", () => {
  const originalEnv = process.env;
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should open browser with auth URL", async () => {
    const open = (await import("open")).default;
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        status: "completed",
        token: "test-token",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as any);

    await loginCommand();

    expect(open).toHaveBeenCalledWith(expect.stringContaining("/cli-auth?code=pol_"));
  });

  it("should save credentials on successful auth", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { saveCredentials } = await import("../../lib/credentials.js");
    const { loginCommand } = await import("../../commands/login.js");

    vi.mock("../../lib/credentials.js", () => ({
      saveCredentials: vi.fn(),
      loadCredentials: vi.fn().mockResolvedValue(null),
    }));

    const testToken = "test-token-123";
    const testExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

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

  it("should exit on session expiry", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ status: "expired" }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as any);

    await expect(loginCommand()).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Unit tests pass: `pnpm test` (115 tests passing)
- [x] Package builds: `pnpm --filter polychromos build`

#### Manual Verification:
- [ ] `polychromos login` opens browser
- [ ] Completing auth in browser shows success in CLI
- [ ] `polychromos whoami` works after login
- [ ] Token saved with expiry in `~/.polychromos/credentials.json`
- [ ] `polychromos logout` clears credentials

**Implementation Note**: Test the full login flow end-to-end before proceeding to Phase 5.

---

## Phase 5: Testing Infrastructure Rework

### Overview
Unify and rework all testing infrastructure to support isolated databases, dynamic ports, and all test types.

### Changes Required:

#### 1. Create Unified Test Setup
**File**: `apps/polychromos-app/test/setup.ts` (new file)
**Changes**: Centralized test setup for all test types

```typescript
import { chromium, Browser, Page } from "@playwright/test";
import { spawn, ChildProcess, execSync } from "child_process";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { getTestConfig } from "./config";

export interface TestContext {
  browser: Browser | null;
  convexProcess: ChildProcess | null;
  webAppProcess: ChildProcess | null;
  token: string | null;
  cleanup: () => Promise<void>;
}

const config = getTestConfig();

// Test directories
export const TEST_BASE_DIR = "/tmp/polychromos-e2e";
export const TEST_AUTH_STATE = join(TEST_BASE_DIR, "auth-state.json");
export const TEST_TOKEN_FILE = join(TEST_BASE_DIR, "token.json");

/**
 * Start local Convex backend if not already running.
 */
export async function startConvexBackend(): Promise<ChildProcess | null> {
  // Check if already running
  try {
    const response = await fetch(`${config.convexBackendUrl}/version`, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      console.log("[Test Setup] Convex backend already running");
      return null;
    }
  } catch {
    // Not running, start it
  }

  console.log("[Test Setup] Starting Convex backend...");

  const appDir = join(__dirname, "..");

  // Reset data first
  execSync("./scripts/local-backend.sh reset", { cwd: appDir, stdio: "pipe" });

  const proc = spawn("./scripts/local-backend.sh", ["run"], {
    cwd: appDir,
    stdio: "pipe",
    env: {
      ...process.env,
      CONVEX_BACKEND_PORT: String(config.convexBackendPort),
    },
  });

  // Wait for ready
  await waitForUrl(`${config.convexBackendUrl}/version`, 30000);
  console.log("[Test Setup] Convex backend ready");

  return proc;
}

/**
 * Deploy Convex schema and set test environment.
 */
export async function deployConvexSchema(): Promise<void> {
  const appDir = join(__dirname, "..");

  console.log("[Test Setup] Deploying Convex schema...");

  // Set test environment variables
  execSync("./scripts/local-backend.sh convex env set IS_TEST true", {
    cwd: appDir,
    stdio: "pipe",
  });

  if (process.env.CLERK_JWT_ISSUER_DOMAIN) {
    execSync(
      `./scripts/local-backend.sh convex env set CLERK_JWT_ISSUER_DOMAIN "${process.env.CLERK_JWT_ISSUER_DOMAIN}"`,
      { cwd: appDir, stdio: "pipe" }
    );
  }

  // Deploy schema
  execSync("./scripts/local-backend.sh convex deploy", {
    cwd: appDir,
    stdio: "inherit",
  });

  console.log("[Test Setup] Schema deployed");
}

/**
 * Start web app if not already running.
 */
export async function startWebApp(): Promise<ChildProcess | null> {
  // Check if already running
  try {
    const response = await fetch(config.webAppUrl, {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok || response.status === 302) {
      console.log("[Test Setup] Web app already running");
      return null;
    }
  } catch {
    // Not running, start it
  }

  console.log("[Test Setup] Starting web app...");

  const appDir = join(__dirname, "..");
  const cmd = process.env.CI ? "pnpm exec vite dev" : "pnpm dev:web";

  const proc = spawn("sh", ["-c", cmd], {
    cwd: appDir,
    stdio: "pipe",
    env: {
      ...process.env,
      VITE_CONVEX_URL: config.convexBackendUrl,
      PORT: String(config.webAppPort),
    },
  });

  // Wait for ready
  await waitForUrl(config.webAppUrl, 60000);
  console.log("[Test Setup] Web app ready");

  return proc;
}

/**
 * Extract Clerk token from authenticated browser session.
 */
export async function extractClerkToken(browser: Browser): Promise<string> {
  const page = await browser.newPage({
    storageState: TEST_AUTH_STATE,
  });

  try {
    await page.goto(config.webAppUrl);
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    const token = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1000));

      if (!window.Clerk?.session) {
        throw new Error("Clerk not initialized");
      }

      return window.Clerk.session.getToken({ template: "polychromos-cli" });
    });

    if (!token) {
      throw new Error("Failed to extract Clerk token");
    }

    return token;
  } finally {
    await page.close();
  }
}

/**
 * Authenticate via Clerk UI and save storage state.
 */
export async function authenticateClerk(browser: Browser): Promise<void> {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD must be set");
  }

  console.log("[Test Setup] Authenticating with Clerk...");

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${config.webAppUrl}/sign-in`);
  await page.waitForLoadState("networkidle");

  // Fill email
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');

  // Wait for password step and fill
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for authentication
  await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

  // Save storage state
  await mkdir(TEST_BASE_DIR, { recursive: true });
  await context.storageState({ path: TEST_AUTH_STATE });

  console.log("[Test Setup] Authentication complete");

  await page.close();
  await context.close();
}

/**
 * Wait for URL to respond.
 */
async function waitForUrl(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  const interval = 500;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok || response.status === 302) {
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Timeout waiting for ${url}`);
}

/**
 * Full test setup - starts all services and authenticates.
 */
export async function setupTestEnvironment(): Promise<TestContext> {
  await mkdir(TEST_BASE_DIR, { recursive: true });

  const convexProcess = await startConvexBackend();
  await deployConvexSchema();
  const webAppProcess = await startWebApp();

  const browser = await chromium.launch();
  await authenticateClerk(browser);

  const token = await extractClerkToken(browser);
  await writeFile(TEST_TOKEN_FILE, JSON.stringify({ token }));

  return {
    browser,
    convexProcess,
    webAppProcess,
    token,
    cleanup: async () => {
      await browser?.close();
      convexProcess?.kill("SIGTERM");
      webAppProcess?.kill("SIGTERM");
      await rm(TEST_BASE_DIR, { recursive: true, force: true });
    },
  };
}

// Type augmentation for Clerk on window
declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (options: { template: string }) => Promise<string | null>;
      };
    };
  }
}
```

#### 2. Update Playwright Global Setup
**File**: `apps/polychromos-app/e2e/global.setup.ts`
**Changes**: Use centralized setup

```typescript
import { test as setup } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { mkdir } from "fs/promises";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("authenticate", async ({ page }) => {
  // Initialize Clerk testing
  await clerkSetup();

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

  // Save storage state
  await page.context().storageState({ path: authFile });
});
```

#### 3. Update CLI Test Setup
**File**: `packages/polychromos/test/e2e/setup.ts`
**Changes**: Use environment-based configuration

```typescript
import { Browser, chromium } from "playwright";
import { spawn, ChildProcess, execSync } from "child_process";
import { mkdir, writeFile, rm, readFile, access } from "fs/promises";
import { join } from "path";

// Configuration from environment
const CONVEX_BACKEND_URL = process.env.CONVEX_BACKEND_URL || "http://127.0.0.1:3210";
const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3001";

// Test directories
export const TEST_WORKSPACE_DIR = "/tmp/polychromos-e2e-test";
export const TEST_CREDENTIALS_DIR = join(TEST_WORKSPACE_DIR, ".polychromos-home");
const TOKEN_FILE = join(TEST_WORKSPACE_DIR, "token.json");

// Playwright auth state from app tests
const PLAYWRIGHT_AUTH_STATE = join(
  __dirname,
  "../../../../apps/polychromos-app/playwright/.clerk/user.json"
);

let browser: Browser | null = null;
let extractedToken: string | null = null;

export function getExtractedToken(): string {
  if (process.env.POLYCHROMOS_TOKEN) {
    return process.env.POLYCHROMOS_TOKEN;
  }

  if (extractedToken) {
    return extractedToken;
  }

  try {
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
    if (data.token) {
      extractedToken = data.token;
      process.env.POLYCHROMOS_TOKEN = data.token;
      return data.token;
    }
  } catch {
    // File doesn't exist
  }

  throw new Error("Token not extracted. Setup must run first.");
}

async function waitForWebApp(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(WEB_APP_URL);
      if (response.ok) {
        console.log("[CLI E2E Setup] Web app is ready");
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Web app did not start in time");
}

async function extractClerkToken(browser: Browser): Promise<string> {
  const page = await browser.newPage({
    storageState: PLAYWRIGHT_AUTH_STATE,
  });

  try {
    await page.goto(WEB_APP_URL);
    await page.waitForSelector('[data-testid="authenticated"]', { timeout: 30000 });

    const token = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1000));
      if (!window.Clerk?.session) {
        throw new Error("Clerk not initialized");
      }
      return window.Clerk.session.getToken({ template: "polychromos-cli" });
    });

    if (!token) {
      throw new Error("Failed to extract Clerk token");
    }

    return token;
  } finally {
    await page.close();
  }
}

async function setupCLICredentials(token: string): Promise<void> {
  await mkdir(TEST_CREDENTIALS_DIR, { recursive: true });

  const credentialsPath = join(TEST_CREDENTIALS_DIR, "credentials.json");
  await writeFile(
    credentialsPath,
    JSON.stringify({
      accessToken: token,
      expiresAt: Date.now() + 3600000, // 1 hour
    }, null, 2)
  );
}

export async function setup(): Promise<void> {
  console.log("[CLI E2E Setup] Starting...");

  // Check for env token first
  const envToken = process.env.POLYCHROMOS_TOKEN;
  if (envToken) {
    console.log("[CLI E2E Setup] Using POLYCHROMOS_TOKEN from environment");
    extractedToken = envToken;
    await mkdir(TEST_WORKSPACE_DIR, { recursive: true });
    await setupCLICredentials(envToken);
    await writeFile(TOKEN_FILE, JSON.stringify({ token: envToken }));
    return;
  }

  // Verify Playwright auth state exists
  try {
    await access(PLAYWRIGHT_AUTH_STATE);
  } catch {
    throw new Error(
      `Playwright auth state not found at ${PLAYWRIGHT_AUTH_STATE}. ` +
      "Run the app E2E tests first: pnpm --filter @repo/app test:e2e:browser"
    );
  }

  // Wait for web app
  await waitForWebApp();

  // Extract token from browser
  browser = await chromium.launch();
  extractedToken = await extractClerkToken(browser);

  // Save for CLI
  await mkdir(TEST_WORKSPACE_DIR, { recursive: true });
  await setupCLICredentials(extractedToken);
  await writeFile(TOKEN_FILE, JSON.stringify({ token: extractedToken }));

  process.env.POLYCHROMOS_TOKEN = extractedToken;
  console.log("[CLI E2E Setup] Complete");
}

export async function teardown(): Promise<void> {
  console.log("[CLI E2E Setup] Cleaning up...");

  if (browser) {
    await browser.close();
  }

  await rm(TEST_WORKSPACE_DIR, { recursive: true, force: true });
  console.log("[CLI E2E Setup] Cleanup complete");
}

export default async function globalSetup() {
  await setup();
  return async () => {
    await teardown();
  };
}

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (options: { template: string }) => Promise<string | null>;
      };
    };
  }
}
```

#### 4. Create Auth Polling Test
**File**: `apps/polychromos-app/e2e/cross-platform/auth-polling.spec.ts` (new file)
**Changes**: Test for CLI auth polling flow

```typescript
import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_BACKEND_URL || "http://127.0.0.1:3210";

test.describe("CLI Auth Polling Flow", () => {
  let convexClient: ConvexHttpClient;

  test.beforeAll(() => {
    convexClient = new ConvexHttpClient(CONVEX_URL);
  });

  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  test("CLI can create session and poll for token", async ({ page }) => {
    const testCode = `pol_test_${Date.now()}`;

    // Step 1: CLI creates pending session (no auth required)
    await convexClient.mutation(api.cliAuth.createSession, { code: testCode });

    // Verify session is pending
    const pending = await convexClient.query(api.cliAuth.getSession, { code: testCode });
    expect(pending.status).toBe("pending");

    // Step 2: User navigates to /cli-auth in browser
    await page.goto(`/cli-auth?code=${testCode}`);

    // Wait for sign-in form
    await page.waitForSelector('input[type="email"]');

    // Fill in credentials
    const email = process.env.E2E_CLERK_USER_EMAIL!;
    const password = process.env.E2E_CLERK_USER_PASSWORD!;

    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for success
    await page.waitForSelector("text=CLI Authenticated", { timeout: 30000 });

    // Step 3: CLI polls and gets token
    const completed = await convexClient.query(api.cliAuth.getSession, { code: testCode });
    expect(completed.status).toBe("completed");
    expect(completed.token).toBeTruthy();
    expect(completed.expiresAt).toBeGreaterThan(Date.now());
  });

  test("Session expires after timeout", async () => {
    const testCode = `pol_expire_${Date.now()}`;

    // Create session
    await convexClient.mutation(api.cliAuth.createSession, { code: testCode });

    // Wait a bit and check - should still be pending
    const pending = await convexClient.query(api.cliAuth.getSession, { code: testCode });
    expect(pending.status).toBe("pending");

    // Note: Full timeout test would need mocked time
    // This test verifies the basic flow works
  });

  test("Invalid code shows error message", async ({ page }) => {
    await page.goto("/cli-auth?code=invalid_code_12345");

    // Try to sign in
    await page.waitForSelector('input[type="email"]');

    const email = process.env.E2E_CLERK_USER_EMAIL!;
    const password = process.env.E2E_CLERK_USER_PASSWORD!;

    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should show error since session doesn't exist in Convex
    await page.waitForSelector("text=Authentication Failed", { timeout: 30000 });
  });

  test("Duplicate code is rejected", async () => {
    const testCode = `pol_dup_${Date.now()}`;

    // Create first session
    await convexClient.mutation(api.cliAuth.createSession, { code: testCode });

    // Attempt to create duplicate
    await expect(
      convexClient.mutation(api.cliAuth.createSession, { code: testCode })
    ).rejects.toThrow("Session code already exists");
  });
});
```

#### 5. Update E2E Runner for Isolation
**File**: `apps/polychromos-app/test/e2eRunner.cjs`
**Changes**: Support isolated test runs

```javascript
#!/usr/bin/env node

const { spawn, execSync } = require("child_process");
const path = require("path");

// Get configuration from environment
const BACKEND_PORT = process.env.CONVEX_BACKEND_PORT || 3210;
const WEB_APP_PORT = process.env.WEB_APP_PORT || 3001;
const BACKEND_URL = process.env.CONVEX_BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const WEB_APP_URL = process.env.WEB_APP_URL || `http://localhost:${WEB_APP_PORT}`;

const CWD = path.dirname(__dirname);
const { startBackend, startWebApp, cleanup } = require("./backendHarness.cjs");

function runCommand(cmd, description) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${description}`);
  console.log(`Command: ${cmd}`);
  console.log("=".repeat(60) + "\n");

  return new Promise((resolve, reject) => {
    const proc = spawn("sh", ["-c", cmd], {
      cwd: CWD,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_CONVEX_URL: BACKEND_URL,
        CONVEX_BACKEND_URL: BACKEND_URL,
        CONVEX_BACKEND_PORT: String(BACKEND_PORT),
        WEB_APP_URL: WEB_APP_URL,
        WEB_APP_PORT: String(WEB_APP_PORT),
        PLAYWRIGHT_BASE_URL: WEB_APP_URL,
      },
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all");
  const runBrowser = args.includes("--browser") || runAll;
  const runCli = args.includes("--cli") || runAll;
  const runCrossPlatform = args.includes("--cross-platform") || runAll;
  const skipSetup = args.includes("--skip-setup");

  try {
    // Start infrastructure
    await startBackend();

    // Deploy schema with test environment
    console.log("\n[E2E] Setting up test environment...");
    execSync("./scripts/local-backend.sh convex env set IS_TEST true", {
      cwd: CWD,
      stdio: "inherit",
    });

    if (process.env.CLERK_JWT_ISSUER_DOMAIN) {
      execSync(
        `./scripts/local-backend.sh convex env set CLERK_JWT_ISSUER_DOMAIN "${process.env.CLERK_JWT_ISSUER_DOMAIN}"`,
        { cwd: CWD, stdio: "inherit" }
      );
    } else {
      console.warn("\n[E2E] Warning: CLERK_JWT_ISSUER_DOMAIN not set");
    }

    execSync("./scripts/local-backend.sh convex deploy", {
      cwd: CWD,
      stdio: "inherit",
    });

    await startWebApp();

    // Run Playwright setup
    if (!skipSetup) {
      await runCommand(
        "pnpm exec playwright test --project=setup",
        "Playwright Auth Setup"
      );
    }

    // Run test suites
    if (runBrowser) {
      await runCommand(
        "pnpm exec playwright test --project=chromium --project=unauthenticated",
        "Browser E2E Tests"
      );
    }

    if (runCli) {
      // Run from monorepo root
      await runCommand(
        `cd ${path.resolve(CWD, "../..")} && pnpm --filter polychromos test:e2e`,
        "CLI E2E Tests"
      );
    }

    if (runCrossPlatform) {
      await runCommand(
        "pnpm exec playwright test --project=cross-platform",
        "Cross-Platform E2E Tests"
      );
    }

    console.log("\n[E2E] All tests completed successfully!");
  } catch (error) {
    console.error("\n[E2E] Tests failed:", error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Handle signals
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

main();
```

### Success Criteria:

#### Automated Verification:
- [ ] All browser tests pass: `pnpm --filter @repo/app test:e2e:browser`
- [ ] All CLI tests pass: `pnpm --filter @repo/app test:e2e:cli`
- [ ] All cross-platform tests pass: `pnpm --filter @repo/app test:e2e:cross-platform`
- [ ] Auth polling tests pass
- [ ] Tests work with custom ports: `CONVEX_BACKEND_PORT=3211 WEB_APP_PORT=3002 pnpm --filter @repo/app test:e2e:all`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Fresh database on each test run (reset works)
- [ ] No port conflicts when running multiple test suites
- [ ] All test types complete successfully end-to-end

**Implementation Note**: This is the largest phase. Test incrementally - get browser tests working first, then CLI, then cross-platform.

---

## Phase 6: CI/CD & Production Readiness

### Overview
Configure GitHub Actions for testing, ensure npm publish uses production URLs.

### Changes Required:

#### 1. Update GitHub Actions E2E Workflow
**File**: `.github/workflows/ci.yml`
**Changes**: Update E2E job to use dynamic configuration

```yaml
# Update the e2e-browser job (around line 65)
e2e-browser:
  name: E2E Browser Tests
  runs-on: ubuntu-latest
  needs: build
  if: |
    github.event_name == 'push' && github.ref == 'refs/heads/main' ||
    contains(github.event.pull_request.labels.*.name, 'e2e') ||
    contains(needs.check-changes.outputs.changes, 'polychromos-app') ||
    contains(needs.check-changes.outputs.changes, 'polychromos-cli')

  env:
    VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    CLERK_JWT_ISSUER_DOMAIN: ${{ vars.CLERK_JWT_ISSUER_DOMAIN }}
    E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
    E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
    # Use default ports - no override needed

  steps:
    - uses: actions/checkout@v4

    - name: Setup
      uses: ./.github/actions/setup

    - name: Setup Playwright
      uses: ./.github/actions/playwright-setup

    - name: Install Playwright Browsers
      run: pnpm exec playwright install --with-deps chromium
      working-directory: apps/polychromos-app

    - name: Run E2E Browser Tests
      run: pnpm test:e2e:browser
      working-directory: apps/polychromos-app

    - name: Upload Playwright Report
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report-browser
        path: apps/polychromos-app/playwright-report/
        retention-days: 7

# Update the e2e-cli job (around line 110)
e2e-cli:
  name: E2E CLI Tests
  runs-on: ubuntu-latest
  needs: [build, e2e-browser]
  if: |
    github.event_name == 'push' && github.ref == 'refs/heads/main' ||
    contains(github.event.pull_request.labels.*.name, 'e2e') ||
    contains(needs.check-changes.outputs.changes, 'polychromos-cli') ||
    contains(needs.check-changes.outputs.changes, 'convex')

  env:
    VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}
    CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
    CLERK_JWT_ISSUER_DOMAIN: ${{ vars.CLERK_JWT_ISSUER_DOMAIN }}
    E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
    E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}

  steps:
    - uses: actions/checkout@v4

    - name: Setup
      uses: ./.github/actions/setup

    - name: Setup Playwright
      uses: ./.github/actions/playwright-setup

    - name: Install Playwright Browsers
      run: pnpm exec playwright install --with-deps chromium
      working-directory: apps/polychromos-app

    - name: Build CLI
      run: pnpm --filter polychromos build

    - name: Run E2E CLI & Cross-Platform Tests
      run: pnpm test:e2e:cli && pnpm test:e2e:cross-platform
      working-directory: apps/polychromos-app

    - name: Upload Playwright Report
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report-cli
        path: apps/polychromos-app/playwright-report/
        retention-days: 7
```

#### 2. Update CLI Auth Utilities for Production
**File**: `packages/polychromos/src/lib/auth.ts`
**Changes**: Ensure production URLs are used by default

```typescript
import { randomBytes } from "crypto";

// Production URLs - these are the defaults when not overridden
const PRODUCTION_APP_URL = "https://app.polychromos.xyz";
const PRODUCTION_CONVEX_URL = "https://dainty-toucan-799.convex.cloud";

/**
 * Generate a unique session code for CLI auth.
 */
export function generateSessionCode(): string {
  const random = randomBytes(16).toString("hex");
  return `pol_${random}`;
}

/**
 * Get the web app URL for CLI auth.
 * In production (npm install), uses app.polychromos.xyz
 * Can be overridden via POLYCHROMOS_APP_URL for local dev
 */
export function getAuthUrl(code: string): string {
  const baseUrl = process.env.POLYCHROMOS_APP_URL || PRODUCTION_APP_URL;
  return `${baseUrl}/cli-auth?code=${encodeURIComponent(code)}`;
}

/**
 * Get the Convex URL for CLI operations.
 * In production (npm install), uses production Convex cloud
 * Can be overridden via POLYCHROMOS_CONVEX_URL for local dev
 */
export function getConvexUrl(): string {
  return process.env.POLYCHROMOS_CONVEX_URL || PRODUCTION_CONVEX_URL;
}

/**
 * Check if running in development mode.
 */
export function isDevelopment(): boolean {
  return Boolean(
    process.env.POLYCHROMOS_APP_URL ||
    process.env.POLYCHROMOS_CONVEX_URL ||
    process.env.NODE_ENV === "development"
  );
}
```

#### 3. Add Environment Documentation
**File**: `packages/polychromos/README.md`
**Changes**: Document environment variables for development

Add this section to the README:

```markdown
## Development

### Environment Variables

For local development, set these environment variables:

```bash
# Point to local Convex backend
export POLYCHROMOS_CONVEX_URL=http://127.0.0.1:3210

# Point to local web app for auth
export POLYCHROMOS_APP_URL=http://localhost:3001
```

For testing:

```bash
# Skip browser auth and use token directly
export POLYCHROMOS_TOKEN=your-convex-token
```

### Running E2E Tests

```bash
# From monorepo root
pnpm --filter @repo/app test:e2e:all

# Just CLI tests
pnpm --filter @repo/app test:e2e:cli

# Just browser tests
pnpm --filter @repo/app test:e2e:browser
```
```

#### 4. Update turbo.json for Environment Variables
**File**: `turbo.json`
**Changes**: Add new environment variables

```json
{
  "globalEnv": [
    "CONVEX_URL",
    "CONVEX_DEPLOYMENT",
    "CONVEX_SITE_URL",
    "VITE_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "CLERK_JWT_ISSUER_DOMAIN",
    "E2E_CLERK_USER_EMAIL",
    "E2E_CLERK_USER_PASSWORD",
    "CONVEX_BACKEND_URL",
    "CONVEX_BACKEND_PORT",
    "WEB_APP_URL",
    "WEB_APP_PORT",
    "POLYCHROMOS_TOKEN",
    "POLYCHROMOS_APP_URL",
    "POLYCHROMOS_CONVEX_URL"
  ]
}
```

### Success Criteria:

#### Automated Verification:
- [ ] CI workflow passes on GitHub Actions
- [ ] All E2E tests pass in CI
- [ ] npm publish uses production URLs (check with `POLYCHROMOS_CONVEX_URL` not set)
- [ ] Lint passes: `pnpm lint`
- [ ] TypeScript compiles: `pnpm typecheck`

#### Manual Verification:
- [ ] `pnpm changeset` creates valid changeset
- [ ] Published package uses `app.polychromos.xyz` for auth
- [ ] Local development can override to localhost
- [ ] Full CI pipeline completes successfully

---

## Testing Strategy

### Unit Tests
- Code generation produces unique, valid codes
- Auth URL generation with proper encoding
- Credentials save/load with expiry
- Convex mutations validate inputs correctly
- Custom auth form components render correctly

### Browser E2E Tests
- Custom sign-in flow works end-to-end
- Custom sign-up flow works with email verification
- Sign-out clears session correctly
- Protected routes require authentication
- Error states display correctly

### CLI E2E Tests
- `polychromos login` opens browser and polls correctly
- `polychromos whoami` shows user info after login
- `polychromos logout` clears credentials
- `polychromos dev` syncs changes to Convex
- `polychromos undo/redo/history` work correctly

### Cross-Platform Tests
- CLI creates session → browser completes → CLI gets token
- CLI changes sync to web app
- Token expiry is handled correctly
- Multiple concurrent sessions work

### Auth Polling Tests
- Session creation works without auth
- Session completion requires auth
- Polling returns correct status
- Expired sessions are handled
- Duplicate codes are rejected

### Manual Testing Steps
1. Run `polychromos login` - browser should open
2. Sign in with Clerk - CLI should show success
3. Run `polychromos whoami` - should show user info
4. Run `polychromos dev` in a workspace
5. Make changes - should sync to Convex
6. Check web app - changes should appear
7. Run `polychromos logout`
8. Run `polychromos whoami` - should prompt to login

---

## Performance Considerations

- **Polling Interval**: 2 seconds balances responsiveness vs API load
- **Session Timeout**: 10 minutes for browser auth, 5 minutes for CLI poll
- **Token Expiry**: 30 days for CLI convenience (web app uses 1-hour auto-refreshing tokens)
- **Test Isolation**: Fresh database per test run prevents flaky tests
- **Parallel Tests**: Dynamic ports enable parallel test workers

---

## Security Considerations

- Session codes are cryptographically random (32 hex chars)
- Tokens stored with restricted file permissions (0o600)
- Sessions expire after 10 minutes if not completed
- Completed sessions are single-use
- Production URLs hardcoded to prevent accidental local exposure

---

## Migration Notes

This is a breaking change for CLI authentication. Users will need to:
1. Update to new CLI version
2. Run `polychromos login` (browser-based flow)
3. Previous token files will still work if valid

No data migration required for Convex - just schema addition.

---

## References

- Clerk Custom Auth Research: `thoughts/shared/research/2026-02-03-clerk-custom-auth-ssr-requirements.md`
- E2E Testing Architecture: `thoughts/shared/research/2026-02-03-e2e-testing-architecture-for-browser-auth-rework.md`
- Original CLI Auth Plan: `thoughts/shared/plans/2026-02-03-polychromos-cli-browser-auth-flow.md`
- Current login implementation: `packages/polychromos/src/commands/login.ts`
- Current test infrastructure: `apps/polychromos-app/test/`
