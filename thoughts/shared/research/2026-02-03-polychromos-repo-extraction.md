---
date: 2026-02-03T10:44:01+11:00
researcher: Claude
git_commit: cb43c69a5a08b50f4e57072a08fda99e77963882
branch: feat/polychromos-mvp-implementation
repository: jeevanpillaystudios/x
topic: "Extracting Polychromos code into a new standalone repository"
tags: [research, codebase, polychromos, git-filter-repo, monorepo-extraction]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Extracting Polychromos into a Standalone Repository

**Date**: 2026-02-03T10:44:01+11:00
**Researcher**: Claude
**Git Commit**: cb43c69a5a08b50f4e57072a08fda99e77963882
**Branch**: feat/polychromos-mvp-implementation
**Repository**: jeevanpillaystudios/x

## Research Question

How to extract all Polychromos-related code from the current monorepo into a new standalone repository, preserving only the relevant git commit history (not PRs or issues).

## Summary

The extraction requires using `git-filter-repo` to extract 4 directories (2 apps + 2 packages) while preserving commit history. The polychromos branch has 29 commits ahead of main that contain all polychromos work. However, there are **shared dependencies** (`@repo/ui`, internal configs) that need decisions: either copy them or replace with npm alternatives.

## Current Repository Structure

### What Belongs to Polychromos

| Path | Package Name | Type | Publishable |
|------|--------------|------|-------------|
| `apps/polychromos-app/` | `@repo/polychromos-app` | TanStack Start + Convex + Clerk app | No (private) |
| `apps/polychromos-www/` | `@repo/polychromos-www` | Marketing website | No (private) |
| `packages/polychromos/` | `polychromos` | CLI tool | Yes (npm) |
| `packages/polychromos-types/` | `@polychromos/types` | Shared types | Yes (npm) |

### What Belongs to Personal Portfolio

| Path | Package Name | Description |
|------|--------------|-------------|
| `apps/www/` | `@repo/www` | Jeevan Pillay's personal portfolio |
| `packages/tools/canvas-kit/` | `@repo/canvas-kit` | Personal canvas utilities |

### Shared Infrastructure (Decision Required)

| Path | Package Name | Used By |
|------|--------------|---------|
| `packages/ui/` | `@repo/ui` | All apps (www, polychromos-app, polychromos-www) |
| `internal/eslint/` | `@repo/eslint-config` | All packages |
| `internal/prettier/` | `@repo/prettier-config` | All packages |
| `internal/typescript/` | `@repo/typescript-config` | All packages |

## Git History Analysis

### Branch Structure

```
main                     → Personal portfolio + base infrastructure
  └── feat/polychromos-mvp-implementation (29 commits ahead)
                         → All polychromos work
```

### Key Commits

- **First polychromos commit**: `598888aa` - "docs: add Polychromos MVP implementation plan"
- **Branch point from main**: `4f3712c3` - "chore: migrate ESLint/Prettier config from Next.js to TanStack Start"
- **Latest commit**: `45fc4e11` - "refactor(ci): consolidate workflows with path detection and caching"

### Commits on Polychromos Branch (29 total)

Most commits are polychromos-specific, but some touch shared code:
- `0cb0cb42` - "fix(www, polychromos-www): add Linux native binding for Vercel OG images" (touches both projects)
- `95fba10c` - "feat: add production hardening to polychromos-www and www apps" (touches both projects)
- `3717fefd` - "feat(www): add dynamic OG image generation" (www-only, but on polychromos branch)

## Extraction Strategy

### Recommended Tool: git-filter-repo

`git-filter-repo` is the official Git-recommended tool (replaced deprecated `git filter-branch`). It's 100-1000x faster and handles multi-path extraction well.

**Installation:**
```bash
brew install git-filter-repo  # macOS
```

### Option 1: Extract Polychromos Only (Minimal)

Extract only the 4 polychromos directories:

```bash
# Create fresh clone from the polychromos branch
git clone --no-local --branch feat/polychromos-mvp-implementation . ../polychromos-standalone
cd ../polychromos-standalone

# Extract polychromos directories only
git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/
```

**Result:**
- Commits touching only these 4 directories are preserved
- Commits touching www or other paths are included but modified (only polychromos changes remain)
- Empty commits are automatically removed

