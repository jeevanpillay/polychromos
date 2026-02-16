---
date: 2026-02-04T00:16:15+00:00
researcher: Claude
git_commit: d8f1ac3eeebfd55272f554fa738f2617996611ec
branch: main
repository: polychromos
topic: "Polychromos CLI Rework Documentation"
tags: [research, codebase, polychromos, cli, observability, logging, update-notifications, cross-platform]
status: complete
last_updated: 2026-02-04
last_updated_by: Claude
related_plan: thoughts/shared/plans/2026-02-03-polychromos-cli-production-must-haves.md
---

# Research: Polychromos CLI Rework Documentation

**Date**: 2026-02-04T00:16:15+00:00
**Researcher**: Claude
**Git Commit**: d8f1ac3eeebfd55272f554fa738f2617996611ec
**Branch**: main
**Repository**: polychromos

## Research Question

Comprehensive documentation covering CLI rework requirements:
1. Init command and config.json creation behavior
2. Convex URL handling across environments (production should be consistent)
3. Logger implementation for debugging
4. Observability options (Sentry vs OpenTelemetry)
5. CLI update notifications for alpha releases
6. Cross-platform path handling and testing
7. Debug/verbose mode
8. Large file performance
9. Logging location

## Summary

The Polychromos CLI has several areas requiring attention for production readiness. Key findings:

**Init Command Gap**: `polychromos init` creates only `design.json` but does NOT create `.polychromos/config.json`. Commands that require config (dev, undo, redo, history) fail with confusing error messages suggesting to run init again.

**Convex URL Architecture**: The production URL (`https://pleasant-ox-89.convex.cloud`) is already hardcoded in `packages/polychromos/src/lib/auth.ts:26` as a fallback. Config.json stores it per-project but this is redundant for production since all users share the same backend.

**Logging**: No structured logging exists. All output uses raw `console.log`, `console.error`, `console.warn`. No verbose/debug mode implemented.

**Observability Options**:
- **OpenTelemetry**: Industry standard, vendor-neutral, but requires backend infrastructure and careful shutdown handling for CLI tools
- **Sentry**: Developer-first error monitoring, now uses OpenTelemetry under the hood
- **Recommendation**: Start with simple structured logging + Sentry for errors, add OpenTelemetry later for tracing

