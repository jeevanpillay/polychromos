---
date: 2026-02-03T12:00:00+00:00
researcher: Claude
git_commit: cf6918f94234a303450c3350f25c82f45e20e44c
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos CLI Comprehensive Documentation"
tags: [research, codebase, polychromos, cli, documentation]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
decision_documented: 2026-02-03
related_plan: thoughts/shared/plans/2026-02-03-polychromos-cli-production-must-haves.md
---

# Research: Polychromos CLI Comprehensive Documentation

**Date**: 2026-02-03T12:00:00+00:00
**Researcher**: Claude
**Git Commit**: cf6918f94234a303450c3350f25c82f45e20e44c
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Comprehensive documentation of 12 aspects of the Polychromos CLI:
1. Offline/Network Resilience
2. Concurrent Editing Conflicts
3. CLI Update Notifications
4. Cross-Platform Path Handling
5. HTML/Tailwind Export Quality
6. Debug/Verbose Mode
7. Large File Performance
8. Proxy/Firewall Support
9. Logging Location
10. Uninstall Cleanup
11. Multi-Workspace Support
12. Telemetry/Analytics

## Summary

The Polychromos CLI is a TypeScript-based command-line tool that synchronizes local `design.json` files with a Convex backend. The codebase follows a privacy-first, minimal-complexity approach with many features intentionally not implemented in the current MVP. Key findings:

- **Network resilience**: No retry logic or offline detection; errors are logged and sync continues
- **Conflict resolution**: Optimistic concurrency control via version numbers; no merge capability
- **Version management**: Hardcoded version strings; no update checking or notifications
- **Cross-platform**: Uses Node.js standard libraries correctly; chmod is a no-op on Windows
- **Export**: Supports HTML and Tailwind formats; no token resolution or validation
- **Debugging**: No verbose flag or log levels; console output only
- **Performance**: Full file loaded into memory; 16 MiB Convex limit; 500ms debounce
- **Proxy support**: None; relies on Node.js fetch defaults
- **Logging**: Console-only plus local `.polychromos/events.jsonl`
- **Cleanup**: No uninstall hooks; files persist after npm uninstall
- **Multi-workspace**: One workspace per directory; no switching
- **Telemetry**: None implemented; privacy-first design

---

## Detailed Findings

### 1. Offline/Network Resilience

#### Network Failure Handling

When Convex is unreachable during `polychromos dev`:

**Initial fetch behavior** (`packages/polychromos/src/commands/dev.ts:42-58`):
- Logs warning: `"⚠ Could not fetch workspace state:"`
- Process continues with default version counters (`currentVersion = 1`, `eventVersion = 0`)
- Non-fatal; file watching continues

**Sync failure behavior** (`packages/polychromos/src/commands/dev.ts:102-128`):
- Errors logged via `console.error()` with specific messages:
  - `"✗ Conflict detected - please reload to get latest version"`
  - `"✗ Authentication expired. Run 'polychromos login'"`
  - `"✗ Access denied to this workspace"`
  - `"✗ Sync failed:"` (generic)
- **No retry logic**: Failed syncs are dropped
- File watcher continues; next file change triggers new sync attempt

#### Request Queuing

**ConvexHttpClient internal queue**: Processes mutations serially; failed mutations are rejected and removed from queue (not re-queued).

**CLI-level single-flight pattern** (`dev.ts:72-138`):
- `pendingMutation` prevents concurrent mutations
- `pendingData` holds latest state during in-flight mutation
- Multiple rapid changes coalesce to single mutation with final state
- **Failed mutations are lost**; queue is in-memory only

#### Offline Detection

**No proactive offline detection**. The CLI only discovers network issues when operations fail. No connectivity checks, ping mechanisms, or offline warnings.

#### Local-Only Mode

Commands that work offline:
- `init` - Creates local `design.json` only
- `export` - Reads local file, exports HTML/Tailwind
- `login` - Saves credentials locally
- `logout` - Deletes local credentials

Commands requiring network:
- `dev`, `undo`, `redo`, `history`, `whoami`

#### Timeout Configuration

**No configurable timeouts**. The ConvexHttpClient uses platform-default fetch behavior. Node.js 18+ native fetch has no built-in timeout.

#### Partial Sync Recovery

Convex mutations are atomic (all-or-nothing). If sync is interrupted:
- Remote state: Either fully updated or unchanged
- Local state: Version counters unchanged
- Recovery: Next file change triggers fresh sync attempt

---