**Post-extraction work required:**
1. Replace `@repo/ui` dependency with copied UI components or shadcn/ui directly
2. Replace `@repo/eslint-config` with standalone ESLint config
3. Replace `@repo/prettier-config` with standalone Prettier config
4. Replace `@repo/typescript-config` with standalone tsconfig files
5. Update `pnpm-workspace.yaml` to new structure
6. Update root `package.json`
7. Update `.changeset/config.json` (change repo reference)

### Option 2: Extract Polychromos + Shared Infrastructure

Extract polychromos code plus the shared configs it depends on:

```bash
git clone --no-local --branch feat/polychromos-mvp-implementation . ../polychromos-standalone
cd ../polychromos-standalone

git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/ \
  --path packages/ui/ \
  --path internal/eslint/ \
  --path internal/prettier/ \
  --path internal/typescript/ \
  --path package.json \
  --path pnpm-workspace.yaml \
  --path pnpm-lock.yaml \
  --path turbo.json \
  --path .gitignore \
  --path .changeset/
```

**Result:**
- More complete extraction
- Less post-extraction work
- But includes `@repo/ui` which has many components not needed by polychromos

**Post-extraction work required:**
1. Remove unused UI components
2. Update `package.json` scripts (remove www references)
3. Update `pnpm-workspace.yaml`
4. Update `.changeset/config.json`
5. Clean up `turbo.json`

### Option 3: Restructure During Extraction

Flatten the directory structure for a simpler layout:

```bash
git clone --no-local --branch feat/polychromos-mvp-implementation . ../polychromos-standalone
cd ../polychromos-standalone

git filter-repo \
  --path apps/polychromos-app/ --path-rename apps/polychromos-app/:app/ \
  --path apps/polychromos-www/ --path-rename apps/polychromos-www/:www/ \
  --path packages/polychromos/ --path-rename packages/polychromos/:cli/ \
  --path packages/polychromos-types/ --path-rename packages/polychromos-types/:types/
```

**Resulting structure:**
```
polychromos-standalone/
├── app/           # Was apps/polychromos-app
├── www/           # Was apps/polychromos-www
├── cli/           # Was packages/polychromos
└── types/         # Was packages/polychromos-types
```

## Dependencies Analysis

### External Dependencies (No changes needed)

These are npm packages, no action required:
- `convex`, `@clerk/clerk-react`, `commander`, `chokidar`, `zod`, `rfc6902`, etc.

### Workspace Dependencies (Action required)

| Dependency | Used In | Options |
|------------|---------|---------|
| `@repo/ui` | polychromos-app, polychromos-www | Copy needed components OR publish to npm OR use shadcn directly |
| `@repo/eslint-config` | All packages | Copy OR create new config |
| `@repo/prettier-config` | All packages | Copy OR create new config |
| `@repo/typescript-config` | All packages | Copy OR create new config |
| `@polychromos/types` | polychromos, polychromos-app | Already included in extraction |

### UI Components Used by Polychromos

From `apps/polychromos-app/`:
- Basic components from `@repo/ui` (minimal usage based on codebase)

From `apps/polychromos-www/`:
- Minimal UI usage (mostly custom components)

**Recommendation**: Create a minimal `packages/ui/` with only needed components, or use shadcn/ui directly in each app.

## CI/CD Considerations

### Current Workflows

| File | Purpose | Needs Update |
|------|---------|--------------|
| `.github/workflows/ci.yml` | Main CI pipeline | Yes - remove www paths |
| `.github/workflows/changesets.yml` | Version management | Yes - update repo reference |
| `.github/workflows/release.yml` | npm publishing | Yes - update repo reference |

### Changesets Configuration

Current `.changeset/config.json`:
```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "jeevanpillaystudios/x" }],
  "fixed": [["polychromos", "@polychromos/types"]],
  "ignore": ["@repo/www", "@repo/polychromos-app", "@repo/polychromos-www", ...]
}
```

**Update required:**
- Change `repo` to new repository name
- Remove `ignore` entries for non-polychromos packages
- Keep `fixed` grouping for CLI and types

## Step-by-Step Extraction Plan

### Phase 1: Prepare

