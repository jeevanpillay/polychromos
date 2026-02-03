---
date: 2026-02-03T10:50:00+11:00
author: Claude
git_commit: cb43c69a5a08b50f4e57072a08fda99e77963882
branch: feat/polychromos-mvp-implementation
topic: "Cherry-pick strategy for Polychromos extraction"
tags: [plan, git, cherry-pick, polychromos, extraction]
status: ready
last_updated: 2026-02-03
---

# Cherry-Pick Strategy for Polychromos Extraction

## Problem Statement

The `feat/polychromos-mvp-implementation` branch contains 29 commits ahead of `main`. Some of these commits include improvements to `apps/www` (the personal portfolio) that should be preserved in the original repo after extracting Polychromos.

## Commits Touching apps/www

| Commit | Message | WWW Changes | Type |
|--------|---------|-------------|------|
| `3717fefd` | feat(www): add dynamic OG image generation | New `/og.png` route, SEO update | **WWW-only** |
| `0cb0cb42` | fix(www, polychromos-www): add Linux native binding | 1 dependency in package.json | Mixed |
| `95fba10c` | feat: add production hardening | middleware.ts, start.ts (4 files) | Mixed |
| `72ce91b3` | feat: add dynamic robots.txt routes | New route, delete static robots.txt | Mixed |
| `61c1d8ae` | fix: update Convex setup | 1 line in package.json | Mixed (minimal) |

### Detailed WWW Changes Per Commit

**3717fefd** - OG Image Generation (www-only)
```
apps/www/package.json            (+3 lines - dependencies)
apps/www/src/lib/seo.ts          (update OG image URL)
apps/www/src/routeTree.gen.ts    (auto-generated)
apps/www/src/routes/og[.]png.tsx (NEW - 141 lines)
apps/www/vite.config.ts          (+17 lines - Nitro config)
```

**0cb0cb42** - Linux Native Binding
```
apps/www/package.json            (+3 lines - @takumi-rs/core-linux-x64-gnu)
```

**95fba10c** - Production Hardening
```
apps/www/src/lib/middleware.ts   (NEW - 60 lines - security headers)
apps/www/src/middleware.ts       (DELETED - 45 lines - old middleware)
apps/www/src/routeTree.gen.ts    (auto-generated)
apps/www/src/start.ts            (NEW - 11 lines - createStart config)
```

**72ce91b3** - Dynamic robots.txt
```
apps/www/public/robots.txt       (DELETED - static file)
apps/www/src/routeTree.gen.ts    (auto-generated)
apps/www/src/routes/robots[.]txt.ts (NEW - 26 lines)
```

**61c1d8ae** - Convex Setup
```
apps/www/package.json            (1 line change - minor)
```

## Recommended Strategy: Merge-Then-Extract

The cleanest approach given the mixed commits is:

### Phase 1: Merge Polychromos Branch to Main

```bash
# Switch to main
git checkout main

# Merge the polychromos branch
git merge feat/polychromos-mvp-implementation -m "Merge polychromos MVP implementation

This merge brings:
- apps/polychromos-app (Convex + Clerk design app)
- apps/polychromos-www (marketing site)
- packages/polychromos (CLI)
- packages/polychromos-types (shared types)
- Production hardening for apps/www
- Dynamic OG images for apps/www
- Dynamic robots.txt for apps/www"

# Push to origin
git push origin main
```

**Result**: Main now has all www improvements AND all polychromos code.

### Phase 2: Extract Polychromos to New Repo

```bash
# Clone fresh from main (now includes everything)
git clone --no-local . ../polychromos-standalone
cd ../polychromos-standalone

# Extract only polychromos paths
git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/

# Set up new remote
git remote add origin https://github.com/NEW_ORG/polychromos.git
git push -u origin --all
git push --tags
```

**Result**: New polychromos repo with clean history of only polychromos changes.

### Phase 3: Clean Up Original Repo (Optional)

If you want to remove polychromos code from the original `x` repo:

```bash
cd /Users/jeevanpillay/Code/@jeevanpillaystudios/x
git checkout main

# Remove polychromos directories
rm -rf apps/polychromos-app apps/polychromos-www
rm -rf packages/polychromos packages/polychromos-types

# Update pnpm-workspace.yaml (remove polychromos entries)
# Update package.json (remove polychromos scripts)
# Update turbo.json (remove polychromos env vars)
# Update .changeset/config.json (remove polychromos packages)

# Commit cleanup
git add -A
git commit -m "chore: remove polychromos code (extracted to separate repo)"
git push origin main
```

## Alternative Strategy: Surgical Cherry-Pick

If you prefer NOT to have polychromos code in main at all, use this approach:

### Step 1: Create www-only patches

```bash
# Create patches for www-only changes from each commit
git format-patch -1 3717fefd -- apps/www/ > /tmp/www-og-image.patch
git format-patch -1 0cb0cb42 -- apps/www/ > /tmp/www-linux-binding.patch
git format-patch -1 95fba10c -- apps/www/ > /tmp/www-hardening.patch
git format-patch -1 72ce91b3 -- apps/www/ > /tmp/www-robots.patch
```

### Step 2: Apply patches to main

