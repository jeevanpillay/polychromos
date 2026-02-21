# Sentry End-to-End Setup Implementation Plan

## Overview

Implement Sentry error tracking and observability across the Polychromos CLI (`packages/polychromos`) and web application (`apps/polychromos-app`). This provides unified error visibility, performance monitoring for the web app, and proper telemetry consent handling for the CLI.

## Current State Analysis

### CLI (`packages/polychromos`)
- **Entry point**: `src/index.ts` - Commander.js CLI with 10 commands
- **Signal handling**: Only SIGINT handler in `dev.ts:211-214` - clears token refresh interval before exit
- **No telemetry**: No error tracking, analytics, or Sentry packages exist
- **Configuration**: `~/.polychromos/credentials.json` for auth, `.polychromos/config.json` for project config
- **Environment variables**: `POLYCHROMOS_TOKEN`, `POLYCHROMOS_APP_URL`, `POLYCHROMOS_CONVEX_URL`

### Web App (`apps/polychromos-app`)
- **Router**: `src/router.tsx` - TanStack Start with factory pattern
- **Error handling**: Inline error component (`<p>{err.error.stack}</p>`) at `router.tsx:46`
- **Providers**: ClerkProvider → ConvexProviderWithClerk → Router
- **No telemetry**: No Sentry or observability packages
- **Environment**: t3-env validation in `src/env.ts`

## Desired End State

### CLI
- Sentry SDK always initialized (unconditionally)
- Opt-out mechanism via `beforeSend` hook that checks user consent
- User consent stored in `~/.polychromos/config.json` (defaults to enabled)
- `POLYCHROMOS_TELEMETRY_DISABLED=1` environment variable opt-out
- `polychromos telemetry enable|disable|status` command for user control
- PII scrubbing for file paths containing usernames
- Error-only mode (no tracing for CLI)

### Web App
- Sentry SDK with TanStack Start integration
- Session replay (10% sample rate, 100% on error)
- Performance monitoring (10% sample rate)
- Browser tracing for Core Web Vitals
- Proper error boundary integration
- User context set with Clerk user ID (no PII)

### Verification
1. CLI: Trigger an error and verify it appears in Sentry dashboard (telemetry enabled by default)
2. CLI: Run `polychromos telemetry disable`, trigger error, verify no events sent
3. CLI: Run with `POLYCHROMOS_TELEMETRY_DISABLED=1` and verify no events sent
4. Web: Trigger an error and verify it appears with session replay
5. Web: Verify Core Web Vitals appear in Performance tab

## What We're NOT Doing

- Custom offline event buffering for CLI (not needed for alpha)
- Distributed tracing between CLI and Convex (not possible with managed backend)
- Source map uploads (Phase 2 - requires CI integration)
- Custom alert configuration (Phase 2)
- Cross-project dashboard setup (Phase 2)

## Implementation Approach

Two separate Sentry projects for platform-specific alerting:
1. `polychromos-cli` - CLI errors with Node.js context
2. `polychromos-app` - Web errors with browser context, replay, performance

---

## Phase 1: CLI Sentry Integration

### Overview
Add Sentry to the CLI with proper lifecycle management, consent flow, and telemetry command.

### Changes Required:

#### 1. Add Sentry dependency
**File**: `packages/polychromos/package.json`
**Changes**: Add `@sentry/node` to dependencies

```json
"dependencies": {
  "@polychromos/types": "workspace:*",
  "@sentry/node": "^9.0.0",
  "chokidar": "^3.6.0",
  ...
}
```

#### 2. Create Sentry initialization module
**File**: `packages/polychromos/src/lib/sentry.ts` (new file)
**Changes**: Create Sentry initialization (always enabled, opt-out via beforeSend)