1. Ensure all polychromos work is committed on `feat/polychromos-mvp-implementation`
2. Create the new empty GitHub repository (e.g., `polychromos` or `polychromos-studio`)
3. Install git-filter-repo: `brew install git-filter-repo`

### Phase 2: Extract

```bash
# 1. Clone fresh copy of the polychromos branch
cd /tmp
git clone --no-local --branch feat/polychromos-mvp-implementation \
  /Users/jeevanpillay/Code/@jeevanpillaystudios/x polychromos-extracted
cd polychromos-extracted

# 2. Extract polychromos paths (Option 2 recommended)
git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/ \
  --path packages/ui/ \
  --path internal/ \
  --path .github/ \
  --path .changeset/ \
  --path package.json \
  --path pnpm-workspace.yaml \
  --path pnpm-lock.yaml \
  --path turbo.json \
  --path tsconfig.json \
  --path vitest.config.ts \
  --path .gitignore \
  --path .prettierignore \
  --path CLAUDE.md

# 3. Verify history
git log --oneline | head -20
```

### Phase 3: Clean Up

1. **Update `pnpm-workspace.yaml`:**
   - Remove `packages/tools/*` entry (canvas-kit not needed)
   - Keep apps/*, packages/*, internal/*

2. **Update root `package.json`:**
   - Remove www-related scripts
   - Update name from "x" to "polychromos"
   - Keep polychromos scripts

3. **Update `.changeset/config.json`:**
   - Change repo to new repository name
   - Remove @repo/www, @repo/canvas-kit, @repo/tools from ignore

4. **Update `turbo.json`:**
   - Remove www-related environment variables if any

5. **Clean up `packages/ui/`:**
   - Remove unused components (audit which are actually used)
   - Or replace with direct shadcn/ui usage

6. **Update CI workflows:**
   - Remove www path filters
   - Update any repository references

### Phase 4: Push to New Repository

```bash
# Add new remote
git remote add origin https://github.com/YOUR_ORG/polychromos.git

# Push all branches
git push -u origin --all

# Push tags
git push --tags
```

### Phase 5: Verify

1. Clone the new repository fresh
2. Run `pnpm install`
3. Run `pnpm build`
4. Run `pnpm test`
5. Verify git history: `git log --oneline --graph`

## Alternative: Fresh Start (No History)

If history preservation is not critical, a simpler approach:

```bash
# 1. Create new repo
mkdir polychromos-new && cd polychromos-new
git init

# 2. Copy directories manually
cp -r ../x/apps/polychromos-app ./apps/
cp -r ../x/apps/polychromos-www ./apps/
cp -r ../x/packages/polychromos ./packages/
cp -r ../x/packages/polychromos-types ./packages/
cp -r ../x/packages/ui ./packages/
cp -r ../x/internal ./
cp -r ../x/.github ./
cp -r ../x/.changeset ./
cp ../x/package.json ../x/pnpm-workspace.yaml ../x/turbo.json ./
# etc...

# 3. Create initial commit
git add -A
git commit -m "Initial commit: Extract polychromos from monorepo"
```

**Pros:** Simpler, cleaner history
**Cons:** Loses all commit history, blame, and authorship

## Open Questions

1. **New repository name?** Options: `polychromos`, `polychromos-studio`, `polychromos-design`
2. **Organization?** `jeevanpillaystudios` or new org like `polychromos-dev`?
3. **What to do with `@repo/ui`?**
   - Keep it (requires cleanup)
   - Replace with direct shadcn/ui
   - Publish to npm as `@polychromos/ui`
4. **Keep all branches?** The extraction will include `main` and the feature branch - may want to make `feat/polychromos-mvp-implementation` the new `main`

## Code References

- `pnpm-workspace.yaml:1-5` - Workspace packages configuration
- `package.json:9-35` - Scripts including polychromos and www
- `.changeset/config.json:1-21` - Changesets configuration with repo reference
- `apps/polychromos-app/package.json` - App dependencies including `@repo/ui`
- `packages/polychromos/package.json` - CLI dependencies

## Related Research

- `thoughts/shared/research/2026-02-03-polychromos-cli-publishing-prerequisites.md`
- `thoughts/shared/plans/2026-02-03-polychromos-cli-npm-publish-pipeline.md`
