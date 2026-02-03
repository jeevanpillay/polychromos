---
date: 2026-02-03T12:50:00+08:00
researcher: Claude
git_commit: b441a7d528e29d1b88fb51696a90399f9ad0d67a
branch: main
repository: polychromos
topic: "Convex dev setup in fresh repo - pnpm dev:app failure analysis"
tags: [research, codebase, convex, local-development, setup]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Convex dev setup in fresh repo - pnpm dev:app failure analysis

**Date**: 2026-02-03T12:50:00+08:00
**Researcher**: Claude
**Git Commit**: b441a7d528e29d1b88fb51696a90399f9ad0d67a
**Branch**: main
**Repository**: polychromos

## Research Question
Why does `pnpm dev:app` fail with Convex-related issues in a fresh repo? Document the current setup and identify what happens during initialization.

## Summary

The `pnpm dev:app` command fails because the current setup assumes an already-initialized Convex local deployment exists. In a fresh repo or after deleting `~/.convex/anonymous-convex-backend-state/anonymous-polychromos-app`, the setup fails because:

1. The `setup-convex.js` script runs `npx convex dev --once` which requires either:
   - A valid `CONVEX_DEPLOYMENT` env var pointing to an existing deployment, OR
   - Interactive terminal input to configure a new project

2. The `.vercel/.env.development.local` file may contain stale `CONVEX_DEPLOYMENT` values from previous runs

3. The `convex.json` specifies `team: "polychromos"` and `project: "polychromos-mvp"` which requires Convex authentication for cloud deployments

## Detailed Findings

### Command Flow

When running `pnpm dev:app` from the monorepo root:

1. **Root package.json** (`package.json:16`):
   ```json
   "dev:app": "turbo watch dev -F @repo/app --continue"
   ```

2. **App package.json** (`apps/polychromos-app/package.json:7-10`):
   ```json
   "dev": "pnpm run dev:setup && concurrently -r npm:dev:web npm:dev:convex",
   "dev:web": "pnpm exec dotenv -e .vercel/.env.development.local -- vite dev",
   "dev:convex": "pnpm exec dotenv -e .vercel/.env.development.local -- npx convex dev",
   "dev:setup": "pnpm exec dotenv -e .vercel/.env.development.local -- node scripts/setup-convex.js"
   ```

### Setup Script Behavior

The `setup-convex.js` script (`apps/polychromos-app/scripts/setup-convex.js`):

1. **Checks if backend is running** on `http://127.0.0.1:3210`
2. If running: skips startup, proceeds to set env vars
3. If not running: spawns `npx convex dev --once --typecheck disable --codegen disable`
4. **Sets environment variables** in Convex backend by reading from `.vercel/.env.development.local`
5. **Syncs env vars** from `.env.local` to `.vercel/.env.development.local`

### Current Configuration Files

**convex.json** (`apps/polychromos-app/convex.json`):
```json
{
  "team": "polychromos",
  "project": "polychromos-mvp"
}
```
This configuration points to a cloud Convex project, requiring authentication.

**.vercel/.env.development.local** (contains):
- Clerk credentials (from Vercel)
- Stale Convex local development vars (synced from previous `.env.local`)
  ```
  CONVEX_DEPLOYMENT=anonymous:anonymous-polychromos-app
  VITE_CONVEX_URL=http://127.0.0.1:3212
  VITE_CONVEX_SITE_URL=http://127.0.0.1:3213
  ```

### Two Convex Deployment Approaches in Codebase

#### 1. Anonymous Local Development (via `npx convex dev`)

When `CONVEX_DEPLOYMENT` is unset or set to `anonymous:*`, Convex CLI:
- Creates/uses `~/.convex/anonymous-convex-backend-state/<project-name>/`
- Runs a local Convex backend
- No authentication required
- Port 3210 (default), 3211 (admin), 3212/3213 (alternate)

**Issue**: First run requires interactive configuration which fails in non-interactive shells.

#### 2. Standalone Local Backend (via `local-backend.sh`)

The `scripts/local-backend.sh` provides a separate approach:
```bash
./scripts/local-backend.sh run     # Download and run local backend
./scripts/local-backend.sh reset   # Clear local data
./scripts/local-backend.sh convex  # Run convex CLI against local backend
```

Uses hardcoded admin key and URL:
```bash
BACKEND_URL="http://127.0.0.1:3210"
ADMIN_KEY="0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd"
```

This approach is used for E2E testing but NOT for regular `dev:app`.

### Error Scenarios

#### Scenario 1: Fresh Clone with No `.env.local`
```
Starting Convex local backend...
Could not find project with name anonymous-polychromos-app!
✖ Cannot prompt for input in non-interactive terminals.
```
**Cause**: `npx convex dev` sees `convex.json` with team/project and tries to use cloud deployment.

