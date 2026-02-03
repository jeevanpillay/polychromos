# Polychromos CLI npm Publish Pipeline Implementation Plan

## Overview

Implement an automated CI/CD pipeline for publishing the `polychromos` CLI to npm using Changesets for version management and GitHub Actions for orchestration. This follows the pattern established in `@lightfastai/dual` but simplified for a pure TypeScript CLI (no binary builds needed).

## Current State Analysis

- **CLI Package**: `@polychromos/cli` v1.0.0 at `packages/polychromos/`
- **Types Package**: `@polychromos/types` v1.0.0 at `packages/polychromos-types/` (internal workspace dependency)
- **Build System**: TypeScript compiled to `dist/`, binary entry at `./dist/index.js`
- **Existing CI**: Three workflows for testing (test.yml, e2e.yml, e2e-cli.yml)
- **No release automation**: No changesets, no npm publish workflow

### Key Discoveries:
- Package name `polychromos` is available on npm
- Types package uses `workspace:*` dependency - stays internal, not published
- Monorepo uses pnpm 10.5.2 with Turborepo

## Desired End State

After this plan is complete:
1. Developers can run `pnpm changeset` to create version change entries
2. Merging changesets to `main` auto-creates a "Version Packages" PR
3. Merging the "Version Packages" PR triggers npm publish with provenance
4. Both `polychromos` and `@polychromos/types` versions stay in lock-step
5. Users can install via `npm install -g polychromos`

### Verification:
- `pnpm changeset` works and creates `.changeset/*.md` files
- Version PRs are automatically created when changesets merge
- npm package is published with correct metadata and provenance

## What We're NOT Doing

- Manual release script (not needed)
- Publishing `@polychromos/types` to npm (stays internal)
- GoReleaser or binary builds (pure TypeScript CLI)
- Homebrew tap (npm is the only distribution channel)
- GitHub Releases with assets (optional future enhancement)

## Implementation Approach

Adapt the `@lightfastai/dual` pipeline pattern:
1. Use Changesets for version management with `fixed` versioning to keep packages in sync
2. Two GitHub Actions workflows: `changesets.yml` for version PRs, `release.yml` for publishing
3. Publish with `--provenance` for supply chain security

---

## Phase 1: Package Rename & Configuration

### Overview
Rename the CLI package from `@polychromos/cli` to `polychromos` and add required npm metadata.

### Changes Required:

#### 1. Update CLI package.json
**File**: `packages/polychromos/package.json`
**Changes**: Rename package, add npm metadata

```json
{
  "name": "polychromos",
  "version": "1.0.0",
  "description": "CLI tool for Polychromos design system",
  "type": "module",
  "bin": {
    "polychromos": "./dist/index.js"
  },
  "exports": {
    ".": "./dist/index.js",
    "./lib": "./dist/lib/index.js"
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "polychromos",
    "design",
    "cli",
    "design-system"
  ],
  "author": "Jeevan Pillay Studios",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jeevanpillaystudios/x.git",
    "directory": "packages/polychromos"
  },
  "bugs": {
    "url": "https://github.com/jeevanpillaystudios/x/issues"
  },
  "homepage": "https://github.com/jeevanpillaystudios/x/tree/main/packages/polychromos#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "format": "prettier --check .",
    "lint": "eslint .",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:e2e:watch": "vitest --config vitest.e2e.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@polychromos/types": "workspace:*",
    "chokidar": "^3.6.0",
    "commander": "^12.1.0",
    "convex": "^1.31.7",
    "open": "^11.0.0",
    "rfc6902": "^5.1.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@polychromos/eslint-config": "workspace:*",
    "@polychromos/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "catalog:",
    "memfs": "^4.17.0",
    "playwright": "^1.50.0",
    "typescript": "catalog:",
    "vitest": "^3.0.0"
  },
  "prettier": "@polychromos/prettier-config"
}
```

#### 2. Update types package reference in tests/imports
**Action**: Search and replace `@polychromos/cli` with `polychromos` in any test files or documentation that reference the package name.

Run: `grep -r "@polychromos/cli" packages/`

#### 3. Update root package.json turbo filter
**File**: `package.json`
**Changes**: Update any filters that reference `@polychromos/cli` to use `polychromos`

Check current filters and update if needed (currently uses `@polychromos/polychromos-app` which is different).

### Success Criteria:

#### Automated Verification:
- [ ] Package builds successfully: `pnpm --filter polychromos build`
- [ ] All tests pass: `pnpm --filter polychromos test`
- [ ] Type checking passes: `pnpm --filter polychromos typecheck`
- [ ] Linting passes: `pnpm --filter polychromos lint`

#### Manual Verification:
- [ ] Verify `pnpm pack` in packages/polychromos creates a valid tarball
- [ ] Verify the tarball contains expected files (dist/, package.json)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Changesets Configuration

