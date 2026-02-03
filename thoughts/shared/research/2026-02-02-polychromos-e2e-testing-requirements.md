---
date: 2026-02-02T12:24:26Z
researcher: Claude
git_commit: f698e11cf1e6e188e6504f189b3b4b23c5151372
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos E2E Testing Requirements and Coverage Analysis"
tags: [research, e2e-testing, polychromos, cli, convex, playwright]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Polychromos E2E Testing Requirements

**Date**: 2026-02-02T12:24:26Z
**Researcher**: Claude
**Git Commit**: f698e11cf1e6e188e6504f189b3b4b23c5151372
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Document all end-to-end flows in the Polychromos system that require testing, including CLI commands, Convex backend, web app flows, integration points, and current test coverage gaps.

## Summary

The Polychromos system consists of three main components:
1. **CLI Package** (`packages/polychromos/`) - 10 commands for workspace management, authentication, and version control
2. **Convex Backend** (`apps/polychromos-app/convex/`) - Real-time database with event sourcing for undo/redo
3. **Web App** (`apps/polychromos-app/src/`) - React frontend with Clerk authentication

Current testing covers:
- **Unit tests**: All CLI commands except `dev` are tested with mocked dependencies
- **Convex tests**: Backend mutations/queries have unit tests
- **E2E browser tests**: 7 Playwright tests covering auth UI and workspace creation

**Critical gap**: No E2E tests exist for the CLI → Convex integration. All CLI tests mock the Convex HTTP client.

---

## 1. CLI Commands

### File Locations
- Entry point: `packages/polychromos/src/index.ts`
- Commands: `packages/polychromos/src/commands/*.ts`
- Tests: `packages/polychromos/src/__tests__/commands/*.test.ts`

### Command Analysis

#### Authentication Commands

| Command | File | Dependencies | Currently Tested | What's Mocked |
|---------|------|--------------|------------------|---------------|
| `login` | `commands/login.ts` | readline, fs (credentials) | ✅ Yes | readline, fs |
| `logout` | `commands/logout.ts` | fs (credentials) | ✅ Yes | fs |
| `whoami` | `commands/whoami.ts` | fs, ConvexHttpClient | ✅ Yes | fs, Convex |

#### Project Commands

| Command | File | Dependencies | Currently Tested | What's Mocked |
|---------|------|--------------|------------------|---------------|
| `init` | `commands/init.ts` | fs (design.json) | ✅ Yes | fs |
| `dev` | `commands/dev.ts` | fs, chokidar, ConvexHttpClient | ❌ **NO** | N/A |

#### Version Control Commands

| Command | File | Dependencies | Currently Tested | What's Mocked |
|---------|------|--------------|------------------|---------------|
| `checkpoint` | `commands/checkpoint.ts` | fs (events.jsonl) | ✅ Yes | fs |
| `undo` | `commands/undo.ts` | fs, ConvexHttpClient | ✅ Yes | fs, Convex |
| `redo` | `commands/redo.ts` | fs, ConvexHttpClient | ✅ Yes | fs, Convex |
| `history` | `commands/history.ts` | fs, ConvexHttpClient | ✅ Yes | fs, Convex |
| `export` | `commands/export.ts` | fs | ✅ Yes | fs |

### Detailed Command Flows

#### `login` Command Flow
1. Display instructions for obtaining Clerk session token
2. Create readline interface for stdin
3. Prompt user for token input
4. Validate token is not empty
5. Save credentials to `~/.polychromos/credentials.json`
6. Set file permissions to `0o600`

**External Dependencies**:
- `fs/promises.mkdir()` - Creates `~/.polychromos` directory
- `fs/promises.writeFile()` - Saves credentials
- `fs/promises.chmod()` - Sets file permissions

