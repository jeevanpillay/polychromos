# Polychromos CLI Production Must-Haves Implementation Plan

## Overview

Based on the comprehensive documentation in `thoughts/shared/research/2026-02-03-polychromos-cli-comprehensive-documentation.md`, this plan identifies and prioritizes the **critical missing features** needed before the Polychromos CLI can be considered production-ready.

**Philosophy**: Focus on reliability, user trust, and preventing data loss. Omit nice-to-haves that users can live without on day 1.

## Current State Analysis

The CLI is functional but has significant gaps:
- **No retry logic** - Failed syncs are silently dropped
- **No offline detection** - Users don't know when they're working offline
- **Version hardcoded in 3 places** - Error-prone release process
- **Windows credentials unsecured** - chmod is a no-op on Windows

### Key Discoveries:
- Single-flight pattern exists (`dev.ts:72-138`) - good foundation for retry
- Token refresh already runs on interval (`dev.ts:61-70`) - pattern to follow
- Console messaging is consistent (✓, ✗, ⚠ prefixes) - maintain this
- No analytics/telemetry - privacy-first is good, keep it

## What We're NOT Doing (Day 1)

These are explicitly out of scope for MVP production:
- Update notifications (`npm outdated` handles this)
- Dry-run mode (useful but not critical)
- Log file rotation (event log is small)
- Multi-workspace support (one workspace per directory is fine)
- Proxy/firewall configuration (users can configure system-level)
- Token resolution in exports (export is secondary workflow)
- Automatic conflict resolution (too risky without user input)
- Uninstall cleanup hooks (files are small, users can manually delete)

## Priority Rankings

| Priority | Feature | Impact | Risk if Missing |
|----------|---------|--------|-----------------|
| **P0** | Network retry with backoff | HIGH | Data loss on transient failures |
| **P0** | Offline detection & warning | HIGH | Silent data loss, user confusion |
| **P1** | Single-source version | MED | Release process errors |
| **P1** | Windows credential security | MED | Security vulnerability |
| **P2** | Graceful degradation on sync failure | MED | Poor UX during issues |

---

## Phase 1: Network Retry with Exponential Backoff (P0)

### Overview
Implement retry logic for Convex mutations to handle transient network failures. This is critical because currently, a single network hiccup causes silent data loss.

### Changes Required:

#### 1. Create Retry Utility
**File**: `packages/polychromos/src/lib/retry.ts` (new file)

```typescript
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on auth/permission errors
      if (
        lastError.message.includes("Unauthenticated") ||
        lastError.message.includes("Access denied") ||
        lastError.message.includes("Version conflict")
      ) {
        throw lastError;
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        console.warn(`⚠ Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

#### 2. Integrate Retry into Dev Command
**File**: `packages/polychromos/src/commands/dev.ts`

**Changes**:
- Import `withRetry` from new utility
- Wrap Convex mutation call with retry logic
- Update error messages to indicate retry exhaustion

```typescript
// At top of file, add import:
import { withRetry } from "../lib/retry.js";

// In syncWithSingleFlight function (around line 86), replace:
const result = await convexClient.mutation(/* ... */);

// With:
const result = await withRetry(
  () => convexClient.mutation(
    "workspaces:update" as never,
    {
      id: config.workspaceId,
      data: toSync,
      expectedVersion: currentVersion,
    } as never,
  ),
);
```

#### 3. Update Error Handling
**File**: `packages/polychromos/src/commands/dev.ts:121-126`