### Overview
Install and configure Changesets for the monorepo with fixed versioning to keep CLI and types packages in sync.

### Changes Required:

#### 1. Install Changesets
**Command**:
```bash
pnpm add -Dw @changesets/cli @changesets/changelog-github
```

#### 2. Create Changesets config
**File**: `.changeset/config.json`
**Changes**: Create new file

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "jeevanpillaystudios/x" }
  ],
  "commit": false,
  "fixed": [["polychromos", "@polychromos/types"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@polychromos/www",
    "@polychromos/polychromos-app",
    "@polychromos/polychromos-www",
    "@polychromos/ui",
    "@polychromos/eslint-config",
    "@polychromos/prettier-config",
    "@polychromos/typescript-config"
  ]
}
```

**Key configuration:**
- `fixed`: Groups `polychromos` and `@polychromos/types` to always have the same version
- `access`: "public" for unscoped package
- `ignore`: Excludes internal/app packages from changesets

#### 3. Create Changesets README
**File**: `.changeset/README.md`
**Changes**: Create new file

```markdown
# Changesets

This folder contains changesets for the Polychromos CLI.

## Adding a changeset

Run `pnpm changeset` to create a new changeset when you make changes to:
- `packages/polychromos` (the CLI)
- `packages/polychromos-types` (the types package)

## Version bumping

- **patch**: Bug fixes, documentation updates
- **minor**: New features (backwards compatible)
- **major**: Breaking changes

## Release process

1. Create a PR with your changes and a changeset
2. Merge PR to main
3. A "Version Packages" PR will be created automatically
4. Merge the "Version Packages" PR to trigger npm publish
```

#### 4. Add changeset scripts to root package.json
**File**: `package.json`
**Changes**: Add scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "changeset:version": "changeset version",
    "changeset:publish": "changeset publish"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Changesets installed: `pnpm changeset --version` outputs version
- [ ] Config is valid: `pnpm changeset status` runs without errors
- [ ] Can create changeset: `pnpm changeset` (interactive, then cancel)

#### Manual Verification:
- [ ] `.changeset/config.json` exists with correct content
- [ ] `.changeset/README.md` exists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Changesets GitHub Workflow

### Overview
Create the GitHub Actions workflow that automatically creates "Version Packages" PRs when changesets are merged to main.

### Changes Required:

#### 1. Create changesets workflow
**File**: `.github/workflows/changesets.yml`
**Changes**: Create new file

```yaml
name: Changesets

on:
  push:
    branches: [main]
    paths:
      - '.changeset/**'
      - 'packages/polychromos/package.json'
      - 'packages/polychromos-types/package.json'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  version:
    name: Version Packages
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Create Version PR
        uses: changesets/action@v1
        with:
          version: pnpm changeset:version
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Success Criteria:

#### Automated Verification:
- [ ] Workflow file is valid YAML: `yq e '.' .github/workflows/changesets.yml`
- [ ] Workflow file exists at correct path

#### Manual Verification:
- [ ] Test by creating a changeset, pushing to a branch, and verifying the workflow runs (will need to be done after merge to main)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Release Workflow

### Overview
Create the GitHub Actions workflow that publishes to npm when a "Version Packages" PR is merged.

### Changes Required:

#### 1. Create release workflow
**File**: `.github/workflows/release.yml`
**Changes**: Create new file

```yaml
name: Release

on:
  push:
    branches: [main]
    paths:
      - 'packages/polychromos/package.json'

concurrency:
  group: release-${{ github.workflow }}
  cancel-in-progress: false

permissions:
  contents: write
  id-token: write

jobs:
  check-release:
    name: Check Release
    runs-on: ubuntu-latest
    outputs:
      should_release: ${{ steps.check.outputs.should_release }}
      version: ${{ steps.check.outputs.version }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Check if release commit
        id: check
        run: |
          # Get the commit message
          COMMIT_MSG=$(git log -1 --pretty=%B)

          # Check if this is a version packages commit
          if [[ "$COMMIT_MSG" == *"version packages"* ]]; then
            # Extract version from package.json
            VERSION=$(node -p "require('./packages/polychromos/package.json').version")
            echo "should_release=true" >> $GITHUB_OUTPUT
            echo "version=$VERSION" >> $GITHUB_OUTPUT
            echo "Release triggered for version $VERSION"
          else
            echo "should_release=false" >> $GITHUB_OUTPUT
            echo "Not a version packages commit, skipping release"
          fi

  release:
    name: Publish to npm
    needs: check-release
    if: needs.check-release.outputs.should_release == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test:ci

      - name: Publish to npm
        working-directory: ./packages/polychromos
        run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  verify-release:
    name: Verify Release
    needs: [check-release, release]
    if: needs.check-release.outputs.should_release == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Wait for npm propagation
        run: sleep 60

      - name: Verify npm package
        run: |
          VERSION="${{ needs.check-release.outputs.version }}"
          echo "Verifying polychromos@$VERSION on npm..."
          npm view "polychromos@$VERSION" version
          echo "Package published successfully!"

      - name: Test installation
        run: |
          npm install -g polychromos
          polychromos --version
```

