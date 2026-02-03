---
date: 2026-02-03T10:30:00-08:00
researcher: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Evaluate 'just' command runner usage - recommend keep or replace with npm scripts"
tags: [research, evaluation, just, ci-cd, npm-scripts, polychromos-app]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Evaluate "just" Command Runner Usage

**Date**: 2026-02-03T10:30:00-08:00
**Researcher**: Claude
**Git Commit**: cedfb4bbf2f1a7801785b0d985611f71b95f4049
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Evaluate "just" command runner usage in the repo - document where it's used, what it does, and recommend whether to keep it or replace with npm scripts for simplicity and CI efficiency.

## Summary

The `just` command runner is used **only** in `apps/polychromos-app/` for managing the Convex local backend during E2E testing. It provides three commands for downloading, running, and managing the local Convex backend. The usage is limited but creates a CI dependency that requires installing an external tool. **Recommendation: Replace with npm scripts** for simplicity and zero external dependencies.

## Detailed Findings

### Current Usage Location

**Single Justfile**: `apps/polychromos-app/Justfile`

### What the Justfile Does

The Justfile contains three commands:

| Command | Purpose |
|---------|---------|
| `run-local-backend` | Downloads (if needed) and runs the Convex local backend binary. Auto-detects platform (macOS arm64/x86_64, Linux x86_64) |
| `reset-local-backend` | Deletes local Convex data: `convex_local_storage/` directory and `convex_local_backend.sqlite3` |
| `convex *ARGS` | Wrapper to run Convex CLI commands against local backend with hardcoded admin key and URL |

### Code References

**Justfile** (`apps/polychromos-app/Justfile:1-31`):
```just
set shell := ["bash", "-uc"]

# Download and run local backend (auto-detects platform)
run-local-backend:
  #!/usr/bin/env sh
  if [ ! -x ./convex-local-backend ]; then
    # Downloads correct binary for macOS arm64/x86_64 or Linux x86_64
    curl -L -O "https://github.com/get-convex/convex-backend/releases/latest/download/$pkg"
    unzip "$pkg" && rm "$pkg"
  fi
  ./convex-local-backend

# Reset all data
reset-local-backend:
  rm -rf convex_local_storage && rm -f convex_local_backend.sqlite3

# Run convex CLI against local backend
convex *ARGS:
  npx convex {{ ARGS }} --admin-key <hardcoded> --url "http://127.0.0.1:3210"
```

### Integration Points

1. **package.json test:e2e:run script** (`apps/polychromos-app/package.json:23`):
   ```json
   "test:e2e:run": "just convex env set IS_TEST true && just convex deploy && vitest run e2e/"
   ```

2. **backendHarness.js** (`apps/polychromos-app/test/backendHarness.js:44,58,63`):
   - Line 44: `execSync('just reset-local-backend', ...)`
   - Line 58: `execSync('just reset-local-backend', ...)`
   - Line 63: `spawn('just', ['run-local-backend'], ...)`

3. **CI Workflow** (`.github/workflows/test.yml:57-59`):
   ```yaml
   - name: Install Just
     run: |
       curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
   ```

### CI Impact Analysis

| Metric | Current (with just) | After Migration (npm scripts) |
|--------|---------------------|------------------------------|
| External CI dependencies | 1 (just install step) | 0 |
| CI install time | ~2-3 seconds | 0 seconds |
| Developer dependencies | Must install `just` locally | None (pnpm only) |
| Cross-platform support | Limited (just install varies) | Universal (Node.js) |

---

## Evaluation & Analysis

### Issues Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| Extra CI install step required | Medium | Adds ~2-3s CI time + potential failure point |
| Developers must install `just` locally | Medium | Friction for new contributors |
| Tool duplication (pnpm + just) | Low | Mental overhead, two task runners |
| Not integrated with Turborepo cache | Low | Cannot benefit from caching |
| Platform detection logic already in shell | Low | No just-specific features used |

### Why `just` Was Likely Chosen

The Justfile primarily contains shell scripts. The `just` command runner was likely chosen for:
1. **Clean syntax** for multi-line shell scripts
2. **Recipe-based organization** for related commands
3. **Variable interpolation** in the `convex *ARGS` recipe

However, these benefits don't outweigh the added complexity for this use case.

