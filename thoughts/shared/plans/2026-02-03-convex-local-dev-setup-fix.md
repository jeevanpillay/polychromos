# Convex Local Development Setup Fix

## Overview

Fix `pnpm dev:app` to work reliably on fresh repo clones by using the standalone Convex backend (same approach as E2E tests) instead of `npx convex dev`, which requires either cloud authentication or interactive prompts.

## Current State Analysis

### The Problem

When running `pnpm dev:app` on a fresh clone:

1. `setup-convex.js` runs `npx convex dev --once`
2. This fails because:
   - `convex.json` specifies `team: "polychromos"` and `project: "polychromos-mvp"` (requires cloud auth)
   - Without `CONVEX_DEPLOYMENT` set, Convex CLI prompts for interactive configuration
   - Non-interactive terminals (CI, IDE terminals) fail immediately

### Why E2E Tests Work

E2E tests use `local-backend.sh` which:
- Downloads standalone `convex-local-backend` binary from GitHub releases
- Runs it directly at `http://127.0.0.1:3210`
- Uses hardcoded admin key for all operations
- No cloud connection or authentication required

### Key Files

| File | Current Purpose |
|------|-----------------|
| `apps/polychromos-app/scripts/setup-convex.js` | Runs `npx convex dev --once`, sets env vars |
| `apps/polychromos-app/scripts/local-backend.sh` | Standalone backend for E2E tests |
| `apps/polychromos-app/package.json:7-11` | Dev scripts using `npx convex dev` |

## Desired End State

After implementation:

1. `pnpm dev:app` works on fresh clones without any prior setup
2. Local development uses the standalone Convex backend (same as E2E)
3. No cloud authentication required for local development
4. Hot reload continues to work for Convex functions
5. Environment variables are properly set in the local backend

### Verification

- Fresh clone → `pnpm install` → `pnpm dev:app` → App runs at `http://localhost:3001`
- Convex backend accessible at `http://127.0.0.1:3210`
- Convex function changes are deployed automatically

## What We're NOT Doing

- Removing cloud deployment capability (still works via `npx convex deploy`)
- Changing the E2E test infrastructure (already working)
- Modifying `convex.json` (needed for cloud deployments)
- Adding new dependencies

## Implementation Approach

Modify `setup-convex.js` to use `local-backend.sh` for starting the backend, and update the `dev:convex` script to watch and deploy to the local backend.

---

## Phase 1: Update setup-convex.js to Use Local Backend

### Overview

Replace `npx convex dev --once` with `local-backend.sh run` for backend startup, and use `local-backend.sh convex` for env var operations.

### Changes Required

#### 1. Modify setup-convex.js

**File**: `apps/polychromos-app/scripts/setup-convex.js`

**Changes**:
- Start backend using `local-backend.sh run` spawned in background
- Use `local-backend.sh convex env set` for environment variables
- Remove the `npx convex dev --once` approach
- Handle first-run binary download