### 2. Concurrent Editing Conflicts

#### Conflict Detection Mechanism

Uses **Optimistic Concurrency Control (OCC)** via `expectedVersion` parameter:

**Initial version fetch** (`dev.ts:39-58`):
```typescript
let currentVersion = 1;
let eventVersion = 0;
const workspace = await convexClient.query("workspaces:get", { id: config.workspaceId });
if (workspace) {
  currentVersion = workspace.version;
  eventVersion = workspace.eventVersion;
}
```

**Version sent on every sync** (`dev.ts:86-92`):
```typescript
const result = await convexClient.mutation("workspaces:update", {
  id: config.workspaceId,
  data: toSync,
  expectedVersion: currentVersion,
});
```

**Backend validation** (`apps/polychromos-app/convex/workspaces.ts:77-79`):
```typescript
if (existing.version !== args.expectedVersion) {
  throw new Error("Version conflict");
}
```

#### Conflict Resolution

When conflict detected (`dev.ts:103-109`):
```
✗ Conflict detected - please reload to get latest version
```

**User options**:
1. Restart `polychromos dev` to fetch latest version
2. Manually overwrite local `design.json`

**No merge capability**. Last-write-wins only. No three-way merge, conflict markers, or interactive resolution.

#### Race Conditions

If CLI and web app save simultaneously:
- Both send mutations with same `expectedVersion`
- Convex processes serially (database transactions are atomic)
- First mutation succeeds, second gets "Version conflict"
- No priority; winner determined by network timing

#### Lock Mechanisms

**No file locking or workspace locking**. Only protection is:
- CLI-side single-flight pattern (one mutation at a time from same CLI instance)
- Debouncing (300ms + 200ms stability threshold)
- OCC version checking on backend

#### Conflict Notification

**CLI → Web App**: Real-time via WebSocket (Convex `useQuery` reactivity)
**Web App → CLI**: No notification; CLI only discovers on next sync attempt

---

### 3. CLI Update Notifications

#### Version Display

**Defined in two locations** (not synchronized):
- `packages/polychromos/package.json:3`: `"version": "1.0.0"`
- `packages/polychromos/src/index.ts:20`: `.version("1.0.0")`
- `packages/polychromos/src/commands/dev.ts:14`: `console.log("Polychromos CLI v1.0.0")`

Users see version via:
- `polychromos --version` (Commander.js automatic)
- `polychromos dev` banner output

#### Update Checking

**Not implemented**. No code checks npm registry for newer versions.

#### Update Notifications

**Not implemented**. Users are not warned when running an outdated CLI.

#### Changelog Access

**Not available from CLI**. Changelogs are generated via Changesets and published to GitHub releases.

#### Auto-Update

**Not implemented**. Manual `npm update -g polychromos` required.

#### Version Compatibility

**Not checked**. CLI doesn't verify compatibility with Convex backend API version.

---

### 4. Cross-Platform Path Handling

#### Home Directory Resolution

**Correctly implemented** (`packages/polychromos/src/lib/credentials.ts:3-6`):
```typescript
import { homedir } from "os";
import { join } from "path";
const CREDENTIALS_DIR = join(homedir(), ".polychromos");
```

`os.homedir()` returns:
- Windows: `C:\Users\<username>` (from `USERPROFILE`)
- macOS: `/Users/<username>` (from `HOME`)
- Linux: `/home/<username>` (from `HOME`)

#### Path Separators

**Consistent use of `path.join()`** across all file operations:
- `credentials.ts:5-6`: Credentials directory
- `config.ts:14,31`: Config file path
- `version-manager.ts:26-28`: Version control files

**No hardcoded `/` or `\` separators** in path construction.

#### File Permissions

**chmod 0o600 on credentials** (`credentials.ts:23`):
- Unix-like systems: Works correctly (owner read/write only)
- **Windows: No-op** (chmod has no effect; Windows uses ACLs)
- Credentials not secured on Windows through this mechanism

#### Line Endings

**JSON files**:
- `JSON.stringify()` always uses `\n` (LF)
- `JSON.parse()` accepts both CRLF and LF
- CLI normalizes to LF on write

**JSONL events log**:
- Explicitly uses `\n` for line endings
- Reading splits on `\n`; CRLF would cause parsing errors

#### Case Sensitivity

All directory and file names use consistent lowercase:
- `.polychromos`, `credentials.json`, `config.json`, `design.json`
- No case variation issues across platforms

#### Shebang

`#!/usr/bin/env node` (`index.ts:1`):
- Unix-like systems: Honored by shell
- Windows: Ignored; npm generates `.cmd` wrapper

