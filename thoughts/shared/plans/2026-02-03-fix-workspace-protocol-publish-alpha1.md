---
date: 2026-02-03T18:15:00+08:00
author: Claude
git_commit: 59c75cf47992bb871e20479d20d3b10a5fb14023
branch: main
repository: polychromos
topic: "Fix workspace:* protocol publish failure and release alpha.1"
tags: [plan, npm, publishing, workspace-protocol, pnpm, changesets, alpha-release]
status: draft
last_updated: 2026-02-03
last_updated_by: Claude
---

# Fix workspace:* Protocol Publish Failure and Release alpha.1

## Overview

Fix the npm publish workflow that was incorrectly using `npm publish` instead of `pnpm publish`, causing `workspace:*` protocol references to be published verbatim (breaking end-user installations). Then create a clean alpha.1 release with proper changelog documentation.

## Current State Analysis

### The Problem

The `polychromos` CLI package (v0.1.0-alpha.0) was published with an unresolved `workspace:*` dependency:

```json
"dependencies": {
  "@polychromos/types": "workspace:*"  // Should be "0.1.0-alpha.0"
}
```

End users cannot install the package:
```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

### Root Cause

The release workflow (`.github/workflows/release.yml:80-92`) uses `npm publish` which does **not** understand pnpm's `workspace:*` protocol. Only `pnpm publish` or `pnpm pack` dynamically replaces `workspace:*` with actual versions during the publish process.

### Key Discoveries

- **pnpm 10.x supports `--provenance`**: [pnpm publish docs](https://pnpm.io/cli/publish) confirms provenance support
- **pnpm auto-resolves workspace protocol**: During `pnpm publish`, `workspace:*` becomes the exact version (e.g., `"1.5.0"`), `workspace:^` becomes caret range (`"^1.5.0"`)
- **Current version**: Both packages are at `0.1.0-alpha.0` on npm (broken)
- **Existing changeset**: `.changeset/initial-alpha-release.md` exists (for prior release)
- **Fixed versioning**: Changesets config groups `polychromos` and `@polychromos/types` together

## Desired End State

After this plan is complete:

1. Release workflow uses `pnpm publish` with `--provenance` flag
2. `polychromos@0.1.0-alpha.1` is published to npm with resolved dependency: `"@polychromos/types": "0.1.0-alpha.1"`
3. `@polychromos/types@0.1.0-alpha.1` is published to npm
4. Both packages are installable: `npm install polychromos@alpha`
5. CHANGELOGs document the fix clearly
6. Verification step in workflow confirms installation works

### Verification Commands

```bash
# After release, these should all succeed:
npm install polychromos@0.1.0-alpha.1
npm install @polychromos/types@0.1.0-alpha.1
npm install polychromos@alpha  # Should resolve to alpha.1
polychromos --version  # Should output 0.1.0-alpha.1
```

## What We're NOT Doing

- **Not using Changesets publish command**: While `pnpm changeset:publish` is an option, we keep manual control over publish order and error handling
- **Not removing workspace:* protocol**: This is the correct approach for monorepo dependencies - we just need to publish correctly
- **Not bundling types into CLI**: Keeping packages separate for proper dependency management
- **Not setting up npm trusted publishing yet**: Using `--provenance` with NPM_TOKEN for now; trusted publishing can be a future improvement

## Implementation Approach

1. Fix the release workflow to use `pnpm publish` instead of `npm publish`
2. Delete the stale changeset (it was for the previous broken release)
3. Create a new changeset for alpha.2 with clear fix description
4. Update package versions manually to skip alpha.1 (the broken release)
5. Push changes to trigger the release

---

## Phase 1: Fix Release Workflow

### Overview

Replace `npm publish` with `pnpm publish` in the GitHub Actions workflow to properly handle `workspace:*` protocol resolution.

### Changes Required

#### 1. Update Release Workflow

**File**: `.github/workflows/release.yml`

**Changes**: Replace `npm publish` with `pnpm publish --no-git-checks`

The `--no-git-checks` flag is required because:
- pnpm publish checks for clean git state and correct branch by default
- In CI, we're on a detached HEAD after checkout
- The checks are already handled by the workflow triggers

```yaml
# Replace lines 80-92 with:

# TODO: Remove --tag alpha when ready for stable release
# Alpha releases are installed with: npm install polychromos@alpha
# Stable releases (default): npm install polychromos
- name: Publish @polychromos/types to npm
  run: pnpm --filter @polychromos/types publish --access public --provenance --tag alpha --no-git-checks || echo "Package already published or publish failed"
  continue-on-error: true
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