```javascript
#!/usr/bin/env node
/**
 * Sets up Convex local development:
 * 1. Starts local convex backend (downloads binary if needed)
 * 2. Waits for it to be ready
 * 3. Deploys schema and functions
 * 4. Sets required environment variables
 */
import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.dirname(__dirname);

const VERCEL_ENV = ".vercel/.env.development.local";
const BACKEND_URL = "http://127.0.0.1:3210";
const LOCAL_BACKEND_SCRIPT = "./scripts/local-backend.sh";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendRunning() {
  try {
    const response = await fetch(`${BACKEND_URL}/version`, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isBackendRunning()) {
      return true;
    }
    await sleep(500);
    if (i % 10 === 0 && i > 0) {
      process.stdout.write(".");
    }
  }
  return false;
}

async function startBackend() {
  // Check if already running
  if (await isBackendRunning()) {
    console.log("Convex backend already running");
    return null;
  }

  console.log("Starting Convex local backend...");

  // Spawn local-backend.sh run in background
  const backend = spawn(LOCAL_BACKEND_SCRIPT, ["run"], {
    cwd: APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // Log output for debugging but don't block
  backend.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line.includes("Downloading") || line.includes("ready")) {
      console.log(line);
    }
  });
  backend.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  // Don't wait for process - let it run in background
  backend.unref();

  // Wait for backend to be ready
  process.stdout.write("Waiting for backend to be ready");
  const ready = await waitForBackend();
  console.log("");

  if (!ready) {
    console.error("Backend failed to start in time");
    process.exit(1);
  }

  console.log("Backend is ready!");
  return backend;
}

function deploySchema() {
  console.log("Deploying Convex schema and functions...");
  try {
    execSync(`${LOCAL_BACKEND_SCRIPT} convex deploy`, {
      cwd: APP_DIR,
      stdio: "inherit",
    });
  } catch (e) {
    console.error("Failed to deploy schema:", e.message);
    process.exit(1);
  }
}

function setEnvVars() {
  if (!existsSync(VERCEL_ENV)) {
    console.log(`${VERCEL_ENV} not found, skipping env var setup`);
    return;
  }

  console.log("Setting Convex environment variables...");
  const content = readFileSync(VERCEL_ENV, "utf8");
  const lines = content.split("\n");

  // Skip these - they're client-side only or Convex-managed
  const skipVars = [
    "VITE_",           // Client-side vars
    "CONVEX_",         // Convex-managed vars
    "VERCEL_OIDC_TOKEN", // Vercel internal
    "E2E_",            // Test-only vars
  ];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*)["']?$/);
    if (!match) continue;

    const [, key, value] = match;
    if (skipVars.some((skip) => key.startsWith(skip))) continue;

    const cleanValue = value.replace(/^["']|["']$/g, "");

    try {
      execSync(`${LOCAL_BACKEND_SCRIPT} convex env set ${key} "${cleanValue}"`, {
        cwd: APP_DIR,
        stdio: "pipe",
      });
    } catch (e) {
      // Ignore errors for individual env vars
    }
  }
}

function writeLocalEnvFile() {
  // Write/update .env.local with local backend URLs
  const envContent = `# Auto-generated for local Convex development
CONVEX_DEPLOYMENT=local
VITE_CONVEX_URL=${BACKEND_URL}
`;

  const envLocalPath = path.join(APP_DIR, ".env.local");
  writeFileSync(envLocalPath, envContent);
  console.log("Updated .env.local with local backend URLs");

  // Also update .vercel/.env.development.local if it exists
  const vercelEnvPath = path.join(APP_DIR, VERCEL_ENV);
  if (existsSync(vercelEnvPath)) {
    let vercelContent = readFileSync(vercelEnvPath, "utf8");

    // Remove existing Convex vars
    const convexVars = ["CONVEX_DEPLOYMENT", "VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"];
    vercelContent = vercelContent
      .split("\n")
      .filter((line) => !convexVars.some((v) => line.startsWith(`${v}=`)))
      .filter((line) => !line.includes("# Convex Local Development"))
      .join("\n")
      .trimEnd();

    vercelContent += `

# Convex Local Development
CONVEX_DEPLOYMENT=local
VITE_CONVEX_URL=${BACKEND_URL}
`;

    writeFileSync(vercelEnvPath, vercelContent);
    console.log(`Updated ${VERCEL_ENV} with local backend URLs`);
  }
}

async function main() {
  await startBackend();
  deploySchema();
  setEnvVars();
  writeLocalEnvFile();
  console.log("\nSetup complete! Backend running at " + BACKEND_URL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### Success Criteria

#### Automated Verification:
- [ ] Script runs without error: `node apps/polychromos-app/scripts/setup-convex.js`
- [ ] Backend starts and responds: `curl http://127.0.0.1:3210/version`
- [ ] Linting passes: `pnpm lint`
- [ ] TypeScript passes: `pnpm typecheck`

#### Manual Verification:
- [ ] On a fresh clone (or after deleting `~/.convex/`), `pnpm dev:app` works
- [ ] Backend starts without prompts or authentication

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the setup script works on a fresh environment before proceeding to Phase 2.

---

## Phase 2: Update dev:convex Script for Watch Mode

### Overview

Update the `dev:convex` npm script to use `local-backend.sh convex dev` instead of `npx convex dev`, enabling hot reload against the local backend.

### Changes Required

#### 1. Update package.json dev scripts

**File**: `apps/polychromos-app/package.json`

**Changes**: Update `dev:convex` to use local backend