```bash
git checkout main

# Apply each patch (may need manual resolution)
git apply /tmp/www-og-image.patch
git add -A && git commit -m "feat(www): add dynamic OG image generation"

git apply /tmp/www-linux-binding.patch
git add -A && git commit -m "fix(www): add Linux native binding for Vercel OG"

git apply /tmp/www-hardening.patch
git add -A && git commit -m "feat(www): add production hardening"

git apply /tmp/www-robots.patch
git add -A && git commit -m "feat(www): add dynamic robots.txt route"

git push origin main
```

### Step 3: Extract from polychromos branch

```bash
git clone --no-local --branch feat/polychromos-mvp-implementation . ../polychromos
cd ../polychromos
git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/
```

## Comparison

| Approach | Pros | Cons |
|----------|------|------|
| **Merge-Then-Extract** | Simple, preserves all history, no conflicts | Main temporarily has polychromos code |
| **Surgical Cherry-Pick** | Main never has polychromos | Complex, may have conflicts, loses some commit context |

## Recommendation

**Use Merge-Then-Extract** because:

1. It's simpler and less error-prone
2. Git history stays intact and connected
3. All www improvements are automatically included
4. The cleanup step (Phase 3) can remove polychromos code cleanly afterward
5. The `pnpm-lock.yaml` changes in mixed commits are handled automatically

## Execution Checklist

- [ ] Ensure all polychromos work is committed
- [ ] Create new GitHub repository for polychromos
- [ ] Install git-filter-repo: `brew install git-filter-repo`
- [ ] **Phase 1**: Merge polychromos branch to main
- [ ] **Phase 2**: Clone and extract polychromos
- [ ] **Phase 2**: Push to new polychromos repository
- [ ] **Phase 3**: Clean up original x repo (remove polychromos code)
- [ ] Verify apps/www still builds and works
- [ ] Verify polychromos repo builds and works
- [ ] Update any CI/CD, Vercel projects, etc.

## Post-Extraction Updates

### In the new polychromos repo:
- [ ] Update `.changeset/config.json` with new repo name
- [ ] Update root `package.json` name and scripts
- [ ] Update `pnpm-workspace.yaml`
- [ ] Set up Vercel projects for polychromos-app and polychromos-www
- [ ] Configure npm publishing for polychromos and @polychromos/types

### In the original x repo:
- [ ] Remove polychromos scripts from root package.json
- [ ] Remove polychromos env vars from turbo.json
- [ ] Remove polychromos from .changeset/config.json ignore list
- [ ] Update GitHub workflows (remove polychromos paths)

---

## IMPLEMENTED: Surgical Approach

The surgical approach has been implemented and tested. All artifacts are ready to use.

### Created Artifacts

```
scripts/
├── extract-polychromos.sh      # Main extraction script
└── www-patches/
    ├── 01-convex-setup.patch           # Minor package.json tweak
    ├── 02-production-hardening.patch   # Security middleware + start.ts
    ├── 03-og-image.patch               # Dynamic OG image route
    ├── 04-linux-binding.patch          # Vercel native binding
    └── 05-robots-txt.patch             # Dynamic robots.txt route
```

### Patches Tested

All 5 patches were tested and apply cleanly to `main` when applied in sequence:

| Patch | Status | Changes |
|-------|--------|---------|
| 01-convex-setup | ✅ Clean | 1 line in package.json |
| 02-production-hardening | ✅ Clean | middleware.ts, start.ts |
| 03-og-image | ✅ Clean | og[.]png.tsx, seo.ts, vite.config.ts |
| 04-linux-binding | ✅ Clean | 1 dependency in package.json |
| 05-robots-txt | ✅ Clean | robots[.]txt.ts, delete static file |

### How to Execute

**Option A: Run the script (automated)**
```bash
cd /Users/jeevanpillay/Code/@jeevanpillaystudios/x
./scripts/extract-polychromos.sh
```

**Option B: Manual step-by-step**

```bash
# 1. Install git-filter-repo
brew install git-filter-repo

# 2. Switch to main and create www improvements branch
git checkout main
git checkout -b feat/www-improvements-from-polychromos

# 3. Apply patches in order
PATCHES="scripts/www-patches"
git apply "$PATCHES/01-convex-setup.patch"
git apply "$PATCHES/02-production-hardening.patch"
git apply "$PATCHES/03-og-image.patch"
git apply "$PATCHES/04-linux-binding.patch"
git apply "$PATCHES/05-robots-txt.patch"

# 4. Regenerate lockfile
pnpm install

# 5. Commit changes (see script for detailed commit messages)
git add -A
git commit -m "feat(www): add OG images, security middleware, dynamic robots.txt"

# 6. Merge to main
git checkout main
git merge feat/www-improvements-from-polychromos
git push origin main

# 7. Extract polychromos to new repo
git clone --no-local --branch feat/polychromos-mvp-implementation . /tmp/polychromos
cd /tmp/polychromos
git filter-repo \
  --path apps/polychromos-app/ \
  --path apps/polychromos-www/ \
  --path packages/polychromos/ \
  --path packages/polychromos-types/

# 8. Push to new remote
git remote add origin https://github.com/YOUR_ORG/polychromos.git
git push -u origin --all
```

### Result

After execution:
- **`x` repo main branch**: Has all www improvements, NO polychromos code
- **New polychromos repo**: Has only polychromos code with clean git history