```typescript
import * as Sentry from "@sentry/node";
import { isTelemetryEnabled } from "./telemetry-config.js";
import { getVersion } from "./version.js";

// Hardcoded Sentry DSN - this is NOT a secret, it's safe to be public
const SENTRY_DSN = "https://6381f2ec10a3ab36b1dea0b0cda769da@o4508333286948864.ingest.us.sentry.io/4510825143533569";

export function initSentry(): void {

  Sentry.init({
    dsn: SENTRY_DSN,
    release: `polychromos-cli@${getVersion()}`,
    environment: process.env.NODE_ENV || "production",
    // Error-only mode - no tracing for CLI
    beforeSend(event) {
      // Check opt-out: environment variable takes precedence
      if (process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1") {
        return null;
      }

      // Check user config
      if (!isTelemetryEnabled()) {
        return null;
      }

      // Scrub PII: file paths that might contain usernames
      if (event.exception?.values) {
        event.exception.values.forEach((exc) => {
          if (exc.stacktrace?.frames) {
            exc.stacktrace.frames.forEach((frame) => {
              if (frame.filename) {
                // Replace /Users/<username> or /home/<username> with anonymized path
                frame.filename = frame.filename
                  .replace(/\/Users\/[^/]+/g, "/Users/***")
                  .replace(/\/home\/[^/]+/g, "/home/***")
                  .replace(/C:\\Users\\[^\\]+/g, "C:\\Users\\***");
              }
            });
          }
        });
      }
      return event;
    },
  });
}

export async function closeSentry(): Promise<void> {
  await Sentry.close(2000);
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export function setUser(userId: string): void {
  Sentry.setUser({ id: userId });
}
```

#### 3. Create telemetry configuration module
**File**: `packages/polychromos/src/lib/telemetry-config.ts` (new file)
**Changes**: Handle telemetry consent storage and retrieval

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".polychromos");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface GlobalConfig {
  telemetryEnabled?: boolean;
  telemetryConsentAsked?: boolean;
}

export function loadTelemetryConfig(): GlobalConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return {};
    }
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content) as GlobalConfig;
  } catch {
    return {};
  }
}

export function saveTelemetryConfig(config: GlobalConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const existing = loadTelemetryConfig();
    const merged = { ...existing, ...config };
    writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch {
    // Silent failure - telemetry config is non-critical
  }
}

export function isTelemetryEnabled(): boolean {
  if (process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1") {
    return false;
  }
  const config = loadTelemetryConfig();
  // Enabled by default - users must explicitly opt out
  return config.telemetryEnabled ?? true;
}

export function hasAskedForConsent(): boolean {
  const config = loadTelemetryConfig();
  return config.telemetryConsentAsked ?? false;
}

export function setTelemetryEnabled(enabled: boolean): void {
  saveTelemetryConfig({
    telemetryEnabled: enabled,
    telemetryConsentAsked: true,
  });
}
```

#### 4. Create telemetry command
**File**: `packages/polychromos/src/commands/telemetry.ts` (new file)
**Changes**: Add telemetry management command

```typescript
import {
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../lib/telemetry-config.js";

export async function telemetryCommand(
  action: "enable" | "disable" | "status",
): Promise<void> {
  switch (action) {
    case "enable":
      setTelemetryEnabled(true);
      console.log("✓ Telemetry enabled. Thank you for helping improve Polychromos!");
      console.log("");
      console.log("We collect anonymous error reports to fix bugs and improve the CLI.");
      console.log("Learn more: https://polychromos.dev/telemetry");
      break;

    case "disable":
      setTelemetryEnabled(false);
      console.log("✓ Telemetry disabled. No data will be sent.");
      console.log("");
      console.log("You can re-enable anytime: polychromos telemetry enable");
      console.log("Or set: POLYCHROMOS_TELEMETRY_DISABLED=1");
      break;

    case "status":
      const envDisabled = process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1";
      const configEnabled = isTelemetryEnabled();

      console.log("Telemetry Status");
      console.log("━━━━━━━━━━━━━━━━");

      if (envDisabled) {
        console.log("Status: DISABLED (via POLYCHROMOS_TELEMETRY_DISABLED=1)");
      } else if (configEnabled) {
        console.log("Status: ENABLED (default)");
      } else {
        console.log("Status: DISABLED (via user preference)");
      }

      console.log("");
      console.log("Telemetry helps us improve Polychromos by collecting anonymous error reports.");
      console.log("To change: polychromos telemetry enable|disable");
      console.log("Learn more: https://polychromos.dev/telemetry");
      break;
  }
}
```

#### 5. Update CLI entry point
**File**: `packages/polychromos/src/index.ts`
**Changes**: Initialize Sentry early, add telemetry command, add exit handlers

```typescript
#!/usr/bin/env node
import { Command } from "commander";

// Initialize Sentry before anything else
import { initSentry, closeSentry } from "./lib/sentry.js";
initSentry();

import { checkpointCommand } from "./commands/checkpoint.js";
import { devCommand } from "./commands/dev.js";
import { exportCommand } from "./commands/export.js";
import { historyCommand } from "./commands/history.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { redoCommand } from "./commands/redo.js";
import { telemetryCommand } from "./commands/telemetry.js";
import { undoCommand } from "./commands/undo.js";
import { whoamiCommand } from "./commands/whoami.js";
import { getVersion } from "./lib/version.js";

const program = new Command();

program
  .name("polychromos")
  .description("Code-driven design platform CLI")
  .version(getVersion());

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

// Project commands
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

// Telemetry command
program
  .command("telemetry <action>")
  .description("Manage anonymous telemetry (enable|disable|status)")
  .action(telemetryCommand);

// Ensure Sentry flushes before exit
process.on("beforeExit", async () => {
  await closeSentry();
});

process.on("SIGTERM", async () => {
  await closeSentry();
  process.exit(0);
});

program.parse();
```

#### 6. Update dev command signal handling
**File**: `packages/polychromos/src/commands/dev.ts`
**Changes**: Add Sentry close to SIGINT handler

```typescript
// At the top of the file, add import
import { closeSentry, captureException } from "../lib/sentry.js";

// Update the SIGINT handler at the end of devCommand function (line 211-214)
process.on("SIGINT", async () => {
  clearInterval(tokenRefreshInterval);
  await closeSentry();
  process.exit(0);
});
```

#### 7. Add error capturing to command handlers
**File**: Various command files
**Changes**: Wrap critical operations with Sentry error capture

Example pattern for `packages/polychromos/src/commands/login.ts`:
```typescript
import { captureException } from "../lib/sentry.js";

// In catch blocks, add:
} catch (error) {
  captureException(error);
  console.error(error instanceof Error ? error.message : "Login failed");
  process.exit(1);
}
```

Apply this pattern to:
- `src/commands/login.ts` - login errors
- `src/commands/dev.ts` - sync errors, watcher errors
- `src/commands/init.ts` - initialization errors
- `src/commands/undo.ts`, `src/commands/redo.ts` - version control errors
- `src/commands/export.ts` - export errors

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter polychromos typecheck`
- [x] Linting passes: `pnpm --filter polychromos lint`
- [x] Unit tests pass: `pnpm --filter polychromos test`
- [x] Package builds: `pnpm --filter polychromos build`