---

### 5. HTML/Tailwind Export Quality

#### Export Implementation

**Two formats** (`packages/polychromos/src/commands/export.ts`):
- `html`: Inline CSS with generated `.poly-<id>` classes
- `tailwind`: Utility classes from Tailwind CDN

#### Property Coverage

**HTML format maps these properties**:
- Position: `x`, `y` (but no `position: absolute` added)
- Size: `width`, `height` (numeric and string values)
- Layout: `display`, `flexDirection`, `justifyContent`, `alignItems`, `gap`
- Spacing: `padding`, `margin` (1/2/4-tuple values via `formatSpacing()`)
- Style: `backgroundColor`, `borderRadius`, `border`, `opacity`
- Typography: `fontFamily`, `fontSize`, `fontWeight`, `color`, `textAlign`, `lineHeight`
- Image: `objectFit`

**Tailwind format maps fewer properties**:
- Layout: `flex`, `grid`, `flex-col`, `justify-center`, `justify-between`, `items-center`
- Size: Numeric values via arbitrary syntax, `w-full`, `h-full`
- Spacing: All tuple formats via arbitrary syntax
- Missing: `fontFamily`, `lineHeight`, `border`, `objectFit`

#### Edge Cases

**4-tuple padding/margin**: Correctly handled in both formats
**WebGL elements**: Exported as `<canvas data-shader="...">` (non-functional without JS)
**Token resolution**: **Not implemented**. Token references pass through as-is

#### Validation

**No validation** of exported HTML/CSS. No W3C validation, Tailwind class validation, or visual regression testing.

---

### 6. Debug/Verbose Mode

#### Verbose Flag

**Not implemented**. No `--verbose` or `--debug` flags on any command.

#### Log Levels

**No structured log levels**. Uses direct console methods:
- `console.log()` - Success messages with ✓
- `console.error()` - Error messages with ✗
- `console.warn()` - Warning messages with ⚠

#### Request Logging

**Not implemented**. Users cannot see actual Convex mutations/queries being sent.

#### Timing Information

**Partial**: `dev` command shows timestamp when sync starts (`[HH:MM:SS] Syncing design...`)
**Not measured**: Sync duration, network latency, file read time

#### Dry-Run Mode

**Not implemented**. No way to preview what would be synced without syncing.

#### Environment Variables

**Only one**: `POLYCHROMOS_TOKEN` for headless authentication
**Not supported**: `DEBUG`, `LOG_LEVEL`, `VERBOSE`

---

### 7. Large File Performance

#### File Size Limits

**No explicit limits**. Implicit 16 MiB limit from Convex mutation payload size.

#### Memory Usage

**Full file loaded into memory** (`dev.ts:155`):
```typescript
const content = await readFile("design.json", "utf-8");
const data = JSON.parse(content);
```

**2-3x memory overhead** from `structuredClone()` for version snapshots.

#### Debouncing Configuration

**Two-layer system**:
1. Chokidar write stabilization: 200ms threshold, 100ms poll interval (`dev.ts:142-145`)
2. setTimeout debounce: 300ms (`dev.ts:162`)

**Total latency**: ~500ms from file save to sync start

#### Diff Optimization

**Patches generated server-side only** (`workspaces.ts:82`):
- CLI sends full workspace data every sync
- Convex generates RFC 6902 patches for event storage
- Network payload = full workspace size

---

### 8. Proxy/Firewall Support

#### HTTP Proxy

**Not explicitly supported**. CLI doesn't check `HTTP_PROXY`, `HTTPS_PROXY` environment variables.

**Depends on Node.js fetch behavior**: Node.js 18+ native fetch does not automatically respect proxy environment variables.

#### Custom Certificates

**Not configurable**. No support for custom CA certificates, `NODE_EXTRA_CA_CERTS`, or `NODE_TLS_REJECT_UNAUTHORIZED`.

#### Firewall Ports

**Required**: HTTPS (443) for production Convex URLs
**Protocol**: HTTPS only (no WebSocket connections)
**Local dev**: HTTP on port 3210

#### Network Configuration

**No CLI flags or config options** for proxy settings.

#### Air-Gapped Environments

**Not supported**. Commands requiring network will fail without internet access.

---

### 9. Logging Location

#### Log Files

**No file-based application logs**. All output goes to console (stdout/stderr).

#### Event Journal