**Update Notifications**: Not implemented. Recommended approach: Use `update-check` (Vercel's package) with 24-hour cache interval and `alpha` dist-tag.

**Cross-Platform**: Path handling is correct (uses `path.join()` everywhere). Windows credential security uses `icacls`. No known issues but testing recommended.

**Performance**: Full file loaded into memory with 500ms total debounce (200ms chokidar + 300ms custom). No file size limits enforced.

---

## Detailed Findings

### 1. Init Command and Config.json Creation

#### Current Behavior

**Entry Point**: `packages/polychromos/src/commands/init.ts:4-85`

The `polychromos init <name>` command:
1. Generates workspace ID: `ws_${Date.now()}`
2. Creates workspace object with starter template
3. Writes `design.json` to current directory
4. Prints success message with next steps

**What Init Does NOT Do**:
- Does NOT create `.polychromos/` directory
- Does NOT create `.polychromos/config.json`
- Does NOT store `convexUrl` or `workspaceId` in config
- Does NOT call `saveConfig()` function

#### The Gap

Commands that require config check for it and fail:

**dev.ts:22-26**:
```typescript
const config = await loadConfig();
if (!config) {
  console.log("No Convex configuration found.");
  console.log("Run 'polychromos init <name>' first to set up your workspace.");
  process.exit(1);
}
```

This is misleading because running `init` does NOT create the config file. The `.polychromos/config.json` file must currently be created manually or by an external tool.

#### Config File Structure

**Location**: `.polychromos/config.json` (relative to project root)

**Interface** (`packages/polychromos/src/lib/config.ts:4-7`):
```typescript
export interface PolychromosConfig {
  convexUrl: string;
  workspaceId: string;
}
```

**saveConfig()** (`config.ts:30-33`):
- Writes to `.polychromos/config.json`
- Assumes `.polychromos/` directory exists (will throw if missing)
- Called by NO command currently

---

### 2. Convex URL Handling

#### Current Sources of Convex URL

| Context | Environment Variable | Default/Fallback | Location |
|---------|---------------------|------------------|----------|
| CLI Auth (login) | `POLYCHROMOS_CONVEX_URL` | `https://pleasant-ox-89.convex.cloud` | `packages/polychromos/src/lib/auth.ts:26` |
| CLI Commands (dev, etc.) | N/A | From config.json | `.polychromos/config.json` |
| Web App | `VITE_CONVEX_URL` | Required (no fallback) | `apps/polychromos-app/src/router.tsx:13` |
| E2E Tests | `CONVEX_BACKEND_URL` | `http://127.0.0.1:3210` | Test files |

#### getConvexUrl() Function

**Location**: `packages/polychromos/src/lib/auth.ts:25-26`

```typescript
export function getConvexUrl(): string {
  return process.env.POLYCHROMOS_CONVEX_URL ?? "https://pleasant-ox-89.convex.cloud";
}
```

- Returns hardcoded production URL as default
- Environment variable allows override for testing
- Used by `login` command but NOT by other commands

#### Current Command Usage

**Commands using config.convexUrl**:
- `dev.ts:58`: `new ConvexHttpClient(config.convexUrl)`
- `undo.ts:25`: `new ConvexHttpClient(config.convexUrl)`
- `redo.ts:25`: `new ConvexHttpClient(config.convexUrl)`
- `history.ts:27`: `new ConvexHttpClient(config.convexUrl)`
- `whoami.ts:22`: `new ConvexHttpClient(config.convexUrl)`

**Commands using getConvexUrl()**:
- `login.ts:22-23`: `const convexUrl = getConvexUrl()`

#### Recommendation Context

Since all production users share the same Convex backend, storing `convexUrl` in each project's config.json is redundant. The URL could be:
1. Hardcoded in code (already is in `auth.ts`)
2. Read from `getConvexUrl()` everywhere
3. Only overridden via environment variable for testing/development

---

### 3. Current Logging Patterns

#### No Structured Logging Framework

All logging uses native console methods with string templates:

**console.log** - Success/info messages with ✓ symbol
- `dev.ts:132-136`: Sync success
- `init.ts:77-84`: Init success
- `login.ts:57-60`: Login success

**console.warn** - Non-fatal warnings with ⚠ symbol
- `dev.ts:44-53`: Offline warning box
- `dev.ts:73`: Workspace not found
- `retry.ts:48-50`: Retry attempt

**console.error** - Errors with ✗ symbol
- `dev.ts:143-163`: Sync failure reasons
- `export.ts:16-48`: Various export errors
- `login.ts:66,80,83-86`: Authentication failures

#### Box Drawing for Offline Warning

```typescript
// dev.ts:46-52
console.warn("╔═══════════════════════════════════════════════════════════╗");
console.warn("║  ⚠ WARNING: Could not connect to Convex backend          ║");
console.warn("║  Changes will NOT sync until connection is restored.     ║");
console.warn("║  Check your internet connection and try again.           ║");
console.warn("╚═══════════════════════════════════════════════════════════╝");
```

#### Silent Catch Blocks

Several locations catch errors silently:
- `config.ts:24-27`: File read errors return null
- `credentials.ts:60-62`: File read errors return null
- `version-manager.ts:34-37`: Directory creation errors ignored
- `version.ts:24-26`: Package.json read errors return "unknown"

---

### 4. Observability Options Evaluation

#### Sentry for CLI Applications

**Pros**:
- Developer-first error monitoring
- Automatic error capture for uncaught exceptions
- Deep breadcrumbs and stack traces
- Now uses OpenTelemetry under the hood
- 100,000+ organizations (proven at scale)

**Cons**:
- Documentation doesn't specifically address CLI short-lived process considerations
- Requires proper flush handling before process exit
- Not specifically designed for CLI use cases

**Implementation Consideration**:
```javascript
// Requires early initialization with --import flag (Node 18.19.0+)
import * as Sentry from '@sentry/node';
Sentry.init({ dsn: '...' });

// Before exit
process.on('SIGTERM', async () => {
  await Sentry.flush(2000);
  process.exit(0);
});
```

#### OpenTelemetry for CLI Tools

**Pros**:
- Vendor-neutral (export to any backend)
- Industry standard with wide adoption
- Automatic instrumentation for 50+ libraries
- Free and open-source
- Unified framework for traces, metrics, and logs

**Cons**:
- More complex setup than specialized solutions
- Requires backend infrastructure (collector, storage, visualization)
- Overhead may be excessive for simple CLI tools
- Need proper shutdown handling for short-lived processes

**CLI-Specific Package**: `cli-opentelemetry` provides turnkey solution:
```javascript
require("cli-opentelemetry").tele(
  "polychromos",
  pathToMainFile,
  "0.1.0-alpha.2",
  "http://collector:4318/v1/traces"
)
```

**Critical for Short-Lived Processes**:
```javascript
// Must call shutdown before exit
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

#### End-to-End Tracing (CLI → Convex)

**Important Finding**: No documented native OpenTelemetry support in Convex.

**What's Possible**:
1. Instrument CLI with OpenTelemetry
2. Auto-instrumentation traces HTTP calls to Convex
3. Cannot see inside Convex function execution
4. Rely on Convex Dashboard for backend visibility

**Context Propagation** (W3C Trace Context):
```
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
```
Automatic when auto-instrumentation is enabled.

#### Recommendation

**Phase 1 (Immediate)**: Implement structured logging with levels
- Use `pino` (high performance) or `winston` (flexible)
- Add `--verbose` and `--debug` flags
- Log to file at `~/.polychromos/logs/`

**Phase 2 (Error Tracking)**: Add Sentry
- Opt-in with consent prompt
- Capture errors and performance
- Proper flush handling on exit

**Phase 3 (If Needed)**: Add OpenTelemetry
- Only if end-to-end tracing becomes necessary
- Use `cli-opentelemetry` package
- Export to SigNoz or similar backend

---

### 5. CLI Update Notifications

#### Current State

- No update checking code exists
- Version hardcoded in 3 places (now consolidated to `package.json` with `getVersion()` reading it)
- Current version: `0.1.0-alpha.2`
- Published to npm with `--tag alpha`

#### Recommended Approach

**Use Vercel's `update-check` Package**:
```javascript
const pkg = require('./package');
const checkForUpdate = require('update-check');

let update = null;
try {
  update = await checkForUpdate(pkg, {
    interval: 86400000,  // 24 hours
    distTag: 'alpha'     // Check alpha channel
  });
} catch (err) {
  // Silent failure
}

if (update) {
  console.log(`Update available: ${pkg.version} → ${update.latest}`);
  console.log(`Run: npm i -g polychromos@alpha`);
}
```

**Key Configuration**:
- Check interval: 24 hours (standard across major CLIs)
- Use `distTag: 'alpha'` for alpha users
- Defer notification to process exit
- Skip in CI environments

**Opt-Out Mechanisms**:
- Environment variable: `NO_UPDATE_NOTIFIER=1`
- Config setting in `.polychromos/config.json`

#### Alternative Packages

| Package | Status | Notes |
|---------|--------|-------|
| `update-notifier` | Sustainable but low activity | Original, no updates in 12+ months |
| `update-check` | Active (Vercel) | Minimal, battle-tested |
| `simple-update-notifier` | Active | 8.5M+ downloads, TypeScript |

---

### 6. Cross-Platform Path Handling

#### Correct Patterns Used

**All path construction uses `path.join()`**:
- `credentials.ts:9-10`: `join(homedir(), ".polychromos")`
- `config.ts:14`: `join(CONFIG_DIR, CONFIG_FILE)`
- `version-manager.ts:26-28`: `join(directory, "events.jsonl")`

**No hardcoded separators** (`/` or `\`) in path logic.

**Home directory via `os.homedir()`**:
- Windows: `C:\Users\<username>`
- macOS: `/Users/<username>`
- Linux: `/home/<username>`

#### Windows-Specific Permission Handling

**Location**: `packages/polychromos/src/lib/credentials.ts:27-42`

```typescript
if (process.platform === "win32") {
  try {
    await execAsync(
      `icacls "${CREDENTIALS_FILE}" /inheritance:r /grant:r "%USERNAME%:F"`,
    );
  } catch {
    console.warn(
      "⚠ Could not set Windows file permissions. Credentials may be readable by other users.",
    );
  }
} else {
  await chmod(CREDENTIALS_FILE, 0o600);
}
```

#### Line Endings

- All file I/O uses UTF-8 encoding
- `\n` (LF) used throughout
- `split("\n")` works cross-platform due to Node.js normalization

#### Testing Recommendation

Test matrix needed:
- Windows 10/11 (x64)
- macOS (Intel and Apple Silicon)
- Linux (Ubuntu, common distros)

Key test areas:
1. Path construction
2. File permissions
3. Credential storage/retrieval
4. File watching with chokidar

---

### 7. Debug/Verbose Mode

#### Current State

**Not implemented**. No `--verbose` or `--debug` flags exist.

**No log levels** - direct console method calls throughout.

**No environment variable checks** for debug mode (`DEBUG`, `LOG_LEVEL`, `VERBOSE`).

#### Timing Information

Partial timing exists:
- `dev.ts:119`: `new Date().toLocaleTimeString()` for sync timestamps
- No duration tracking for operations

#### Recommended Implementation

```typescript
// lib/logger.ts
import pino from 'pino';

const level = process.env.POLYCHROMOS_LOG_LEVEL ||
              (process.argv.includes('--verbose') ? 'debug' :
               process.argv.includes('--debug') ? 'trace' : 'info');

export const logger = pino({
  level,
  transport: process.stdout.isTTY ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Usage
logger.info({ version, command }, 'CLI started');
logger.debug({ config }, 'Configuration loaded');
logger.trace({ data }, 'Sending to Convex');
```

---

### 8. Large File Performance & Storage Architecture

#### Current Implementation

**Full file loaded into memory** (`dev.ts:191`):
```typescript
const content = await readFile("design.json", "utf-8");
const data: unknown = JSON.parse(content);
```

**No file size limits** enforced in CLI. Convex limits:
- **Document size**: 1 MiB maximum
- **Nesting depth**: 16 levels maximum (HARD LIMIT)
- **Fields per document**: 1,024 maximum
- **Array elements**: 8,192 maximum

**Memory overhead**: 2-3x file size due to:
- String content in memory
- Parsed JSON object
- `pendingData` copy in single-flight pattern

#### Critical Architecture Issue: Nesting Depth Limit

**Current Storage** (`apps/polychromos-app/convex/schema.ts:8-9`):
```typescript
workspaces: defineTable({
  data: v.any(),      // Stores entire PolychromosWorkspace
  baseData: v.any(),  // Stores initial state for undo
  // ...
})
```

**Problem**:
- Entire workspace stored as nested JSON in single Convex document
- Convex enforces **16-level nesting depth limit**
- Current design.json example: 6 levels deep
- Users building complex UIs could easily exceed 16 levels:
  - Page → Section → Container → Card → Header → Title → Icon → Text = 8 levels
  - Add more nested layouts and you hit the limit

**Element Recursion** (`packages/polychromos-types/src/types.ts:47`):
```typescript
export interface PolychromosElement {
  children?: PolychromosElement[];  // Unlimited recursion in TypeScript
}
```

**Observed Depths**:
- Minimal: 2 levels (workspace → component → root)
- Typical: 3-4 levels (workspace → component → root → children → element)
- Maximum in codebase: 6 levels (`design.json` OG image)
- TypeScript allows: Unlimited
- **Convex allows: 16 levels maximum**

#### Recommended Solutions (from Convex Documentation)

**Quote from Convex Best Practices**:
> "Even though Convex supports nested documents, it is often better to put separate objects into separate tables and use IDs to create references between them."

**Document-Relational Approach**:
1. Store elements in separate `elements` table
2. Use parent ID references instead of nested children arrays
3. Query element trees via indexed lookups
4. Limit: Arrays cannot be indexed in Convex

**Alternative: Store as JSON String**:
- Store workspace data as JSON string in Convex
- Parse/stringify on client side
- Loses Convex's document querying capabilities
- Bypasses nesting depth limit

**Hybrid Approach**:
- Store workspace metadata in structured fields
- Store element tree as JSON string or in separate table
- Balance between queryability and flexibility

#### Debouncing

**Two-layer system** (~500ms total):
1. Chokidar: 200ms stability threshold, 100ms poll interval
2. Custom setTimeout: 300ms

**Single-flight pattern** prevents queue buildup:
```typescript
let pendingData: unknown = null;
pendingData = data;  // Latest wins, previous discarded
```

#### Performance Observations

- No streaming or incremental parsing
- Full workspace sent on every sync (patches generated server-side)
- Event sourcing with RFC 6902 patches stored separately
- Retry with exponential backoff: 1s, 2s, 4s (max 10s)
- Connectivity check every 30 seconds when offline
- **Critical**: No validation of nesting depth before storing in Convex

---

### 9. Logging Location

#### Current State

**No file-based logging**. All output to console (stdout/stderr).

**Event journal** at `.polychromos/events.jsonl`:
- JSONL format (one entry per line)
- Contains version history for undo/redo
- Append-only, no rotation
- Location: project-local (`.polychromos/`)

**Credentials**: `~/.polychromos/credentials.json`
- User-global location
- Contains access/refresh tokens
- Secure permissions (chmod 600 / icacls)

#### Recommended Structure

```
~/.polychromos/
├── credentials.json      # Auth tokens (exists)
├── config.json           # Global CLI settings (new)
└── logs/
    ├── polychromos.log   # Main log file
    └── polychromos.log.1 # Rotated logs
```

**Implementation with pino**:
```typescript
import pino from 'pino';
import { join } from 'path';
import { homedir } from 'os';

const logPath = join(homedir(), '.polychromos', 'logs', 'polychromos.log');

const logger = pino({
  level: 'info',
}, pino.destination({
  dest: logPath,
  sync: false,
  mkdir: true
}));
```

---

## Privacy Considerations for Telemetry

If implementing telemetry (Sentry, OpenTelemetry, or analytics):

#### Legal Requirements (GDPR/CCPA)

- **Opt-in required**: Pre-checked boxes violate GDPR
- **Before collection**: Consent before software starts
- **Transparency**: Document exactly what's collected
- **Revocation**: Easy to disable as to enable

#### What NOT to Collect

- File paths or contents
- Environment variables
- Error messages with PII
- Secrets or credentials
- User emails or identifiers

#### Recommended Pattern

```typescript
// First run
const consent = await prompt(
  'Enable anonymous telemetry to help improve Polychromos? (Y/n)\n' +
  'Learn more: https://polychromos.dev/telemetry'
);

// Control mechanisms
// 1. Environment: POLYCHROMOS_TELEMETRY_DISABLED=1
// 2. CLI: polychromos telemetry disable
// 3. Config: ~/.polychromos/config.json { "telemetry": false }
```

---

## Code References

### Core CLI Files

| File | Purpose |
|------|---------|
| `packages/polychromos/src/index.ts` | CLI entry point |
| `packages/polychromos/src/commands/init.ts` | Init command (creates design.json only) |
| `packages/polychromos/src/commands/dev.ts` | Watch and sync |
| `packages/polychromos/src/lib/config.ts` | Config file handling |
| `packages/polychromos/src/lib/credentials.ts` | Credential storage |
| `packages/polychromos/src/lib/auth.ts` | Authentication + getConvexUrl() |
| `packages/polychromos/src/lib/version.ts` | Version reading |
| `packages/polychromos/src/lib/connectivity.ts` | Network state |
| `packages/polychromos/src/lib/retry.ts` | Retry with backoff |

### Key Locations

| Feature | Location |
|---------|----------|
| Production Convex URL | `auth.ts:26` |
| Config interface | `config.ts:4-7` |
| Workspace ID generation | `init.ts:5` |
| Single-flight pattern | `dev.ts:94-174` |
| Debounce config | `dev.ts:178-188` |
| Windows permissions | `credentials.ts:27-38` |
| Version reading | `version.ts:11-27` |

---

## Historical Context

Related research documents:
- `thoughts/shared/research/2026-02-03-polychromos-cli-comprehensive-documentation.md` - Comprehensive CLI documentation
- `thoughts/shared/plans/2026-02-03-polychromos-cli-production-must-haves.md` - Production readiness plan

---

## Critical Architectural Constraint: Convex Nesting Limit

### The Problem

**Convex enforces a 16-level nesting depth limit** on documents. The current architecture stores the entire workspace as a nested JSON structure in a single Convex document field (`data: v.any()`). This creates a ticking time bomb:

- Current examples: 6 levels deep
- TypeScript allows: Unlimited nesting via `children?: PolychromosElement[]`
- Users can build complex UIs that exceed 16 levels
- **No validation** prevents users from creating invalid structures

### Impact

Users who create deeply nested component trees will encounter:
1. Silent data loss when saving to Convex
2. Sync failures without clear error messages
3. Inability to recover their work

Example of hitting the limit:
```
Workspace (1)
└─ Component (2)
   └─ Root Element (3)
      └─ Section (4)
         └─ Container (5)
            └─ Card (6)
               └─ Header (7)
                  └─ Flex Row (8)
                     └─ Icon Box (9)
                        └─ SVG Container (10)
                           └─ Path Element (11)
                              └─ Gradient Def (12)
                                 └─ Stop (13)
                                    └─ Animated Stop (14)
                                       └─ Transform (15)
                                          └─ Nested Group (16)
                                             └─ ❌ LIMIT REACHED
```

### Solutions to Evaluate

#### Option 1: Document-Relational (Convex Recommended)
- Store elements in separate `elements` table
- Use `parentId` references instead of `children` arrays
- Pros: No nesting limit, better querying
- Cons: More complex queries, cannot index arrays

#### Option 2: Store as JSON String
- Store workspace as stringified JSON in Convex
- Parse/stringify client-side
- Pros: Bypasses nesting limit, simple migration
- Cons: Loses document querying, cannot use Convex validators

#### Option 3: Flatten Element Tree
- Flatten element tree to Record<id, Element> with parentId
- Store flattened structure in Convex
- Reconstruct tree client-side
- Pros: Stays within Convex ecosystem, queryable
- Cons: Client-side tree reconstruction overhead

#### Option 4: Hybrid Approach
- Workspace metadata as structured fields
- Element tree as JSON string or separate table
- Pros: Balance of queryability and flexibility
- Cons: Most complex implementation

### Immediate Actions Needed

1. **Add depth validation** before syncing to Convex
2. **User-facing error** when depth exceeds limit
3. **Architectural decision** on long-term solution
4. **Migration plan** if changing storage format

---

## Open Questions

1. **Config creation in init**: Should `init` create `.polychromos/config.json` with hardcoded production URL?
2. **Workspace ID source**: Should init use the generated workspace ID, or should backend create it?
3. **Telemetry consent**: When to prompt for telemetry consent (first run, after login)?
4. **Log rotation**: What size/age limits for log files?
5. **Update channel detection**: How to detect if user installed via `@alpha` vs `@latest`?
6. **❗ Storage architecture**: Which solution for nesting depth limit (relational, JSON string, flattened, hybrid)?
7. **Migration path**: How to migrate existing workspaces if storage format changes?

---

## Implementation Priority

Based on user impact and effort:

### P0 - Critical for Production (BLOCKERS)

**❗ Nesting Depth Limit (NEW)**:
1. Add depth validation to prevent exceeding 16 levels
2. Show user-facing error when depth limit approached
3. **Architectural decision** on storage format (see solutions above)
4. Implement chosen solution before public launch

**Config & URL**:
5. Fix init command to create `.polychromos/config.json`
6. Remove redundant `convexUrl` from per-project config (use `getConvexUrl()`)

### P1 - High Value
7. Implement structured logging with pino
8. Add `--verbose` and `--debug` flags
9. Add update notification (using `update-check`)

### P2 - Nice to Have
10. Add Sentry error tracking (opt-in)
11. Cross-platform testing matrix
12. Log file rotation

### P3 - Future Consideration
13. OpenTelemetry for end-to-end tracing
14. Telemetry/analytics (requires consent framework)

---

## Additional Research Documents

A follow-up research document should be created to evaluate the storage architecture options in detail:
- `thoughts/shared/research/2026-02-04-convex-storage-architecture-evaluation.md`

This should include:
- Detailed analysis of each option
- Performance benchmarks
- Migration complexity assessment
- Recommendation with rationale
