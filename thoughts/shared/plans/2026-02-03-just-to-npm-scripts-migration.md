---
date: 2026-02-03T11:00:00-08:00
author: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Migrate from just command runner to npm scripts"
tags: [plan, implementation, just, npm-scripts, polychromos-app, ci-cd]
status: ready
last_updated: 2026-02-03
last_updated_by: Claude
related_research: thoughts/shared/research/2026-02-03-just-command-runner-evaluation.md
---

# Migrate from `just` to npm Scripts - Implementation Plan

## Overview

Replace the `just` command runner with a shell script and npm scripts for managing the Convex local backend during E2E testing. This eliminates an external CI dependency and simplifies the developer experience.

## Current State Analysis

### What Exists Now
- **Justfile** at `apps/polychromos-app/Justfile` with 3 commands:
  - `run-local-backend` - Downloads and runs Convex local backend binary
  - `reset-local-backend` - Deletes local Convex data
  - `convex *ARGS` - Wrapper for Convex CLI with local backend settings

### Integration Points
1. `apps/polychromos-app/test/backendHarness.js:44,58,63` - Calls just commands via `execSync` and `spawn`
2. `apps/polychromos-app/package.json:23` - `test:e2e:run` script uses `just convex`
3. `.github/workflows/test.yml:57-59` - Installs just in CI

### Key Constraints
- Must maintain platform detection (macOS arm64/x86_64, Linux x86_64)
- Must preserve the admin key and URL configuration
- Shell script must be executable on both macOS and Linux
- Changes must not affect developer workflow beyond removing `just` dependency

## Desired End State

After this plan is complete:
1. No `just` dependency anywhere in the codebase
2. `apps/polychromos-app/scripts/local-backend.sh` handles all local backend operations
3. `backendHarness.js` calls the shell script directly
4. CI workflow does not install `just`
5. `pnpm test:e2e` works exactly as before

### Verification
- Run `pnpm --filter @repo/polychromos-app test:e2e` locally
- CI E2E tests pass without `just` installation step
- No references to `just` remain in codebase

## What We're NOT Doing

- Converting to a Node.js script (keeping it as bash for simplicity)
- Adding Windows support (current Justfile doesn't support Windows either)
- Changing the Convex local backend management logic
- Modifying E2E test logic itself

## Implementation Approach

The migration is straightforward:
1. Convert Justfile logic to a shell script
2. Update callers to use the shell script
3. Remove just-related CI configuration
4. Delete the Justfile

---

## Phase 1: Create Shell Script

### Overview
Create `apps/polychromos-app/scripts/local-backend.sh` that replaces all Justfile functionality.

### Changes Required:

#### 1. Create local-backend.sh
**File**: `apps/polychromos-app/scripts/local-backend.sh` (new file)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Convex local backend configuration
BACKEND_URL="http://127.0.0.1:3210"
ADMIN_KEY="0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

case "${1:-}" in
  run)
    cd "$APP_DIR"
    if [ ! -x ./convex-local-backend ]; then
      if [ "$(uname)" = "Darwin" ]; then
        if [ "$(uname -m)" = "arm64" ]; then
          pkg=convex-local-backend-aarch64-apple-darwin.zip
        elif [ "$(uname -m)" = "x86_64" ]; then
          pkg=convex-local-backend-x86_64-apple-darwin.zip
        fi
      elif [ "$(uname -m)" = "x86_64" ]; then
        pkg=convex-local-backend-x86_64-unknown-linux-gnu.zip
      fi
      echo "Downloading Convex local backend: $pkg"
      curl -L -O "https://github.com/get-convex/convex-backend/releases/latest/download/$pkg"
      unzip "$pkg"
      rm "$pkg"
    fi
    ./convex-local-backend
    ;;
  reset)
    cd "$APP_DIR"
    rm -rf convex_local_storage convex_local_backend.sqlite3
    ;;
  convex)
    shift
    npx convex "$@" --admin-key "$ADMIN_KEY" --url "$BACKEND_URL"
    ;;
  *)
    echo "Usage: $0 {run|reset|convex <args>}"
    echo ""
    echo "Commands:"
    echo "  run     Download (if needed) and run the Convex local backend"
    echo "  reset   Delete local Convex data"
    echo "  convex  Run convex CLI against local backend (pass additional args)"
    exit 1
    ;;
esac
```

### Success Criteria:

#### Automated Verification:
- [ ] Script is executable: `test -x apps/polychromos-app/scripts/local-backend.sh`
- [ ] Script shows help on invalid command: `./scripts/local-backend.sh` exits with code 1 and shows usage
- [ ] Reset command works: `./scripts/local-backend.sh reset` completes without error

#### Manual Verification:
- [ ] `./scripts/local-backend.sh run` downloads and starts the backend (Ctrl+C to stop)
- [ ] `./scripts/local-backend.sh convex --help` shows convex CLI help

**Implementation Note**: After completing this phase and automated verification passes, manually verify the script works before proceeding to Phase 2.

---

## Phase 2: Update Backend Harness

### Overview
Modify `backendHarness.js` to call the shell script instead of `just` commands.

### Changes Required:

#### 1. Update backendHarness.js
**File**: `apps/polychromos-app/test/backendHarness.js`

**Change 1** - Line 44 (cleanup function):
```javascript
// Before
execSync('just reset-local-backend', { cwd: CWD, stdio: 'ignore' });