- name: Publish polychromos to npm
  run: pnpm --filter polychromos publish --access public --provenance --tag alpha --no-git-checks || echo "Package already published or publish failed"
  continue-on-error: true
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Why this approach:**
- Uses pnpm filter syntax instead of `working-directory` - more idiomatic for pnpm workspaces
- `pnpm publish` automatically resolves `workspace:*` to actual versions
- `--provenance` generates supply chain attestations (supported in pnpm 10.x)
- `--no-git-checks` bypasses CI git state checks
- Order matters: types must publish before CLI

### Success Criteria

#### Automated Verification:
- [x] Workflow file is valid YAML: `cat .github/workflows/release.yml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)"`
- [x] pnpm filter syntax works: `pnpm --filter @polychromos/types exec pwd`

#### Manual Verification:
- [x] Workflow changes reviewed in GitHub PR

---

## Phase 2: Clean Up .changeset Folder

### Overview

Clean up the `.changeset` folder by removing stale changesets and updating the pre-release state to prepare for alpha.1.

### Changes Required

#### 1. Commit Deletion of fix-publish-workflow.md

**Action**: The file is already deleted, just needs to be staged and committed

```bash
git add .changeset/fix-publish-workflow.md
```

#### 2. Delete Stale Changeset

**File**: `.changeset/initial-alpha-release.md`

**Action**: Delete this file - it was consumed for the alpha.0 release

```bash
rm .changeset/initial-alpha-release.md
```

#### 3. Update pre.json

**File**: `.changeset/pre.json`

**Change**: Remove the consumed changeset from the list (it will be updated when we create the new changeset)

**Current content**:
```json
{
  "mode": "pre",
  "tag": "alpha",
  "initialVersions": {
    "@repo/app": "0.1.0",
    "@repo/www": "0.1.0",
    "@repo/eslint-config": "0.4.0",
    "@repo/prettier-config": "0.1.0",
    "@repo/typescript-config": "0.0.0",
    "polychromos": "0.1.0",
    "@polychromos/types": "0.1.0",
    "@repo/ui": "0.0.0"
  },
  "changesets": [
    "initial-alpha-release"
  ]
}
```

**New content**:
```json
{
  "mode": "pre",
  "tag": "alpha",
  "initialVersions": {
    "@repo/app": "0.1.0",
    "@repo/www": "0.1.0",
    "@repo/eslint-config": "0.4.0",
    "@repo/prettier-config": "0.1.0",
    "@repo/typescript-config": "0.0.0",
    "polychromos": "0.1.0",
    "@polychromos/types": "0.1.0",
    "@repo/ui": "0.0.0"
  },
  "changesets": []
}
```

**Note**: When we run `pnpm changeset` to create the new changeset, it will automatically add it to this array.

### Success Criteria

#### Automated Verification:
- [x] fix-publish-workflow.md is staged for deletion: `git diff --cached --name-only | grep -q "fix-publish-workflow.md"`
- [x] initial-alpha-release.md no longer exists: `! test -f .changeset/initial-alpha-release.md`
- [x] pre.json changesets array is empty: `node -p "require('./.changeset/pre.json').changesets.length === 0"`

---

## Phase 3: Create alpha.1 Changeset

### Overview

Create a new changeset that will bump both packages to 0.1.0-alpha.1, fixing the broken alpha.0 release.

### Changes Required

#### 1. Create New Changeset

**File**: `.changeset/fix-workspace-protocol-publish.md`

```markdown
---
"polychromos": patch
"@polychromos/types": patch
---

fix: resolve workspace:* protocol during npm publish

Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:*` protocol. This caused the published `polychromos` package to contain `"@polychromos/types": "workspace:*"` which npm cannot resolve.

This release:
- Fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies
- `@polychromos/types` dependency is now correctly published as `"@polychromos/types": "0.1.0-alpha.1"`

