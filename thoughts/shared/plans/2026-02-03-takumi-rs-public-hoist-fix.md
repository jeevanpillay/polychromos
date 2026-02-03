---
date: 2026-02-03T01:30:00+08:00
author: claude-opus-4-5
git_commit: db395fd571d8ded1fad5c0e4f1829f6f870f132a
branch: main
repository: polychromos
topic: "Fix @takumi-rs native binding via pnpm public-hoist-pattern"
tags: [plan, vercel, native-bindings, og-images, takumi-rs, pnpm]
status: implemented
last_updated: 2026-02-03
last_updated_by: claude-opus-4-5
related_research: thoughts/shared/research/2026-02-03-takumi-rs-vercel-native-binding-failure.md
---

# Fix @takumi-rs Native Binding via pnpm public-hoist-pattern

## Overview

The `og.png` route on polychromos-www fails on Vercel with "Cannot find module '@takumi-rs/core-linux-x64-gnu'" because platform-specific native bindings are not being properly bundled into the serverless function. This plan implements the public-hoist-pattern solution to ensure all @takumi-rs bindings are hoisted to the root node_modules where Nitro's bundler can find them.

## Current State Analysis

**The Problem:**
1. `@takumi-rs/core` requires platform-specific native bindings (e.g., `@takumi-rs/core-linux-x64-gnu` for Vercel)
2. With pnpm's `node-linker=hoisted`, dependencies are hoisted but the Linux binding may not be physically present on macOS during local development
3. Even though Vercel runs `pnpm install` which should install platform-specific bindings, Nitro's `traceInclude` configuration may not find them in pnpm's hoisted structure

**Current Configuration:**
- `.npmrc:3` has `node-linker=hoisted`
- `apps/polychromos-www/package.json:34-36` has `@takumi-rs/core-linux-x64-gnu` as optional dependency
- `apps/polychromos-www/vite.config.ts:23-31` has `traceInclude` paths for @takumi-rs packages

**Why Current Fix Isn't Working:**
The `traceInclude` paths point to `node_modules/@takumi-rs/...` but in a pnpm monorepo, these packages may be hoisted to the workspace root `node_modules/` rather than the app's local `node_modules/`. The `public-hoist-pattern` setting ensures these packages are always accessible at the root level.

## Desired End State

After implementation:
1. All `@takumi-rs/*` packages are hoisted to the workspace root `node_modules/`
2. The `/og.png` route successfully generates OG images on Vercel serverless
3. No "Cannot find native binding" errors in production

### Verification:
- Deploy to Vercel and visit `https://polychromos.studio/og.png` - should return a valid PNG image
- Check Vercel function logs for successful execution without native binding errors

## What We're NOT Doing

- NOT switching to `@vercel/og` (would require font conversion)
- NOT switching to WASM version (doesn't support WOFF2 fonts)
- NOT using `shamefully-hoist=true` (too broad, hoists everything)
- NOT modifying the OG image route code

## Implementation Approach

The fix requires two changes:
1. Add `public-hoist-pattern` to `.npmrc` to ensure @takumi-rs bindings are hoisted to root
2. Add all potential platform bindings as optional dependencies (for completeness)

## Phase 1: Update pnpm Configuration

### Overview
Add `public-hoist-pattern` entries for all @takumi-rs packages to ensure they're hoisted to the workspace root node_modules.

### Changes Required:

#### 1. Update `.npmrc`
**File**: `.npmrc`
**Changes**: Add public-hoist-pattern for @takumi-rs packages

```ini
auto-install-peers = true
enable-pre-post-scripts=true # Enable pre/post scripts (for postui:add)
node-linker=hoisted
link-workspace-packages=true
public-hoist-pattern[]=@takumi-rs/*
```

### Success Criteria:

#### Automated Verification:
- [ ] pnpm install completes without errors: `pnpm install`
- [ ] @takumi-rs packages appear in root node_modules: `ls node_modules/@takumi-rs/`
- [ ] Build completes: `pnpm build:www`
- [ ] Lint passes: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:
- [ ] Deploy to Vercel preview
- [ ] Visit `/og.png` endpoint on preview URL
- [ ] Verify PNG image is returned with correct content
- [ ] Check Vercel function logs for no native binding errors

**Implementation Note**: After completing this phase and all automated verification passes, deploy to Vercel preview and manually test the `/og.png` endpoint before proceeding.

---

## Phase 2: Add All Platform Bindings (Optional Hardening)

### Overview
Add all platform-specific bindings as optional dependencies to ensure any deployment target can find its native binding.

### Changes Required:

#### 1. Update package.json
**File**: `apps/polychromos-www/package.json`
**Changes**: Add all @takumi-rs platform bindings to optionalDependencies

```json
{
  "optionalDependencies": {
    "@takumi-rs/core-darwin-arm64": "^0.66.13",
    "@takumi-rs/core-darwin-x64": "^0.66.13",
    "@takumi-rs/core-linux-arm64-gnu": "^0.66.13",
    "@takumi-rs/core-linux-arm64-musl": "^0.66.13",
    "@takumi-rs/core-linux-x64-gnu": "^0.66.13",
    "@takumi-rs/core-linux-x64-musl": "^0.66.13"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] pnpm install completes: `pnpm install`
- [ ] Lock file updated: `git diff pnpm-lock.yaml` shows new entries
- [ ] Build completes: `pnpm build:www`

#### Manual Verification:
- [ ] Deploy to Vercel production
- [ ] Visit `https://polychromos.studio/og.png`
- [ ] Verify OG image renders correctly

**Implementation Note**: Phase 2 is optional hardening. If Phase 1 resolves the issue, Phase 2 provides additional robustness for future platform support.

---

## Testing Strategy

### Local Testing:
1. Run `pnpm install` after `.npmrc` change
2. Verify @takumi-rs packages in root node_modules: `ls node_modules/@takumi-rs/`
3. Build www: `pnpm build:www`
4. Check build output for @takumi-rs in traced files

### Vercel Preview Testing:
1. Push changes to a branch
2. Let Vercel create a preview deployment
3. Access `/og.png` on preview URL
4. Check function logs in Vercel dashboard

### Production Testing:
1. Merge to main
2. Monitor Vercel deployment logs
3. Test `https://polychromos.studio/og.png`

## Rollback Plan

If the fix doesn't work:
1. Remove the `public-hoist-pattern` line from `.npmrc`
2. Run `pnpm install` to restore previous state
3. Consider alternative approaches from research document:
   - Convert fonts and use `@vercel/og`
   - Create standalone serverless function
   - Use Satori + Sharp directly

## References

- Research document: `thoughts/shared/research/2026-02-03-takumi-rs-vercel-native-binding-failure.md`
- [pnpm public-hoist-pattern docs](https://pnpm.io/settings)
- [pnpm .npmrc settings](https://pnpm.io/9.x/npmrc)
- [@takumi-rs/core npm](https://www.npmjs.com/package/@takumi-rs/core)
- [Bun + TanStack Start native binding issue #26251](https://github.com/oven-sh/bun/issues/26251)
