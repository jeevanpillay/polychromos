---
date: 2026-02-03T07:07:42+08:00
researcher: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos CLI End-User Experience and Upgrade Path"
tags: [research, polychromos, cli, config, credentials, versioning, migration, error-handling]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Polychromos CLI End-User Experience and Upgrade Path

**Date**: 2026-02-03T07:07:42+08:00
**Researcher**: Claude
**Git Commit**: cedfb4bbf2f1a7801785b0d985611f71b95f4049
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Document the end-user experience and upgrade path for the @packages/polychromos/ CLI package, specifically:
1. Config file schema and versioning
2. Migration strategy
3. First-run experience
4. design.json schema versioning
5. Backwards compatibility
6. Credential expiry handling
7. Error recovery

## Summary

The Polychromos CLI (V1) has a **minimal, pragmatic approach** to configuration and versioning:

| Aspect | Current State | Implications |
|--------|---------------|--------------|
| **Config versioning** | No version field | Config changes would break silently |
| **Migration strategy** | None exists | Users must manually fix broken configs |
| **First-run experience** | Clear but manual | Guided setup with explicit error messages |
| **design.json versioning** | `version: "1.0"` literal | Strict validation rejects unknown versions |
| **Backwards compatibility** | None explicitly handled | Older CLI fails on newer design.json |
| **Credential expiry** | 5-minute buffer check | Clear re-auth prompt, no auto-refresh |
| **Error recovery** | Basic try/catch | No automatic retry or repair mechanisms |

This is appropriate for V1 MVP but would need enhancement for production maturity.

---

## Detailed Findings

### 1. Config File Schema and Versioning

#### `.polychromos/config.json` (Project-level)

**Location**: `.polychromos/config.json` (relative to project directory)

**Schema** (`packages/polychromos/src/lib/config.ts:4-7`):
```typescript
export interface PolychromosConfig {
  convexUrl: string;
  workspaceId: string;
}
```

**Versioning**: **None**
- No `version` field in the config schema
- No schema validation beyond checking required fields exist
- Changes to config structure would require users to manually update

**Loading behavior** (`packages/polychromos/src/lib/config.ts:12-28`):
```typescript
export async function loadConfig(): Promise<PolychromosConfig | null> {
  try {
    const configPath = join(CONFIG_DIR, CONFIG_FILE);
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as PolychromosConfig;

    // Validate required fields
    if (!config.convexUrl || !config.workspaceId) {
      return null;
    }

    return config;
  } catch {
    // Config file doesn't exist or is invalid
    return null;
  }
}
```

**What happens on config structure change**:
- Missing required fields → returns `null` (treated as unconfigured)
- Extra fields → silently ignored (type cast bypasses validation)
- Invalid JSON → returns `null` (caught in catch block)

#### `~/.polychromos/credentials.json` (Global)

**Location**: `~/.polychromos/credentials.json` (user home directory)

**Schema** (`packages/polychromos/src/lib/credentials.ts:8-12`):
```typescript
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
```

**Versioning**: **None**
- No version field
- Silently casts any JSON to `TokenData`

**Security**: Restrictive permissions set on save (`chmod 0o600`)

---

### 2. Migration Strategy

**Current implementation**: **None**

There is no code for:
- Detecting old config formats
- Transforming old configs to new formats
- Version sniffing of config files
- Backup/restore of configs during migration

**What happens if config structure changes**:
1. User upgrades CLI package
2. Old config file has missing required fields
3. `loadConfig()` returns `null`
4. Commands show "No Convex configuration found" error
5. User must manually re-configure

**No graceful degradation**: The CLI does not attempt to preserve partially valid configs or provide migration guidance.

---

### 3. First-Run Experience

#### Scenario A: User runs `polychromos dev` without setup

**Flow** (`packages/polychromos/src/commands/dev.ts:12-28`):
```typescript
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
```

**Output**:
```
Polychromos CLI v1.0.0
No Convex configuration found.
Run "polychromos init <name>" first to set up syncing.
```

**Exit code**: 1

#### Scenario B: User runs `polychromos init <name>`

**Flow** (`packages/polychromos/src/commands/init.ts`):
1. Creates a `design.json` file with starter template
2. Prints success message with next steps

**Output**:
```
✓ Created design.json
  Workspace: <name>
  ID: ws_<timestamp>

Next steps:
  1. Run 'polychromos dev' to start watching for changes
  2. Edit design.json to modify your design
  3. Open the web app to see live preview
```

**Note**: `polychromos init` does **not** create `.polychromos/config.json`. The config with `convexUrl` and `workspaceId` must be created separately (this appears to be a gap in the current flow).

#### Scenario C: User runs commands without authentication