**Change generic error message to indicate retry failure**:
```typescript
// Change from:
console.error("✗ Sync failed:", convexError instanceof Error ? convexError.message : convexError);

// To:
console.error("✗ Sync failed after retries:", convexError instanceof Error ? convexError.message : convexError);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Unit tests pass: `pnpm test --filter=polychromos`
- [x] New unit test for retry utility passes

#### Manual Verification:
- [ ] Disconnect network during sync → see retry messages → reconnect → sync succeeds
- [ ] Auth error still fails immediately (no retry)
- [ ] Version conflict still fails immediately (no retry)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Offline Detection & Warning (P0)

### Overview
Detect when the CLI is operating offline and warn users prominently. Currently, users can edit files for hours without knowing their changes aren't syncing.

### Changes Required:

#### 1. Create Connectivity Checker
**File**: `packages/polychromos/src/lib/connectivity.ts` (new file)

```typescript
export type ConnectivityState = "online" | "offline" | "unknown";

let currentState: ConnectivityState = "unknown";
let lastCheck: number = 0;
const CHECK_INTERVAL = 30000; // 30 seconds

export async function checkConnectivity(convexUrl: string): Promise<ConnectivityState> {
  try {
    // Use a simple HEAD request to the Convex URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(convexUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    currentState = "online";
  } catch {
    currentState = "offline";
  }

  lastCheck = Date.now();
  return currentState;
}

export function getConnectivityState(): ConnectivityState {
  return currentState;
}

export function shouldRecheck(): boolean {
  return Date.now() - lastCheck > CHECK_INTERVAL;
}
```

#### 2. Integrate Connectivity into Dev Command
**File**: `packages/polychromos/src/commands/dev.ts`

**Changes**:
- Add connectivity check on startup
- Add periodic connectivity monitoring
- Show prominent offline warning
- Track offline state changes

```typescript
// At top, add import:
import { checkConnectivity, getConnectivityState, shouldRecheck } from "../lib/connectivity.js";

// After initial workspace fetch (around line 58), add:
const initialConnectivity = await checkConnectivity(config.convexUrl);
if (initialConnectivity === "offline") {
  console.warn("");
  console.warn("╔══════════════════════════════════════════════════════════╗");
  console.warn("║  ⚠ OFFLINE - Changes will NOT sync until reconnected    ║");
  console.warn("╚══════════════════════════════════════════════════════════╝");
  console.warn("");
}

// In the sync function, before attempting sync:
if (getConnectivityState() === "offline" && shouldRecheck()) {
  const state = await checkConnectivity(config.convexUrl);
  if (state === "online") {
    console.log("✓ Back online - resuming sync");
  }
}