#### Manual Verification:
- [ ] Run `polychromos telemetry status` - shows enabled by default
- [ ] Trigger an error (e.g., run invalid command) - verify appears in Sentry dashboard
- [ ] Run `polychromos telemetry disable` - disables telemetry
- [ ] Trigger error again - verify does NOT appear in Sentry
- [ ] Verify `~/.polychromos/config.json` contains `{"telemetryEnabled": false}`
- [ ] Run with `POLYCHROMOS_TELEMETRY_DISABLED=1` and verify no Sentry errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Web App Sentry Integration

### Overview
Add Sentry to the TanStack Start web application following the official setup with client/server initialization, session replay, performance monitoring, and proper error boundaries.

**Note**: Web app DSN is already configured in `.vercel/.env...` files:
`https://9c0e71537f4f44e46e091628c4184a05@o4508333286948864.ingest.us.sentry.io/4510825109323776`

### Changes Required:

#### 1. Add Sentry dependencies
**File**: `apps/polychromos-app/package.json`
**Changes**: Add Sentry TanStack Start SDK

```json
"dependencies": {
  "@clerk/clerk-react": "^5.60.0",
  "@sentry/tanstackstart-react": "^9.0.0",
  ...
}
```

#### 2. Initialize Sentry on client in router
**File**: `apps/polychromos-app/src/router.tsx`
**Changes**: Add client-side Sentry initialization with proper TanStack integration

```typescript
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import * as Sentry from "@sentry/tanstackstart-react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CLERK_PUBLISHABLE_KEY = (import.meta as any).env
    .VITE_CLERK_PUBLISHABLE_KEY as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const SENTRY_DSN = (import.meta as any).env.VITE_SENTRY_DSN as string;

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

  // Initialize Sentry on client only
  if (!router.isServer && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      sendDefaultPii: true,
      integrations: [
        Sentry.tanstackRouterBrowserTracingIntegration(router),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1, // 10% in production
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% on error
    });
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

#### 3. Create server instrumentation file
**File**: `apps/polychromos-app/instrument.server.mjs` (new file, root of project)
**Changes**: Initialize Sentry for server-side

```javascript
import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "https://9c0e71537f4f44e46e091628c4184a05@o4508333286948864.ingest.us.sentry.io/4510825109323776",
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
});
```

#### 4. Create server entry point
**File**: `apps/polychromos-app/src/server.ts` (new file)
**Changes**: Wrap server handler with Sentry

```typescript
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry(
  wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request);
    },
  })
);
```

#### 5. Update Vite configuration
**File**: `apps/polychromos-app/vite.config.ts`
**Changes**: Add Sentry Vite plugin for source maps

```typescript
import { defineConfig } from "vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
// ... other imports