#### Scenario 2: Stale Backend Running (different deployment)
```
Convex backend already running, setting env vars...
✖ Could not find deployment with name anonymous-polychromos-app!
```
**Cause**: Backend on port 3210 exists but doesn't have the deployment the env var references.

#### Scenario 3: CONVEX_DEPLOYMENT Cleared
```
✖ Cannot prompt for input in non-interactive terminals. (Welcome to Convex! Would you like to login?)
```
**Cause**: Without `CONVEX_DEPLOYMENT`, Convex CLI tries to use `convex.json` which requires authentication.

### Files Involved in Convex Setup

| File | Purpose |
|------|---------|
| `apps/polychromos-app/convex.json` | Defines Convex team/project for cloud deployment |
| `apps/polychromos-app/.env.local` | Created by `convex dev` with deployment info (gitignored) |
| `apps/polychromos-app/.vercel/.env.development.local` | Vercel-managed env vars + synced Convex vars |
| `apps/polychromos-app/scripts/setup-convex.js` | Development setup script |
| `apps/polychromos-app/scripts/sync-env.js` | Syncs Convex vars from .env.local to .vercel |
| `apps/polychromos-app/scripts/local-backend.sh` | Standalone local backend management |
| `~/.convex/anonymous-convex-backend-state/` | Global Convex local deployment state |

### E2E Testing Approach (Working)

The E2E tests in `test/backendHarness.cjs` use a different, more robust approach:

1. Uses `local-backend.sh run` to start standalone binary
2. Uses `local-backend.sh convex deploy` with `--admin-key` and `--url` flags
3. Bypasses the `npx convex dev` initialization entirely
4. Always resets data before tests

## Code References

- `apps/polychromos-app/package.json:7-11` - Dev scripts configuration
- `apps/polychromos-app/scripts/setup-convex.js:1-179` - Full setup script
- `apps/polychromos-app/scripts/local-backend.sh:1-49` - Standalone backend script
- `apps/polychromos-app/convex.json:1-4` - Convex project configuration
- `apps/polychromos-app/test/backendHarness.cjs:50-82` - E2E backend startup

## Architecture Documentation

### Current Development Flow (Intended)
```
pnpm dev:app
  └── turbo watch dev -F @repo/app
        └── pnpm run dev:setup (setup-convex.js)
              ├── Check if backend running on :3210
              ├── If not, run `npx convex dev --once`
              ├── Set env vars via `npx convex env set`
              └── Sync .env.local → .vercel/.env.development.local
        └── concurrently dev:web dev:convex
              ├── vite dev (with env vars)
              └── npx convex dev (watching)
```

### Current Development Flow (Actual on Fresh Clone)
```
pnpm dev:app
  └── turbo watch dev -F @repo/app
        └── pnpm run dev:setup (setup-convex.js)
              ├── Check if backend running → NO
              ├── Run `npx convex dev --once`
              │     └── FAILS: Cannot prompt for input
              ├── Continue despite failure
              ├── Set env vars → FAILS: deployment doesn't exist
              └── Sync → SKIPPED: no .env.local
        └── concurrently dev:web dev:convex
              ├── vite dev → FAILS: VITE_CONVEX_URL may be invalid
              └── npx convex dev → FAILS: same issue
```

## Historical Context (from thoughts/)

Previous research documents indicate:
- `thoughts/shared/research/2026-02-02-polychromos-testing-1-infrastructure.md` - Documents local backend setup for testing
- `thoughts/shared/plans/2026-03-just-to-npm-scripts-migration.md` - Migration from Justfile to npm scripts
- The E2E testing infrastructure was designed separately from the dev workflow

## Related Research

- `thoughts/shared/research/2026-02-02-polychromos-tanstack-start-setup.md` - TanStack Start with Convex integration
- `thoughts/shared/research/2026-02-03-polychromos-app-e2e-testing-architecture.md` - E2E testing architecture

## Open Questions

1. **Should `dev:app` use the `local-backend.sh` approach like E2E tests?**
   - More reliable, no authentication required
   - Would require refactoring `setup-convex.js`

2. **Should `convex.json` be modified for local-only development?**
   - Removing team/project would allow anonymous local dev
   - But this affects cloud deployment configuration

3. **Should there be a first-time setup command?**
   - Like `pnpm setup:convex` that runs interactively
   - Would configure local development one-time

4. **Should `.vercel/.env.development.local` not include Convex vars by default?**
   - Fresh clones would have no stale values
   - Setup would need to detect and handle this