**Local event log** at `.polychromos/events.jsonl` (`version-manager.ts:26`):
- JSONL format (one JSON entry per line)
- Contains: version number, timestamp, RFC 6902 patches, checkpoint names
- Used for local undo/redo
- **Append-only**, no rotation or cleanup

#### Snapshot Files

- `.polychromos/base.json` - Initial state for rebuilding
- `.polychromos/snapshot.json` - Current state

#### Audit Trail

**Remote via `history` command** - Queries Convex for version history
**Local via `events.jsonl`** - Machine-readable only

#### Log Rotation

**Not implemented**. Event log grows indefinitely.

#### Export Logs

**Not implemented**. No command to export logs for debugging/support.

---

### 10. Uninstall Cleanup

#### npm uninstall Behavior

**No cleanup hooks** in `package.json`. Files persist after uninstall:

**Global**:
- `~/.polychromos/credentials.json` - Authentication tokens
- `~/.polychromos/` directory

**Per-project**:
- `.polychromos/config.json` - Convex URL, workspace ID
- `.polychromos/events.jsonl` - Version history
- `.polychromos/snapshot.json`, `base.json` - State snapshots
- `design.json` - User's workspace file

#### Cleanup Commands

**Not implemented**. No `polychromos cleanup`, `polychromos reset`, or `polychromos purge` commands.

**`polychromos logout`** only deletes `credentials.json`, not the directory.

#### Documentation

**Not documented**. No uninstall instructions or cleanup guidance.

---

### 11. Multi-Workspace Support

#### Current Model

**One workspace per directory**. Workspace ID stored in `.polychromos/config.json`:
```typescript
interface PolychromosConfig {
  convexUrl: string;
  workspaceId: string;
}
```

#### Workspace Switching

**Not supported**. No `--workspace` flag, no workspace selection commands.

#### Monorepo Support

**Not explicitly supported**. Users can have multiple directories, each with own config. No monorepo-aware commands or workspace orchestration.

#### Config Hierarchy

**Two levels** (separate concerns):
- Project: `.polychromos/config.json` (workspace ID, Convex URL)
- Global: `~/.polychromos/credentials.json` (authentication)

No inheritance or merging.

#### Workspace Discovery

**No parent directory traversal**. `loadConfig()` reads from current directory only.

#### Workspace Linking

**Technically possible** but not managed. Users can manually create multiple directories with same workspace ID; OCC handles conflicts.

---

### 12. Telemetry/Analytics

#### Current Telemetry

**None implemented**. Zero analytics code in the codebase.

#### Dependencies

No analytics packages in dependencies:
- No PostHog, Segment, Mixpanel, Amplitude, or similar

#### Privacy Posture

**Privacy-first implementation**:
- No data collection
- Local-first architecture
- Only authenticated Convex API calls
- Secure credential storage (0600 permissions)
- No tracking IDs, device fingerprinting, or session IDs

---

## Code References

### Core Files

| File | Purpose |
|------|---------|
| `packages/polychromos/src/index.ts` | CLI entry point, command definitions |
| `packages/polychromos/src/commands/dev.ts` | Watch and sync, version tracking |
| `packages/polychromos/src/commands/export.ts` | HTML/Tailwind export |
| `packages/polychromos/src/lib/config.ts` | Project configuration |
| `packages/polychromos/src/lib/credentials.ts` | Authentication storage |
| `packages/polychromos/src/lib/version-manager.ts` | Local version control |
| `apps/polychromos-app/convex/workspaces.ts` | Backend mutations, OCC |
| `apps/polychromos-app/convex/schema.ts` | Database schema |

### Key Line References

| Feature | Location |
|---------|----------|
| Version display | `index.ts:20`, `dev.ts:14` |
| Single-flight pattern | `dev.ts:72-138` |
| OCC validation | `workspaces.ts:77-79` |
| Debounce config | `dev.ts:142-146, 162` |
| Token refresh | `dev.ts:60-70` |
| Home directory | `credentials.ts:5` |
| chmod permissions | `credentials.ts:23` |
| Export formats | `export.ts:13-14` |
| Event log | `version-manager.ts:26` |

---

## Architecture Documentation

### Data Flow

```
User edits design.json
        ↓
Chokidar detects change (200ms stability)
        ↓
Debounce timer (300ms)
        ↓
Single-flight check (skip if mutation in flight)
        ↓
Full workspace sent to Convex
        ↓
Backend validates expectedVersion
        ↓
Patches generated, event stored
        ↓
Version incremented
        ↓
WebSocket pushes update to web app
```