Installation should now work:
```
npm install polychromos@alpha
```
```

### Success Criteria

#### Automated Verification:
- [x] Changeset file exists: `test -f .changeset/fix-workspace-protocol-publish.md`
- [x] Changeset status shows pending: `pnpm changeset status`

---

## Phase 4: Update Package Versions to alpha.1

### Overview

Manually update package versions to `0.1.0-alpha.1`, fixing the broken alpha.0 release.

### Changes Required

#### 1. Update polychromos package.json

**File**: `packages/polychromos/package.json`

**Change**: Update version from `0.1.0-alpha.0` to `0.1.0-alpha.1`

```json
{
  "version": "0.1.0-alpha.1"
}
```

#### 2. Update polychromos-types package.json

**File**: `packages/polychromos-types/package.json`

**Change**: Update version from `0.1.0-alpha.0` to `0.1.0-alpha.1`

```json
{
  "version": "0.1.0-alpha.1"
}
```

### Success Criteria

#### Automated Verification:
- [x] polychromos version is correct: `node -p "require('./packages/polychromos/package.json').version === '0.1.0-alpha.1'"`
- [x] types version is correct: `node -p "require('./packages/polychromos-types/package.json').version === '0.1.0-alpha.1'"`

---

## Phase 5: Update CHANGELOGs

### Overview

Update both package CHANGELOGs to document the alpha.1 fix release.

### Changes Required

#### 1. Update polychromos CHANGELOG

**File**: `packages/polychromos/CHANGELOG.md`

**Content**: Prepend new version entry

```markdown
# polychromos

## 0.1.0-alpha.1

### Patch Changes

- fix: resolve workspace:\* protocol during npm publish

  Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:\*` protocol. This caused the published package to contain an unresolvable dependency.

  This release fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies.

- Updated dependencies:
  - @polychromos/types@0.1.0-alpha.1

## 0.1.0-alpha.0

### Patch Changes

- Initial alpha release of Polychromos design system

- Updated dependencies []:
  - @polychromos/types@0.1.0-alpha.0
```

#### 2. Update polychromos-types CHANGELOG

**File**: `packages/polychromos-types/CHANGELOG.md`

**Content**: Prepend new version entry

```markdown
# @polychromos/types

## 0.1.0-alpha.1

### Patch Changes

- fix: resolve workspace:\* protocol during npm publish

  Accompanies the polychromos CLI fix for proper workspace dependency resolution during publish.

## 0.1.0-alpha.0

### Patch Changes

- Initial alpha release of Polychromos design system
```

### Success Criteria

#### Automated Verification:
- [x] polychromos CHANGELOG contains alpha.1: `grep -q "## 0.1.0-alpha.1" packages/polychromos/CHANGELOG.md`
- [x] types CHANGELOG contains alpha.1: `grep -q "## 0.1.0-alpha.1" packages/polychromos-types/CHANGELOG.md`

---

## Phase 6: Commit and Push

### Overview

Create a commit that matches the pattern the release workflow expects ("version packages") to trigger the release.

### Changes Required

#### 1. Stage and Commit All Changes

```bash
git add -A
git commit -m "chore: version packages

Bump to 0.1.0-alpha.1 with fix for workspace:* protocol resolution.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Note**: The commit message must contain "version packages" (case-insensitive) to trigger the release workflow.

#### 2. Push to Main

```bash
git push origin main
```

### Success Criteria

#### Automated Verification:
- [x] Commit exists with correct message: `git log -1 --pretty=%B | grep -i "version packages"`
- [x] No uncommitted changes: `git status --porcelain | wc -l` returns 0

#### Manual Verification:
- [x] GitHub Actions shows release workflow triggered
- [x] Release workflow completes successfully
- [x] npm shows new versions: `npm view polychromos@0.1.0-alpha.1`
- [x] Installation works: `npm install polychromos@alpha && polychromos --version`

---

## Testing Strategy

### Pre-Push Verification

1. **Local pnpm pack test**:
   ```bash
   cd packages/polychromos
   pnpm pack
   tar -xzf polychromos-0.1.0-alpha.1.tgz
   cat package/package.json | grep "@polychromos/types"
   # Should show: "@polychromos/types": "0.1.0-alpha.1" (NOT workspace:*)
   rm -rf package polychromos-0.1.0-alpha.1.tgz
   ```

2. **Verify workflow syntax**:
   ```bash
   cat .github/workflows/release.yml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)" && echo "Valid YAML"
   ```

### Post-Release Verification

1. **npm registry check**:
   ```bash
   npm view polychromos@0.1.0-alpha.1 version
   npm view @polychromos/types@0.1.0-alpha.1 version
   ```

2. **Installation test**:
   ```bash
   npm install -g polychromos@alpha
   polychromos --version
   ```

3. **Provenance check**:
   ```bash
   npm audit signatures polychromos
   ```

## References

- Research document: `thoughts/shared/research/2026-02-03-npm-publish-workspace-protocol-failure.md`
- pnpm publish documentation: https://pnpm.io/cli/publish
- pnpm workspace protocol: https://pnpm.io/workspaces
- npm provenance: https://docs.npmjs.com/generating-provenance-statements/
- Release workflow: `.github/workflows/release.yml`
- Changesets config: `.changeset/config.json`