**Flow** (`packages/polychromos/src/lib/credentials.ts:54-66`):
```typescript
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

**Output**:
```
Not authenticated. Run `polychromos login` first.
```

#### `polychromos login` Flow

**Steps** (`packages/polychromos/src/commands/login.ts`):
1. Displays instructions for obtaining Clerk session token from browser
2. Prompts user to paste token
3. Saves to `~/.polychromos/credentials.json`

**Output**:
```
Polychromos CLI Login

To authenticate, you need a Clerk session token from the web app.

Steps:
1. Open the Polychromos web app and sign in
2. Open browser DevTools (F12) → Application → Cookies
3. Find the '__session' cookie and copy its value

Enter your session token: <user input>

✓ Login successful!
You can now use polychromos commands.
```

---

### 4. design.json Schema Versioning

**Schema** (`packages/polychromos-types/src/types.ts:4-18`):
```typescript
export interface PolychromosWorkspace {
  id: string;
  version: "1.0";  // Literal type, not a string
  name: string;
  settings?: { ... };
  tokens?: { ... };
  components: Record<string, PolychromosComponent>;
}
```

**Zod validator** (`packages/polychromos-types/src/validators.ts:84-98`):
```typescript
export const PolychromosWorkspaceSchema = z.object({
  id: z.string(),
  version: z.literal("1.0"),  // Strict literal validation
  name: z.string(),
  settings: z.object({ ... }).optional(),
  tokens: z.object({ ... }).optional(),
  components: z.record(z.string(), PolychromosComponentSchema),
});
```

**Version handling**:
- `version` must be exactly `"1.0"` (literal string)
- Any other value (e.g., `"2.0"`, `"1.1"`) fails Zod validation
- Validation is available via `PolychromosWorkspaceSchema.safeParse()`

**Test coverage** (`packages/polychromos-types/src/validators.test.ts:29-33`):
```typescript
it('rejects invalid version', () => {
  const workspace = { ...minimalWorkspace, version: '2.0' };
  const result = PolychromosWorkspaceSchema.safeParse(workspace);
  expect(result.success).toBe(false);
});
```

**Current CLI usage**: The CLI does **not** currently validate design.json against the Zod schema before syncing. It reads the file and sends to Convex as-is (`packages/polychromos/src/commands/dev.ts:155-157`):
```typescript
const content = await readFile("design.json", "utf-8");
const data: unknown = JSON.parse(content);
await syncWithSingleFlight(data);
```

---

### 5. Backwards Compatibility

#### Older CLI + Newer design.json

**Scenario**: User has CLI v1.0.0, opens design.json created with hypothetical v2.0

**What happens**:
- CLI reads file without validation
- Sends to Convex
- If Convex backend validates schema, it may reject the update
- If Convex doesn't validate, data is stored but CLI may not render new features

**Current state**: Since CLI doesn't validate locally, it would attempt to sync any JSON structure.

#### Newer CLI + Older design.json

**Scenario**: User upgrades CLI, existing design.json has missing new required fields

**What happens**:
- Currently no required field changes between versions (only `"1.0"` exists)
- If new fields became required, sync would fail at Convex validation
- CLI would show: `✗ Sync failed: <error message>`

#### TypeScript Interface Version

The `version` field is a literal type:
```typescript
version: "1.0";  // Not version: string
```

This means:
- TypeScript will error if code tries to assign `"2.0"`
- At runtime, JSON can have any version value
- Zod validation enforces the literal at runtime

---

### 6. Credential Expiry Handling

**Expiry check** (`packages/polychromos/src/lib/credentials.ts:60-63`):
```typescript
if (creds.expiresAt && Date.now() > creds.expiresAt - 5 * 60 * 1000) {
  throw new Error("Token expired. Run `polychromos login` to refresh.");
}
```

**Behavior**:
- 5-minute buffer before actual expiry
- No automatic token refresh
- User must manually re-authenticate

**Environment variable override** (`packages/polychromos/src/lib/credentials.ts:31-36`):
```typescript
const envToken = process.env.POLYCHROMOS_TOKEN;
if (envToken) {
  return { accessToken: envToken };
}
```

**Note**: Environment tokens have no expiry check (useful for CI/headless scenarios).

**Long-running session handling** (`packages/polychromos/src/commands/dev.ts:61-70`):
```typescript
// Refresh token periodically for long sessions
const tokenRefreshInterval = setInterval(() => {
  void (async () => {
    try {
      const newToken = await getValidToken();
      convexClient.setAuth(newToken);
    } catch {
      console.warn("⚠ Token refresh failed. You may need to re-login.");
    }
  })();
}, 45 * 60 * 1000); // Every 45 minutes
```

**Note**: This "refresh" just re-reads credentials from disk; it doesn't perform OAuth refresh. If the stored token has expired, it will warn but not fix the issue.

---

### 7. Error Recovery

#### Sync Errors (`packages/polychromos/src/commands/dev.ts:102-127`)

```typescript
if (convexError instanceof Error && convexError.message.includes("Version conflict")) {
  console.error("✗ Conflict detected - please reload to get latest version");
} else if (convexError instanceof Error && convexError.message.includes("Unauthenticated")) {
  console.error("✗ Authentication expired. Run `polychromos login`");
} else if (convexError instanceof Error && convexError.message.includes("Access denied")) {
  console.error("✗ Access denied to this workspace");
} else {
  console.error("✗ Sync failed:", convexError instanceof Error ? convexError.message : convexError);
}
```

**Handled errors**:
- Version conflict → User-actionable message
- Unauthenticated → Re-login prompt
- Access denied → Clear denial message
- Other errors → Raw error message

**Not handled**:
- Automatic retry on transient failures
- Network connectivity issues (no retry)
- Rate limiting (no backoff)

#### File Read Errors (`packages/polychromos/src/commands/dev.ts:158-160`)

```typescript
} catch (error) {
  console.error("✗ Error reading file:", error);
}
```

**Behavior**: Logs error, continues watching (file watcher keeps running).

#### Corrupted Config Files

**config.json** (`packages/polychromos/src/lib/config.ts:24-28`):
```typescript
} catch {
  // Config file doesn't exist or is invalid
  return null;
}
```

**credentials.json** (`packages/polychromos/src/lib/credentials.ts:41-43`):
```typescript
} catch {
  return null;
}
```

**Behavior**: Invalid JSON or missing files return `null`, which triggers "not configured" or "not authenticated" errors. No attempt to repair or backup corrupted files.

#### Local Version Manager Errors

The `VersionManager` class (`packages/polychromos/src/lib/version-manager.ts`) has error handling in `init()`:

```typescript
async init(): Promise<void> {
  // Create .polychromos directory if needed
  try {
    await mkdir(this.directory, { recursive: true });
  } catch {
    // Directory already exists
  }

  // Load event log if it exists
  try {
    const content = await readFile(this.eventsFile, "utf-8");
    // ...
  } catch {
    // File doesn't exist yet
    this.history = [];
    this.currentVersion = 0;
  }
  // ...
}
```

**Behavior**: Silently initializes with empty state if files are missing/corrupted.

---

## Code References

### Config Management
- `packages/polychromos/src/lib/config.ts:4-7` - PolychromosConfig interface
- `packages/polychromos/src/lib/config.ts:12-28` - loadConfig() implementation
- `packages/polychromos/src/lib/config.ts:30-33` - saveConfig() implementation

### Credential Management
- `packages/polychromos/src/lib/credentials.ts:8-12` - TokenData interface
- `packages/polychromos/src/lib/credentials.ts:14-28` - saveCredentials()
- `packages/polychromos/src/lib/credentials.ts:30-44` - loadCredentials()
- `packages/polychromos/src/lib/credentials.ts:54-66` - getValidToken()

### Schema Validation
- `packages/polychromos-types/src/types.ts:4-18` - PolychromosWorkspace interface
- `packages/polychromos-types/src/validators.ts:84-98` - PolychromosWorkspaceSchema Zod validator
- `packages/polychromos-types/src/validators.test.ts:29-33` - Version rejection test

### Command Implementations
- `packages/polychromos/src/commands/init.ts` - Workspace initialization
- `packages/polychromos/src/commands/login.ts` - Authentication flow
- `packages/polychromos/src/commands/dev.ts:12-28` - First-run checks
- `packages/polychromos/src/commands/dev.ts:61-70` - Token refresh interval
- `packages/polychromos/src/commands/dev.ts:102-127` - Error handling

### Version Management
- `packages/polychromos/src/lib/version-manager.ts:31-66` - init() with error handling
- `packages/polychromos/src/lib/version-manager.ts:68-102` - recordChange()

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-02-polychromos-json-schema-design.md` - Original schema design decisions, including `version: "1.0"` literal requirement
- `thoughts/shared/research/2026-02-02-polychromos-production-readiness-assessment.md` - Production deployment checklist noting missing npm metadata

---

## Related Research

- `thoughts/shared/research/2026-02-03-polychromos-cli-publishing-prerequisites.md` - npm publishing requirements

---

## Open Questions

1. **Config version field**: Should `.polychromos/config.json` have a version field for future migrations?

2. **init creates config?**: Should `polychromos init` also create `.polychromos/config.json` with default Convex URL?

3. **Schema validation in CLI**: Should the CLI validate design.json against the Zod schema before syncing?

4. **Automatic token refresh**: Should the CLI implement OAuth refresh token flow?

5. **Migration tooling**: Should there be a `polychromos migrate` command for future config/schema changes?

6. **Error telemetry**: Should sync errors be reported for debugging?