// After successful sync, if was offline:
if (previousState === "offline" && getConnectivityState() === "online") {
  console.log("✓ Reconnected and synced successfully");
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Unit tests pass: `pnpm test --filter=polychromos`

#### Manual Verification:
- [ ] Start `polychromos dev` offline → see prominent offline warning
- [ ] Disconnect during operation → see offline warning on next sync attempt
- [ ] Reconnect → see "back online" message on next successful sync

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 3: Single-Source Version (P1)

### Overview
Version is currently hardcoded in 3 places (`package.json`, `index.ts:20`, `dev.ts:14`). This causes version drift during releases. Use `package.json` as single source of truth.

### Changes Required:

#### 1. Create Version Utility
**File**: `packages/polychromos/src/lib/version.ts` (new file)

```typescript
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

let cachedVersion: string | null = null;

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
    cachedVersion = pkg.version;
    return cachedVersion;
  } catch {
    return "unknown";
  }
}
```

#### 2. Update CLI Entry Point
**File**: `packages/polychromos/src/index.ts:20`

**Change from**:
```typescript
.version("1.0.0")
```

**To**:
```typescript
import { getVersion } from "./lib/version.js";
// ...
.version(getVersion())
```

#### 3. Update Dev Command Banner
**File**: `packages/polychromos/src/commands/dev.ts:14`

**Change from**:
```typescript
console.log("Polychromos CLI v1.0.0");
```

**To**:
```typescript
import { getVersion } from "../lib/version.js";
// ...
console.log(`Polychromos CLI v${getVersion()}`);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] `polychromos --version` outputs version from package.json
- [x] `polychromos dev` banner shows correct version

#### Manual Verification:
- [ ] Bump version in package.json → both `--version` and `dev` show new version

**Implementation Note**: Pause here for manual confirmation before proceeding.

---

## Phase 4: Windows Credential Security (P1)

### Overview
`chmod(0o600)` is a no-op on Windows. Credentials are stored world-readable. Use Windows ACLs via `icacls` for proper security.

### Changes Required:

#### 1. Update Credentials Storage
**File**: `packages/polychromos/src/lib/credentials.ts:14-28`

**Replace entire `saveCredentials` function**:

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function saveCredentials(tokens: TokenData): Promise<void> {
  try {
    // Ensure directory exists
    await mkdir(CREDENTIALS_DIR, { recursive: true });

    // Write credentials file
    await writeFile(CREDENTIALS_FILE, JSON.stringify(tokens, null, 2), "utf-8");

    // Set restrictive permissions
    if (process.platform === "win32") {
      // Windows: Use icacls to set owner-only permissions
      try {
        // Remove inherited permissions and set owner-only
        await execAsync(`icacls "${CREDENTIALS_FILE}" /inheritance:r /grant:r "%USERNAME%:F"`);
      } catch {
        console.warn("⚠ Could not set Windows file permissions. Credentials may be readable by other users.");
      }
    } else {
      // Unix: Use chmod
      await chmod(CREDENTIALS_FILE, 0o600);
    }
  } catch (error) {
    console.warn("Could not save credentials:", error);
    throw error;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Unit tests pass on macOS/Linux
- [ ] CI tests pass (if Windows CI exists)

#### Manual Verification (if Windows available):
- [ ] `polychromos login` → credentials.json not readable by other users
- [ ] Check with `icacls %USERPROFILE%\.polychromos\credentials.json`

**Implementation Note**: If no Windows testing available, note this as a known limitation for initial release.

---

## Testing Strategy

### Unit Tests:

**New test files to create**:

1. `packages/polychromos/src/__tests__/lib/retry.test.ts`
   - Test successful on first attempt
   - Test retry on transient failure
   - Test no retry on auth errors
   - Test exponential backoff timing
   - Test max attempts exceeded

2. `packages/polychromos/src/__tests__/lib/connectivity.test.ts`
   - Test online detection
   - Test offline detection
   - Test timeout handling
   - Test recheck interval logic

3. `packages/polychromos/src/__tests__/lib/version.test.ts`
   - Test version reading from package.json
   - Test fallback on error

### Integration Tests:

Add to existing E2E tests in `packages/polychromos/test/e2e/`:
- Network interruption during sync
- Offline startup behavior
- Recovery from offline state

### Manual Testing Steps:

1. **Network retry**:
   - Start `polychromos dev`
   - Disconnect network
   - Edit `design.json`
   - Observe retry messages
   - Reconnect within retry window
   - Verify sync completes

2. **Offline detection**:
   - Disconnect network
   - Start `polychromos dev`
   - Verify prominent offline warning
   - Reconnect
   - Edit file
   - Verify "back online" message

3. **Version display**:
   - Run `polychromos --version`
   - Run `polychromos dev`
   - Both should show version from package.json

---

## Performance Considerations

- **Retry delays**: Exponential backoff prevents hammering a struggling server
- **Connectivity check**: 5-second timeout prevents blocking on slow networks
- **Connectivity recheck**: 30-second interval balances awareness vs. overhead
- **Version caching**: Read package.json once at startup, cache result

---

## Migration Notes

No data migration required. These are additive changes that don't affect existing:
- Config files
- Credentials
- Event logs
- Workspace data

Users will automatically benefit from improvements on next CLI startup.

---

## References

- Original research: `thoughts/shared/research/2026-02-03-polychromos-cli-comprehensive-documentation.md`
- Existing patterns: `packages/polychromos/src/commands/dev.ts:61-70` (interval pattern)
- Error handling: `packages/polychromos/src/commands/dev.ts:102-128`