export default defineConfig({
  plugins: [
    viteTsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    sentryTanstackStart({
      org: "jps0000",
      project: "polychromos-app",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    nitro(),
    viteReact(),
    ViteImageOptimizer(),
  ],
  // ... rest of config
});
```

#### 6. Update package.json scripts
**File**: `apps/polychromos-app/package.json`
**Changes**: Add instrument file copying and NODE_OPTIONS

```json
{
  "scripts": {
    "dev": "pnpm run dev:setup && NODE_OPTIONS='--import ./instrument.server.mjs' concurrently -r npm:dev:web npm:dev:convex",
    "dev:web": "pnpm exec dotenv -e .vercel/.env.development.local -- vite dev",
    "build": "vite build && cp instrument.server.mjs .output/server",
    "start": "node --import ./.output/server/instrument.server.mjs .output/server/index.mjs",
    // ... rest of scripts
  }
}
```

#### 7. Update environment validation
**File**: `apps/polychromos-app/src/env.ts`
**Changes**: Add Sentry DSN to environment validation

```typescript
client: {
  VITE_APP_URL: z.string().url(),
  VITE_CONVEX_URL: z.string().url(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
},
runtimeEnv: {
  ...process.env,
  VITE_APP_URL: appUrl,
  VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
  NODE_ENV: process.env.NODE_ENV,
  CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
  VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
  VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN,
},
```

#### 8. Add user context tracking
**File**: `apps/polychromos-app/src/routes/__root.tsx`
**Changes**: Set Sentry user context when authenticated

```typescript
// Add imports at top
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import * as Sentry from "@sentry/tanstackstart-react";

// In RootComponent, add user tracking effect
function RootComponent() {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }, [isSignedIn, userId]);

  return <RootDocument />;
}
```

#### 9. Add error capturing to error components
**File**: Error components in routes (if using custom errorComponents)
**Changes**: Capture exceptions in useEffect

Example for route error components:
```typescript
import { useEffect } from "react";
import * as Sentry from "@sentry/tanstackstart-react";

errorComponent: ({ error }) => {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    // ... error UI
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @repo/app typecheck`
- [x] Linting passes: `pnpm --filter @repo/app lint`
- [ ] Dev server starts: `pnpm --filter @repo/app dev`
- [x] Package builds: `pnpm --filter @repo/app build`
- [ ] Server starts: `pnpm --filter @repo/app start`

#### Manual Verification:
- [ ] Load web app and verify no console errors related to Sentry
- [ ] Add test button to trigger error: `<button onClick={() => { throw new Error("Sentry Test Error"); }}>Break</button>`
- [ ] Click button and verify error is captured in Sentry dashboard
- [ ] Verify session replay is attached to the error event
- [ ] Check that user ID is set in Sentry when authenticated
- [ ] Verify performance traces appear in Sentry Performance tab

**Implementation Note**:
- For source maps in production, you'll need to set `SENTRY_AUTH_TOKEN` environment variable
- Generate auth token at: https://sentry.io/settings/account/api/auth-tokens/
- After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Environment Configuration & Publishing

### Overview
Document environment variables, update deployment configuration, and prepare for release.

### Changes Required:

#### 1. CLI Environment Variables Documentation
**File**: `packages/polychromos/README.md` or inline in package
**Changes**: Document telemetry controls

**Note**: The Sentry DSN is hardcoded in the CLI package (it's not a secret).

Optional environment variables:
- `POLYCHROMOS_TELEMETRY_DISABLED=1` - Disable all telemetry

User configuration:
- `~/.polychromos/config.json` - Contains `telemetryEnabled` boolean (defaults to true)

Commands:
- `polychromos telemetry enable` - Enable anonymous error reporting (default)
- `polychromos telemetry disable` - Disable error reporting
- `polychromos telemetry status` - Show current telemetry state

#### 2. Web App Environment Variables
**File**: `.vercel/.env.development.local` and Vercel project settings
**Changes**: Verify Sentry DSN is configured (already set)

**Required:**
- `VITE_SENTRY_DSN` - Already configured in `.vercel/.env...` files
  - Value: `https://9c0e71537f4f44e46e091628c4184a05@o4508333286948864.ingest.us.sentry.io/4510825109323776`

**Optional (for source maps in production):**
- `SENTRY_AUTH_TOKEN` - Auth token for uploading source maps
  - Generate at: https://sentry.io/settings/account/api/auth-tokens/
  - Add to Vercel environment variables for production builds
  - Permissions needed: `project:releases`, `org:read`

#### 3. Update .env.example files
**File**: `apps/polychromos-app/.env.example` (create if doesn't exist)
**Changes**: Document all environment variables

```bash
# Convex
VITE_CONVEX_URL=https://your-project.convex.cloud

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev

# Sentry (optional - error tracking)
VITE_SENTRY_DSN=https://...@sentry.io/...
```

#### 4. Prepare changeset for release
**File**: `.changeset/sentry-integration.md` (new file)
**Changes**: Create changeset for version bump

```markdown
---
"polychromos": minor
---

Add Sentry error tracking with opt-out telemetry

- New `polychromos telemetry` command for managing preferences
- Anonymous error reporting to help improve the CLI
- Telemetry is enabled by default with opt-out available
- Run `polychromos telemetry disable` or set `POLYCHROMOS_TELEMETRY_DISABLED=1` to opt out
```

### Success Criteria:

#### Automated Verification:
- [ ] All packages build: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] Changeset is valid: `pnpm changeset status`

#### Manual Verification:
- [ ] Environment variables documented and accessible
- [ ] Vercel deployment uses new environment variables
- [ ] CLI telemetry consent flow works end-to-end
- [ ] Web app errors appear in Sentry with proper context

**Implementation Note**: This phase requires you to set up Sentry projects and configure environment variables. Once environments are configured, manual testing should verify the full integration.

---

## Testing Strategy

### Unit Tests:
- `packages/polychromos/src/lib/__tests__/telemetry-config.test.ts`
  - Test `loadTelemetryConfig()` with missing file
  - Test `saveTelemetryConfig()` creates file
  - Test `isTelemetryEnabled()` respects environment variable
  - Test `setTelemetryEnabled()` persists to disk

- `packages/polychromos/src/lib/__tests__/sentry.test.ts`
  - Test `initSentry()` respects consent
  - Test `initSentry()` respects environment variable
  - Test `captureException()` is no-op when disabled

### Integration Tests:
- CLI telemetry command enables/disables correctly
- CLI errors are captured when telemetry enabled
- Web app errors trigger error boundary

### Manual Testing Steps:
1. CLI: Run `polychromos telemetry status` - verify shows enabled by default
2. CLI: Trigger error with invalid command - verify appears in Sentry
3. CLI: Run `polychromos telemetry disable` - verify disables
4. CLI: Trigger error again - verify does NOT appear in Sentry
5. CLI: Set `POLYCHROMOS_TELEMETRY_DISABLED=1` - verify no events sent
6. Web: Load app - verify no console errors
7. Web: Navigate to invalid route - verify error boundary
8. Web: Check Sentry for error with session replay

---

## Performance Considerations

### CLI
- Sentry SDK import (~1.5MB) happens early but is tree-shakeable
- `Sentry.close(2000)` adds 2 second max delay on exit
- No performance monitoring (error-only mode)

### Web App
- Session replay adds ~50kb to bundle (lazy-loaded)
- 10% sample rate limits performance data volume
- Browser tracing is lightweight for Core Web Vitals

---

## References

- Research document: `thoughts/shared/research/2026-02-04-web-analysis-sentry-cli-app-observability.md`
- Sentry Node.js SDK: https://docs.sentry.io/platforms/javascript/guides/node/
- Sentry TanStack Start (official guide): https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/
- Sentry Draining: https://docs.sentry.io/platforms/node/configuration/draining/
- Sentry Auth Tokens: https://sentry.io/settings/account/api/auth-tokens/

---

**Last Updated**: 2026-02-04
**Status**: Ready for implementation
**Next Steps**: User sets up Sentry projects and environment variables, then implementation begins with Phase 1