#### `dev` Command Flow (UNTESTED)
1. Load config from `.polychromos/config.json`
2. Validate token with `getValidToken()`
3. Create `ConvexHttpClient` with config URL
4. Fetch initial workspace state via `workspaces:get` query
5. Set up 45-minute token refresh interval
6. Set up `chokidar` file watcher on `design.json`
7. On file change:
   - Debounce for 300ms
   - Read and parse `design.json`
   - Call `workspaces:update` mutation with single-flight pattern
   - Handle version conflicts
8. Handle SIGINT for graceful shutdown

**External Dependencies**:
- `ConvexHttpClient.query("workspaces:get")` - Fetch workspace state
- `ConvexHttpClient.mutation("workspaces:update")` - Sync changes
- `chokidar.watch()` - File system watching
- `fs/promises.readFile()` - Read design file

#### `undo` Command Flow
1. Load config from `.polychromos/config.json`
2. Create `ConvexHttpClient`
3. Call `workspaces:undo` mutation
4. If successful, write returned data to `design.json`
5. Display version transition message

**External Dependencies**:
- `ConvexHttpClient.mutation("workspaces:undo")`
- `fs/promises.writeFile()` - Updates local design file

#### `redo` Command Flow
1. Load config from `.polychromos/config.json`
2. Create `ConvexHttpClient`
3. Call `workspaces:redo` mutation
4. If successful, write returned data to `design.json`
5. Display version transition message

**External Dependencies**:
- `ConvexHttpClient.mutation("workspaces:redo")`
- `fs/promises.writeFile()` - Updates local design file

#### `history` Command Flow
1. Load config
2. Create `ConvexHttpClient`
3. Parallel fetch:
   - `workspaces:get` query for version info
   - `events:getHistory` query for event list
4. Display formatted history with current version marker

**External Dependencies**:
- `ConvexHttpClient.query("workspaces:get")`
- `ConvexHttpClient.query("events:getHistory")`

---

## 2. Convex Backend

### File Locations
- Schema: `apps/polychromos-app/convex/schema.ts`
- Workspaces: `apps/polychromos-app/convex/workspaces.ts`
- Events: `apps/polychromos-app/convex/events.ts`
- Auth helpers: `apps/polychromos-app/convex/lib/auth.ts`
- Tests: `apps/polychromos-app/convex/__tests__/*.test.ts`

### Database Schema

#### `workspaces` Table
| Field | Type | Purpose |
|-------|------|---------|
| `name` | string | Workspace name |
| `description` | string? | Optional description |
| `data` | any | Full PolychromosWorkspace JSON (current state) |
| `baseData` | any | Initial state for rebuilding from events |
| `eventVersion` | number | Current event position (0 = base state) |
| `maxEventVersion` | number | Highest event version (redo limit) |
| `version` | number | Optimistic concurrency control |
| `ownerId` | string | Clerk user subject |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |

**Index**: `by_owner` on `[ownerId]`

#### `events` Table
| Field | Type | Purpose |
|-------|------|---------|
| `workspaceId` | Id | Reference to workspace |
| `version` | number | Sequential event number |
| `timestamp` | number | When event occurred |
| `userId` | string | Clerk user who made change |
| `patches` | array | RFC6902 JSON patch operations |

**Indexes**:
- `by_workspace` on `[workspaceId]`
- `by_workspace_version` on `[workspaceId, version]`

### Mutations and Queries

#### Workspaces Module

| Function | Type | Auth Required | Called By |
|----------|------|---------------|-----------|
| `get` | Query | Soft (returns null) | CLI (whoami, history), Web App |
| `list` | Query | Soft (returns []) | CLI (whoami), Web App |
| `create` | Mutation | Strict | Web App only |
| `update` | Mutation | Strict + ownership | CLI (dev) |
| `undo` | Mutation | Strict + ownership | CLI (undo) |
| `redo` | Mutation | Strict + ownership | CLI (redo) |

#### Events Module