### Configuration Locations

```
~/.polychromos/
  └── credentials.json    # Global auth tokens

<project>/.polychromos/
  ├── config.json         # Workspace ID, Convex URL
  ├── events.jsonl        # Local version history
  ├── snapshot.json       # Current state
  └── base.json           # Initial state

<project>/design.json     # User's workspace file
```

### Error Handling Patterns

- Network errors: Log and continue (dev command)
- Version conflicts: Log and require manual resolution
- Auth errors: Log and suggest re-login
- File errors: Log and exit (most commands)

---

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - Architecture overview
- `thoughts/shared/research/2026-02-03-polychromos-cli-user-experience-upgrade-path.md` - UX research
- `thoughts/shared/plans/2026-02-02-polychromos-mvp-implementation.md` - MVP implementation plan

---

## Open Questions

1. **Windows credential security**: chmod is a no-op; should Windows ACLs be set?
2. **Offline resilience**: Should failed syncs be queued for retry?
3. **Update notifications**: Should CLI check npm registry for updates?
4. **Token resolution in exports**: Should design tokens be resolved to actual values?
5. **Log rotation**: Should events.jsonl have size limits or rotation?
6. **Cleanup on uninstall**: Should npm hooks clean up `.polychromos/` directories?

---

## Production Readiness Decision (2026-02-03)

Based on this research, a prioritized implementation plan was created to address critical gaps before production release. See: `thoughts/shared/plans/2026-02-03-polychromos-cli-production-must-haves.md`

### Decisions Made

#### MUST HAVE for Production (Will Implement)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Network retry with exponential backoff | Currently a single network hiccup causes **silent data loss**. Failed syncs are dropped with no retry. This is unacceptable for a sync tool. |
| **P0** | Offline detection & warning | Users can edit files for hours without knowing changes aren't syncing. Need prominent visual warning when offline. |
| **P1** | Single-source version | Version hardcoded in 3 places (`package.json`, `index.ts:20`, `dev.ts:14`) causes release errors. Read from `package.json` at runtime. |
| **P1** | Windows credential security | `chmod(0o600)` is a no-op on Windows. Use `icacls` for proper ACL-based security on Windows. |

#### Open Questions Resolved

1. **Windows credential security**: ✅ **YES** - Will use `icacls` command for Windows ACL permissions (P1)
2. **Offline resilience**: ✅ **YES** - Will implement retry with exponential backoff (P0) and offline detection (P0)
3. **Update notifications**: ❌ **NO** - Deferred. `npm outdated` handles this adequately for now.
4. **Token resolution in exports**: ❌ **NO** - Deferred. Export is secondary workflow; tokens pass through as-is.
5. **Log rotation**: ❌ **NO** - Deferred. Event log is small; can address if users report issues.
6. **Cleanup on uninstall**: ❌ **NO** - Deferred. Files are small; users can manually delete `~/.polychromos/`.

#### Explicitly Deferred for Post-Launch

These features were evaluated and intentionally deferred:

| Feature | Why Deferred |
|---------|--------------|
| Update notifications | `npm outdated` handles this; low user impact |
| Dry-run mode | Useful but not critical for core sync workflow |
| Log file rotation | Event log grows slowly; not urgent |
| Multi-workspace support | One workspace per directory is sufficient |
| Proxy/firewall configuration | Users can configure system-level proxies |
| Token resolution in exports | Export is secondary; can add later |
| Automatic conflict resolution | Too risky without user input; manual is safer |
| Uninstall cleanup hooks | Files are small; manual cleanup is acceptable |
| Verbose/debug mode | Console output is sufficient for MVP |
| Request logging | Not needed for typical user; can add for debugging later |

### Implementation Status

- [ ] Phase 1: Network retry with exponential backoff (P0)
- [ ] Phase 2: Offline detection & warning (P0)
- [ ] Phase 3: Single-source version (P1)
- [ ] Phase 4: Windows credential security (P1)

### Risk Assessment

**With these 4 phases implemented:**
- ✅ No silent data loss on transient network failures
- ✅ Users are warned when working offline
- ✅ Release process is reliable (single version source)
- ✅ Credentials secure on all platforms

**Remaining acceptable risks:**
- Users on outdated CLI versions (can check manually with `npm outdated`)
- Large event logs over time (users can delete `.polychromos/events.jsonl`)
- No automatic conflict merge (users restart CLI to fetch latest)