// After
execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'ignore' });
```

**Change 2** - Line 58 (runWithLocalBackend function):
```javascript
// Before
execSync('just reset-local-backend', { cwd: CWD, stdio: 'ignore' });

// After
execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'ignore' });
```

**Change 3** - Line 63 (spawn backend process):
```javascript
// Before
backendProcess = spawn('just', ['run-local-backend'], {
  cwd: CWD,
  stdio: 'pipe',
  env: { ...process.env, CONVEX_TRACE_FILE: '1' },
});

// After
backendProcess = spawn('./scripts/local-backend.sh', ['run'], {
  cwd: CWD,
  stdio: 'pipe',
  env: { ...process.env, CONVEX_TRACE_FILE: '1' },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] No references to `just` in backendHarness.js: `grep -c "just" apps/polychromos-app/test/backendHarness.js` returns 0
- [ ] TypeScript/lint passes: `pnpm --filter @repo/polychromos-app lint`

#### Manual Verification:
- [ ] Backend harness starts correctly when running tests manually

**Implementation Note**: After completing this phase and automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Update package.json Scripts

### Overview
Update `package.json` to use the shell script instead of `just` for the test:e2e:run script.

### Changes Required:

#### 1. Update package.json
**File**: `apps/polychromos-app/package.json`

**Change** - Line 23:
```json
// Before
"test:e2e:run": "just convex env set IS_TEST true && just convex deploy && vitest run e2e/"

// After
"test:e2e:run": "./scripts/local-backend.sh convex env set IS_TEST true && ./scripts/local-backend.sh convex deploy && vitest run e2e/"
```

### Success Criteria:

#### Automated Verification:
- [ ] No references to `just` in package.json: `grep -c '"just' apps/polychromos-app/package.json` returns 0
- [ ] Package.json is valid JSON: `node -e "require('./apps/polychromos-app/package.json')"`

#### Manual Verification:
- [ ] E2E tests run successfully: `pnpm --filter @repo/polychromos-app test:e2e`

**Implementation Note**: This is the critical phase. After completing automated verification, run the full E2E test suite locally to confirm everything works.

---

## Phase 4: Update CI Workflow

### Overview
Remove the `just` installation step from the GitHub Actions workflow.

### Changes Required:

#### 1. Remove Just installation from test.yml
**File**: `.github/workflows/test.yml`

**Delete lines 57-59**:
```yaml
# Remove this entire step
- name: Install Just
  run: |
    curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
```

### Success Criteria:

#### Automated Verification:
- [ ] No references to `just` in test.yml: `grep -c "just" .github/workflows/test.yml` returns 0
- [ ] YAML is valid: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"`

#### Manual Verification:
- [ ] CI workflow passes on the PR (after push)

**Implementation Note**: After completing this phase, the changes should be pushed to trigger CI. Verify the E2E tests pass in CI.

---

## Phase 5: Clean Up

### Overview
Remove the Justfile and verify no references to `just` remain.

### Changes Required:

#### 1. Delete Justfile
**File**: `apps/polychromos-app/Justfile`

Delete this file entirely.

### Success Criteria:

#### Automated Verification:
- [ ] Justfile does not exist: `! test -f apps/polychromos-app/Justfile`
- [ ] No `just` references in codebase: `grep -r "just " apps/polychromos-app --include="*.js" --include="*.json" --include="*.yml" | wc -l` returns 0
- [ ] All tests pass: `pnpm test`
- [ ] Typecheck passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Local E2E tests still work: `pnpm --filter @repo/polychromos-app test:e2e`
- [ ] CI passes on the final PR

**Implementation Note**: This is the final cleanup phase. After all verification passes, the migration is complete.

---

## Testing Strategy

### Unit Tests
No new unit tests needed - existing E2E tests validate the backend management.

### Integration Tests
- E2E test suite (`apps/polychromos-app/e2e/`) validates Convex local backend integration
- Tests will run as part of `pnpm test:e2e`

### Manual Testing Steps
1. Run `./scripts/local-backend.sh run` and verify backend starts
2. In another terminal, run `./scripts/local-backend.sh convex --help`
3. Stop backend with Ctrl+C
4. Run `./scripts/local-backend.sh reset` to clean up
5. Run `pnpm --filter @repo/polychromos-app test:e2e` for full E2E test

## Performance Considerations

- **CI time savings**: Removes ~2-3 seconds for `just` installation
- **No runtime impact**: Shell script executes identically to Justfile commands
- **Developer experience**: One less tool to install locally

## Migration Notes

- Developers who have `just` installed can continue using it for other projects
- No data migration needed - local Convex data is ephemeral for testing
- Existing E2E tests remain unchanged

## References

- Original research: `thoughts/shared/research/2026-02-03-just-command-runner-evaluation.md`
- Current Justfile: `apps/polychromos-app/Justfile`
- Backend harness: `apps/polychromos-app/test/backendHarness.js`
- CI workflow: `.github/workflows/test.yml`