| Function | Type | Auth Required | Called By |
|----------|------|---------------|-----------|
| `getHistory` | Query | Strict + ownership | CLI (history), Web App |
| `recordEvent` | Mutation | Strict + ownership | (Not currently used) |

### Auth Helper Functions

```typescript
// lib/auth.ts:4-10
requireAuth(ctx)
// - Gets Clerk identity from ctx.auth.getUserIdentity()
// - Throws "Unauthenticated" if no identity
// - Returns identity object

// lib/auth.ts:12-28
requireWorkspaceAccess(ctx, workspaceId)
// - Calls requireAuth() first
// - Fetches workspace from database
// - Throws "Workspace not found" if missing
// - Throws "Access denied" if ownerId !== identity.subject
// - Returns { identity, workspace }
```

---

## 3. Web App Authenticated Flows

### File Locations
- Router: `apps/polychromos-app/src/router.tsx`
- Main route: `apps/polychromos-app/src/routes/index.tsx`
- Version controls: `apps/polychromos-app/src/components/version-controls.tsx`

### Convex Integration Setup

**Router Configuration** (`router.tsx:48-54`):
```typescript
<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

### UI Actions → Convex Mutations

#### Create New Design Flow
```
User clicks "Create New Design" button
  ↓
handleCreateNewDesign() (index.tsx:65)
  ↓
createWorkspaceMutation({ name, data }) (index.tsx:101)
  ↓
api.workspaces.create (workspaces.ts:41)
  ↓
Database insert with ownerId = identity.subject
  ↓
Returns workspaceId
  ↓
navigate({ search: { workspace: workspaceId } })
  ↓
WorkspacePreview component renders with useQuery
```

#### Version Controls Display (Read-only)
```
VersionControls mounts (version-controls.tsx:23)
  ↓
useQuery(api.workspaces.get, { id }) (version-controls.tsx:30)
useQuery(api.events.getHistory, { workspaceId }) (version-controls.tsx:35)
  ↓