```json
{
  "scripts": {
    "dev": "pnpm run dev:setup && concurrently -r npm:dev:web npm:dev:convex",
    "dev:web": "pnpm exec dotenv -e .vercel/.env.development.local -- vite dev",
    "dev:convex": "./scripts/local-backend.sh convex dev --tail-logs",
    "dev:setup": "node scripts/setup-convex.js",
    "dev:sync-env": "node scripts/sync-env.js"
  }
}
```

**Note**: Removed `dotenv` wrapper from `dev:setup` and `dev:convex` since we no longer need environment variables to connect to cloud - the local backend uses the admin key from `local-backend.sh`.

### Success Criteria

#### Automated Verification:
- [ ] `pnpm dev:app` starts without errors
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Vite dev server starts at `http://localhost:3001`
- [ ] Convex functions watch mode works (edit a function, see it redeploy)
- [ ] App can read/write data through Convex

**Implementation Note**: After completing this phase, test the full development workflow manually before proceeding.

---

## Phase 3: Add Helper Commands

### Overview

Add convenience commands for managing the local backend (reset data, view logs, etc.).

### Changes Required

#### 1. Add npm scripts for backend management

**File**: `apps/polychromos-app/package.json`

**Changes**: Add helper scripts

```json
{
  "scripts": {
    "convex:reset": "./scripts/local-backend.sh reset",
    "convex:start": "./scripts/local-backend.sh run",
    "convex:deploy": "./scripts/local-backend.sh convex deploy",
    "convex:env": "./scripts/local-backend.sh convex env"
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] `pnpm --filter @repo/app convex:reset` runs without error
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Can reset local data and start fresh
- [ ] Commands are discoverable via `pnpm --filter @repo/app run`

---

## Phase 4: Update Documentation

### Overview

Update CLAUDE.md and any other documentation to reflect the new local development setup.

### Changes Required

#### 1. Update CLAUDE.md

**File**: `CLAUDE.md`

**Changes**: Add section about local Convex backend

Add under the Commands section or create a new "Local Development" section:

```markdown
## Local Convex Backend

The app uses a standalone Convex backend binary for local development (no cloud authentication required).

```bash
# Start development (auto-starts backend)
pnpm dev:app

# Manage local backend
pnpm --filter @repo/app convex:reset   # Clear all local data
pnpm --filter @repo/app convex:deploy  # Manually deploy schema
pnpm --filter @repo/app convex:start   # Start backend only
```

The local backend runs at `http://127.0.0.1:3210` and stores data in:
- `apps/polychromos-app/convex_local_storage/`
- `apps/polychromos-app/convex_local_backend.sqlite3`

To deploy to cloud (production), use `npx convex deploy` with proper authentication.
```

### Success Criteria

#### Automated Verification:
- [ ] Documentation linting passes (if applicable)

#### Manual Verification:
- [ ] A new developer can follow the docs to get started

---

## Testing Strategy

### Unit Tests
- No new unit tests needed (this is infrastructure)

### Integration Tests
- E2E tests should continue to pass (they already use this approach)

### Manual Testing Steps

1. **Fresh Clone Test**:
   ```bash
   # Clone to new directory
   git clone <repo> fresh-test
   cd fresh-test
   pnpm install
   pnpm dev:app
   # Verify app loads at http://localhost:3001
   ```

2. **Reset Test**:
   ```bash
   pnpm --filter @repo/app convex:reset
   pnpm dev:app
   # Verify app starts with clean state
   ```

3. **Hot Reload Test**:
   ```bash
   pnpm dev:app
   # Edit a Convex function
   # Verify it redeploys automatically
   ```

## Migration Notes

### For Existing Developers

Developers with existing setups may have:
- `.env.local` pointing to cloud or anonymous deployments
- Running `npx convex dev` processes

They should:
1. Stop any running `convex dev` processes
2. Run `pnpm --filter @repo/app convex:reset` to clear local data
3. Delete `.env.local` (will be regenerated)
4. Run `pnpm dev:app` to start with new setup

### Backwards Compatibility

- Cloud deployments (`npx convex deploy`) still work unchanged
- E2E tests remain unchanged (already using this approach)
- CI pipelines that use `npx convex deploy` are unaffected

## References

- Original research: `thoughts/shared/research/2026-02-03-convex-dev-setup-fresh-repo.md`
- E2E test harness: `apps/polychromos-app/test/backendHarness.cjs`
- Local backend script: `apps/polychromos-app/scripts/local-backend.sh`