### Recommendations

#### Quick Wins (Low effort, immediate benefit)

1. **Migrate to npm scripts** - Convert all three just recipes to equivalent npm scripts or Node.js scripts

   - Expected impact: Eliminates CI install step, removes external dependency
   - Estimated effort: 30 minutes

#### Implementation Plan

**Step 1: Create a shell script for local backend management**

Create `apps/polychromos-app/scripts/local-backend.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="http://127.0.0.1:3210"
ADMIN_KEY="0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd"

case "${1:-}" in
  run)
    if [ ! -x ./convex-local-backend ]; then
      if [ "$(uname)" = "Darwin" ]; then
        if [ "$(uname -m)" = "arm64" ]; then
          pkg=convex-local-backend-aarch64-apple-darwin.zip
        else
          pkg=convex-local-backend-x86_64-apple-darwin.zip
        fi
      else
        pkg=convex-local-backend-x86_64-unknown-linux-gnu.zip
      fi
      curl -L -O "https://github.com/get-convex/convex-backend/releases/latest/download/$pkg"
      unzip "$pkg" && rm "$pkg"
    fi
    ./convex-local-backend
    ;;
  reset)
    rm -rf convex_local_storage convex_local_backend.sqlite3
    ;;
  convex)
    shift
    npx convex "$@" --admin-key "$ADMIN_KEY" --url "$BACKEND_URL"
    ;;
  *)
    echo "Usage: $0 {run|reset|convex <args>}"
    exit 1
    ;;
esac
```

**Step 2: Update package.json scripts**

```json
{
  "scripts": {
    "backend:run": "./scripts/local-backend.sh run",
    "backend:reset": "./scripts/local-backend.sh reset",
    "backend:convex": "./scripts/local-backend.sh convex",
    "test:e2e:run": "pnpm backend:convex env set IS_TEST true && pnpm backend:convex deploy && vitest run e2e/"
  }
}
```

**Step 3: Update backendHarness.js**

Replace `just` calls with npm script calls:
```javascript
// Before
execSync('just reset-local-backend', { cwd: CWD, stdio: 'ignore' });
spawn('just', ['run-local-backend'], ...)

// After
execSync('pnpm backend:reset', { cwd: CWD, stdio: 'ignore' });
spawn('pnpm', ['backend:run'], ...)
```

**Step 4: Remove CI just installation**

Remove from `.github/workflows/test.yml`:
```yaml
- name: Install Just
  run: |
    curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin
```

**Step 5: Delete Justfile**

```bash
rm apps/polychromos-app/Justfile
```

### Expected Impact Summary

| Optimization | Time/Resource Saved | Complexity |
|-------------|---------------------|------------|
| Remove CI just install | ~2-3s per E2E job | Low |
| Remove developer dependency | Setup friction eliminated | Low |
| Consolidate to single task runner | Mental overhead reduced | Low |

### Alternative: Keep Just (Not Recommended)

If you prefer to keep `just`:
- Document the installation requirement in CONTRIBUTING.md
- Consider caching the `just` binary in CI
- Accept the ongoing maintenance burden

However, since the Justfile only contains simple shell scripts with no just-specific features (no dependencies, no conditionals), migration to npm scripts is straightforward and recommended.

## Architecture Documentation

The current testing architecture relies on:
1. **Turborepo** - Monorepo task orchestration
2. **pnpm** - Package management and script running
3. **Vitest** - Test runner
4. **just** - Local backend management (isolated to polychromos-app)

After migration, `just` would be removed, leaving a cleaner single-tool setup with pnpm as the only task runner.

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-02-polychromos-testing-infrastructure.md` - Original plan that introduced the Justfile for Convex local backend management
- `thoughts/shared/research/2026-02-02-polychromos-testing-1-infrastructure.md` - Research that recommended Justfile approach

## Open Questions

1. Should the shell script be converted to a Node.js script for better Windows compatibility? (Current shell script assumes bash)
2. Should `convex-local-backend` binary be gitignored or committed? (Currently gitignored)

## Conclusion

**Recommendation: Replace `just` with npm scripts**

The `just` command runner adds complexity without providing commensurate value for this use case. The Justfile contains only simple shell commands that can be trivially migrated to npm scripts, eliminating an external dependency and simplifying CI configuration.