Displays: "v{version} · {count} changes"
```

**Note**: Undo/Redo buttons exist but are NOT connected to Convex mutations yet. They only log console messages.

---

## 4. Integration Points Matrix

### CLI ↔ Convex

| CLI Command | Convex Query | Convex Mutation |
|-------------|--------------|-----------------|
| `whoami` | `workspaces:list` | - |
| `dev` | `workspaces:get` | `workspaces:update` |
| `undo` | - | `workspaces:undo` |
| `redo` | - | `workspaces:redo` |
| `history` | `workspaces:get`, `events:getHistory` | - |

### Web App ↔ Convex

| UI Action | Convex Query | Convex Mutation |
|-----------|--------------|-----------------|
| Page load with workspace ID | `workspaces:get` | - |
| Version controls display | `workspaces:get`, `events:getHistory` | - |
| Create new design | - | `workspaces:create` |
| Undo button (TODO) | - | `workspaces:undo` |
| Redo button (TODO) | - | `workspaces:redo` |

### Shared State

| Data | Written By | Read By |
|------|------------|---------|
| Workspace `data` | CLI (`dev`), Web App (create) | CLI (undo, redo), Web App (preview) |
| Workspace `eventVersion` | CLI (`dev`, undo, redo) | CLI (history), Web App (version controls) |
| Events (patches) | CLI (`dev`) | CLI (history), Web App (version controls) |

---

## 5. Critical E2E Test Scenarios

### Authentication Flow Tests

| Scenario | Current Status | Priority |
|----------|----------------|----------|
| CLI login saves valid token | Unit tested (mocked) | High |
| CLI login with real Clerk token | **NOT TESTED** | Critical |
| CLI commands fail gracefully with invalid token | Unit tested (mocked) | High |
| CLI token refresh during long `dev` session | **NOT TESTED** | High |

### CLI → Convex Sync Tests

| Scenario | Current Status | Priority |
|----------|----------------|----------|
| `dev` command syncs design.json to Convex | **NOT TESTED** | Critical |
| `dev` detects version conflicts | **NOT TESTED** | Critical |
| `undo` retrieves previous state from Convex | Unit tested (mocked) | Critical |
| `redo` retrieves next state from Convex | Unit tested (mocked) | Critical |
| `history` displays events from Convex | Unit tested (mocked) | High |

### Cross-Platform Sync Tests

| Scenario | Current Status | Priority |
|----------|----------------|----------|
| Changes from CLI appear in web app | **NOT TESTED** | Critical |
| Changes from web app can be seen by CLI | **NOT TESTED** | Critical |
| Simultaneous CLI and web edits (conflict) | **NOT TESTED** | High |

### Error Handling Tests

| Scenario | Current Status | Priority |
|----------|----------------|----------|
| Auth failures return appropriate errors | Unit tested (mocked) | High |
| Network timeout during sync | **NOT TESTED** | Medium |
| Convex rate limiting | **NOT TESTED** | Low |
| Invalid workspace ID handling | E2E tested | Medium |

---

## 6. Current Test Coverage Gap Analysis

### What IS Tested

#### CLI Unit Tests (9 commands)
- `login.test.ts` - Token input, credential saving
- `logout.test.ts` - Credential clearing
- `whoami.test.ts` - Auth status display
- `init.test.ts` - Design file creation
- `checkpoint.test.ts` - Local checkpoint creation
- `undo.test.ts` - Undo with mocked Convex
- `redo.test.ts` - Redo with mocked Convex
- `history.test.ts` - History with mocked Convex
- `export.test.ts` - HTML/Tailwind export

**All use `memfs` for filesystem and mock `ConvexHttpClient`**

#### CLI Integration Tests
- `cli-convex-sync.test.ts` - Tests single-flight pattern logic
- **Uses mock mutation functions, NOT real Convex**

#### Convex Backend Tests
- `workspaces.test.ts` - Workspace CRUD operations
- `events.test.ts` - Event recording and history
- **Uses Convex test harness**

#### E2E Browser Tests (Playwright)
- `access-control.spec.ts` - Auth-gated UI elements (2 tests)
- `access-control.unauth.spec.ts` - Unauthenticated access (1 test)
- `auth-ui.spec.ts` - Clerk UI components (2 tests)
- `auth-ui.unauth.spec.ts` - Sign-in button visibility (1 test)
- `workspace-flow.spec.ts` - Workspace creation (3 tests)

**Total: 9 E2E tests covering web app only**

### What is NOT Tested

#### CLI with Real Convex (Critical Gap)
1. **Real HTTP client connection** - All CLI tests mock `ConvexHttpClient`
2. **Real authentication flow** - Token validation against live Convex
3. **Real mutation execution** - `workspaces:update`, `workspaces:undo`, `workspaces:redo`
4. **Real query execution** - `workspaces:get`, `workspaces:list`, `events:getHistory`
5. **Version conflict handling** - OCC with `expectedVersion`

#### `dev` Command (Completely Untested)
1. **File watching** - `chokidar.watch("design.json")`
2. **Debouncing** - 300ms debounce logic
3. **Single-flight pattern** - Coalescing rapid changes
4. **Token refresh** - 45-minute interval refresh
5. **SIGINT handling** - Graceful shutdown
6. **Real-time sync** - Changes reflected in Convex

#### Cross-Component Integration
1. **CLI changes visible in web app** - No test verifies real sync
2. **Web app state readable by CLI** - No test verifies read path
3. **Concurrent editing** - CLI + web app simultaneously
4. **Workspace sharing** - Multiple users (if supported)

#### Error Scenarios
1. **Network failures** - Timeout, disconnect
2. **Rate limiting** - Convex throttling
3. **Concurrent version conflicts** - Two clients editing
4. **Corrupted local state** - Invalid design.json
5. **Token expiry mid-operation** - Auth during long sync

---

## Recommended E2E Test Strategy

### Tier 1: Critical Path (Must Have)

1. **CLI Auth with Real Clerk**
   ```
   Test: polychromos login accepts valid Clerk session token
   Verify: Token stored in ~/.polychromos/credentials.json
   Verify: Subsequent commands authenticate successfully
   ```

2. **CLI Dev Sync**
   ```
   Test: polychromos dev syncs design.json changes to Convex
   Setup: Create workspace via API, configure CLI
   Action: Modify design.json
   Verify: Changes appear in Convex (query workspace)
   ```

3. **CLI ↔ Web App Sync**
   ```
   Test: CLI changes appear in web app
   Setup: Create workspace, run polychromos dev
   Action: Modify design.json via CLI
   Verify: Web app shows updated content
   ```

4. **Version Control Roundtrip**
   ```
   Test: undo/redo work with real Convex
   Setup: Create workspace, make changes via dev
   Action: Run polychromos undo
   Verify: design.json matches previous state
   Verify: Web app shows previous state
   Action: Run polychromos redo
   Verify: design.json restored
   ```

### Tier 2: Error Handling (Should Have)

5. **Invalid Token Rejection**
   ```
   Test: CLI commands fail gracefully with invalid token
   Setup: Save invalid token to credentials
   Action: Run polychromos whoami
   Verify: Clear error message, suggests re-login
   ```

6. **Version Conflict Detection**
   ```
   Test: CLI detects concurrent edits
   Setup: Two CLI instances, same workspace
   Action: Both modify design.json
   Verify: Second sync gets version conflict error
   ```

### Tier 3: Edge Cases (Nice to Have)

7. **Token Refresh During Long Session**
8. **Network Disconnect Recovery**
9. **Large Workspace Sync Performance**

---

## Code References

### CLI Command Files
- `packages/polychromos/src/commands/login.ts:4` - Login entry point
- `packages/polychromos/src/commands/dev.ts:11` - Dev entry point
- `packages/polychromos/src/commands/undo.ts:14` - Undo entry point
- `packages/polychromos/src/commands/redo.ts:14` - Redo entry point
- `packages/polychromos/src/commands/history.ts:16` - History entry point

### Convex Backend Files
- `apps/polychromos-app/convex/schema.ts:5-34` - Database schema
- `apps/polychromos-app/convex/workspaces.ts:41` - Create mutation
- `apps/polychromos-app/convex/workspaces.ts:65` - Update mutation
- `apps/polychromos-app/convex/workspaces.ts:126` - Undo mutation
- `apps/polychromos-app/convex/workspaces.ts:167` - Redo mutation
- `apps/polychromos-app/convex/events.ts:37` - GetHistory query

### Web App Files
- `apps/polychromos-app/src/router.tsx:48-54` - Convex/Clerk provider setup
- `apps/polychromos-app/src/routes/index.tsx:63` - Create mutation hook
- `apps/polychromos-app/src/routes/index.tsx:155-158` - Workspace query
- `apps/polychromos-app/src/components/version-controls.tsx:30-38` - Version queries

### Test Files
- `packages/polychromos/src/__tests__/commands/*.test.ts` - CLI unit tests
- `packages/polychromos/test/integration/cli-convex-sync.test.ts` - Integration tests
- `apps/polychromos-app/convex/__tests__/*.test.ts` - Convex backend tests
- `apps/polychromos-app/e2e/browser/*.spec.ts` - Playwright E2E tests
- `apps/polychromos-app/playwright.config.ts` - E2E configuration

---

## Open Questions

1. **Test Environment**: Should CLI E2E tests use a dedicated Convex deployment or the same dev instance?
2. **Test Data Isolation**: How to prevent test workspaces from polluting real data?
3. **CI/CD Integration**: How to provide Clerk credentials securely in CI?
4. **Performance Baseline**: What are acceptable sync latency thresholds?
5. **Flakiness Mitigation**: How to handle network variability in tests?