### Success Criteria:

#### Automated Verification:
- [ ] Workflow file is valid YAML: `yq e '.' .github/workflows/release.yml`
- [ ] Workflow file exists at correct path

#### Manual Verification:
- [ ] `NPM_TOKEN` secret is configured in GitHub repository settings
- [ ] Test full release flow by creating and merging a changeset

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Documentation & Secrets Setup

### Overview
Document the release process and required secrets.

### Changes Required:

#### 1. Update CLAUDE.md
**File**: `CLAUDE.md`
**Changes**: Add release commands section

Add after the existing commands section:

```markdown
# Release Commands (Polychromos CLI)

```bash
# Create a changeset for version bump
pnpm changeset

# Check changeset status
pnpm changeset status

# (CI only) Version packages
pnpm changeset:version

# (CI only) Publish to npm
pnpm changeset:publish
```

## Release Process

1. Make changes to `packages/polychromos` or `packages/polychromos-types`
2. Run `pnpm changeset` and describe your changes
3. Commit the changeset file with your PR
4. Merge PR to `main`
5. A "Version Packages" PR will be created automatically
6. Merge the "Version Packages" PR to publish to npm
```

#### 2. Create RELEASE.md (in packages/polychromos)
**File**: `packages/polychromos/RELEASE.md`
**Changes**: Create new file

```markdown
# Release Process

## Overview

The `polychromos` CLI is published to npm automatically using Changesets and GitHub Actions.

## Creating a Release

1. **Make your changes** to `packages/polychromos` or `packages/polychromos-types`

2. **Create a changeset**:
   ```bash
   pnpm changeset
   ```
   - Select the packages that changed
   - Choose the version bump type (patch/minor/major)
   - Write a summary of the changes

3. **Commit and push** your changes with the changeset file

4. **Create a PR** and get it reviewed

5. **Merge to main** - this triggers the Changesets workflow

6. **Merge "Version Packages" PR** - a PR will be automatically created
   - Review the version bumps and changelog
   - Merge to trigger the release

7. **Verify the release**:
   ```bash
   npm view polychromos
   npm install -g polychromos
   polychromos --version
   ```

## Required Secrets

The following secrets must be configured in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm access token with publish permissions |

### Creating an npm token

1. Go to https://www.npmjs.com/settings/~/tokens
2. Click "Generate New Token" > "Granular Access Token"
3. Name: `polychromos-github-actions`
4. Expiration: Set appropriate expiration
5. Packages and scopes: Select "Read and write"
6. Select packages: `polychromos`
7. Copy the token and add to GitHub secrets

## Version Strategy

- `polychromos` and `@polychromos/types` are versioned together (fixed)
- Both packages always have the same version number
- Only `polychromos` is published to npm
- `@polychromos/types` remains an internal workspace dependency

## Troubleshooting

### Release didn't trigger
- Check the commit message contains "version packages"
- Verify `packages/polychromos/package.json` was modified
- Check GitHub Actions logs for errors

### npm publish failed
- Verify `NPM_TOKEN` secret is set correctly
- Check token has publish permissions
- Ensure package name `polychromos` is available
```

### Success Criteria:

#### Automated Verification:
- [ ] CLAUDE.md is valid markdown
- [ ] RELEASE.md is valid markdown

#### Manual Verification:
- [ ] `NPM_TOKEN` secret is configured in GitHub repository settings
- [ ] Documentation is clear and accurate

**Implementation Note**: After completing this phase, the implementation is complete. Final verification should include a full end-to-end test of the release process.

---

## Testing Strategy

### Unit Tests:
- Existing tests in `packages/polychromos/src/__tests__/` continue to run
- No new tests needed for CI/CD pipeline

### Integration Tests:
- Existing E2E tests in `packages/polychromos/test/e2e/` continue to run
- Release workflow runs full test suite before publish

### Manual Testing Steps:
1. Create a test changeset with `pnpm changeset`
2. Push to a feature branch and verify changesets workflow triggers on merge
3. Verify "Version Packages" PR is created with correct changes
4. Merge "Version Packages" PR and verify npm publish succeeds
5. Install published package globally and verify it works

## Required GitHub Secrets

| Secret | Purpose | How to Create |
|--------|---------|---------------|
| `NPM_TOKEN` | Publishing to npm registry | npm.com > Settings > Access Tokens > Granular Access Token |

Note: `GITHUB_TOKEN` is automatically provided by GitHub Actions.

## References

- Research document: `thoughts/shared/research/2026-02-03-lightfastai-dual-npm-cicd-pipeline.md`
- Changesets documentation: https://github.com/changesets/changesets
- npm provenance: https://docs.npmjs.com/generating-provenance-statements
