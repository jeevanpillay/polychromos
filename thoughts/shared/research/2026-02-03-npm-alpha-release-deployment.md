---
date: 2026-02-03T12:00:00+08:00
researcher: Claude
git_commit: 8217678809fb5a2d1006354519ef2e305027543e
branch: main
repository: polychromos
topic: "Deploying Alpha Versions of Polychromos to npm"
tags: [research, npm, alpha-release, changesets, ci-cd, publishing]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
last_updated_note: "Added confirmation of release scope and alpha workflow status"
---

# Research: Deploying Alpha Versions of Polychromos to npm

**Date**: 2026-02-03T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 8217678809fb5a2d1006354519ef2e305027543e
**Branch**: main
**Repository**: polychromos

## Release Scope Confirmation (Follow-up 2026-02-03)

### Q1: Does the release only publish `polychromos` (not `@polychromos/types`)?

**YES, CONFIRMED** - Only `polychromos` is published to npm.

Evidence from `.github/workflows/release.yml:79-82`:
```yaml
- name: Publish to npm
  working-directory: ./packages/polychromos
  run: npm publish --access public --provenance --tag alpha
```

The `@polychromos/types` package:
- Has NO `files` field (required for npm publishing)
- Has NO `repository`, `bugs`, or `homepage` metadata
- Is consumed as `"@polychromos/types": "workspace:*"` by the CLI
- Gets resolved/bundled at publish time, not published separately

### Q2: Is the alpha release workflow fully set up for 0.1.0-alpha.0?

**WORKFLOW IS READY, BUT VERSION NEEDS ATTENTION**

Current state:
| Aspect | Status | Value |
|--------|--------|-------|
| Current version | `packages/polychromos/package.json` | `0.1.0` (not `0.1.0-alpha.0`) |
| npm dist-tag | `.github/workflows/release.yml:81` | `--tag alpha` |
| Verification | `.github/workflows/release.yml:104` | `polychromos@alpha` |
| Provenance | `.github/workflows/release.yml:81` | `--provenance` enabled |

The workflow publishes to the `alpha` dist-tag, so:
- `npm install polychromos@alpha` will get this version
- `npm install polychromos` (latest) remains unaffected

**Note**: The version is `0.1.0`, not `0.1.0-alpha.0`. If you want explicit alpha versions in package.json, you would need to use changesets prerelease mode (`pnpm changeset pre enter alpha`). With the current setup, `0.1.0` will be published under the `alpha` tag.

---

## Research Question

How to deploy an alpha version of polychromos to npm, including:
- Required environment variables and secrets
- How to create alpha versions with datetime prefixes
- CI/CD workflow configuration

## Summary

The polychromos repository has an existing changeset and CI/CD infrastructure that can be extended for alpha releases. There are two main approaches:

1. **Snapshot Releases** (Recommended for datetime-prefixed versions): Use `changeset version --snapshot alpha` to create versions like `0.0.0-alpha-20260203123456`
2. **Prerelease Mode**: Use `changeset pre enter alpha` for formal semver alpha versions like `1.0.0-alpha.0`

## Current Infrastructure Analysis

### Existing Workflows

#### `.github/workflows/changesets.yml`
- Triggers on push to `main` when `.changeset/**` or package.json files change
- Creates "Version Packages" PRs automatically
- Uses `GITHUB_TOKEN` for PR creation

#### `.github/workflows/release.yml`
- Triggers on push to `main` when `packages/polychromos/package.json` changes
- Checks if commit message contains "version packages"
- Publishes to npm with provenance
- **Required secret**: `NPM_TOKEN`

### Changeset Configuration (`.changeset/config.json`)

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "jeevanpillay/polychromos" }
  ],
  "commit": false,
  "fixed": [["polychromos", "@polychromos/types"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@polychromos/app",
    "@polychromos/www",
    "@polychromos/ui"
  ]
}
```

Key observations:
- `polychromos` and `@polychromos/types` are **fixed** together (same version)
- Only these two packages are published (others are ignored)
- Access is **public**

### Package Versions

Both packages are currently at version `1.0.0`:
- `packages/polychromos/package.json`: `"version": "1.0.0"`
- `packages/polychromos-types/package.json`: `"version": "1.0.0"`

## Detailed Findings

### Option 1: Snapshot Releases (Datetime-Prefixed)

Snapshot releases create temporary versions with timestamps, ideal for testing.

#### Configuration

Add `prereleaseTemplate` to `.changeset/config.json`:

```json
{
  "prereleaseTemplate": "{tag}-{datetime}"
}
```

Available placeholders:
- `{tag}` - The snapshot tag name (e.g., `alpha`)
- `{commit}` - Git commit hash
- `{timestamp}` - Unix timestamp
- `{datetime}` - 14-character datetime (e.g., `20260203123456`)

#### Commands

```bash
# Create a changeset (optional, can publish without pending changesets)
pnpm changeset

# Version with snapshot - creates versions like 0.0.0-alpha-20260203123456
pnpm changeset version --snapshot alpha

# Publish with alpha tag (CRITICAL: must use --tag to avoid setting as 'latest')
pnpm changeset publish --tag alpha
```

#### GitHub Actions Workflow for Alpha Releases

Create `.github/workflows/alpha-release.yml`:

```yaml
name: Alpha Release

on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual triggers

concurrency:
  group: alpha-release
  cancel-in-progress: false

permissions:
  contents: write
  id-token: write

jobs:
  alpha-release:
    name: Publish Alpha to npm
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

      - name: Create snapshot versions
        run: |
          # Create empty changeset if none exist
          if [ ! -f .changeset/*.md ] || [ "$(ls -A .changeset/*.md 2>/dev/null | head -1)" == "" ]; then
            echo "---" > .changeset/snapshot.md
            echo "\"polychromos\": patch" >> .changeset/snapshot.md
            echo "\"@polychromos/types\": patch" >> .changeset/snapshot.md
            echo "---" >> .changeset/snapshot.md
            echo "" >> .changeset/snapshot.md
            echo "Alpha snapshot release" >> .changeset/snapshot.md
          fi
          pnpm changeset version --snapshot alpha

      - name: Publish alpha to npm
        run: pnpm changeset publish --tag alpha
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Option 2: Formal Prerelease Mode

For formal alpha/beta release cycles with semver versioning.

#### Entering Prerelease Mode

```bash
# Enter alpha prerelease mode (creates pre.json)
pnpm changeset pre enter alpha

# Create changesets as normal
pnpm changeset

# Version packages (increments to 1.0.0-alpha.0, 1.0.0-alpha.1, etc.)
pnpm changeset version

# Publish with alpha tag
pnpm changeset publish
```

#### Exiting Prerelease Mode

```bash
# Exit prerelease mode
pnpm changeset pre exit

# Version to stable
pnpm changeset version

# Publish to latest
pnpm changeset publish
```

### Required Environment Variables & Secrets

#### GitHub Repository Secrets (Settings > Secrets and variables > Actions)

| Secret Name | Description | Already Configured? |
|-------------|-------------|---------------------|
| `NPM_TOKEN` | npm access token with publish permission | Yes (used in release.yml) |
| `GITHUB_TOKEN` | Built-in GitHub token | Yes (automatic) |

#### npm Token Setup (if not configured)

1. Go to npmjs.com > Profile > Access Tokens
2. Generate new "Granular Access Token"
3. Permissions: "Read and write" for packages `polychromos` and `@polychromos/types`
4. Add to GitHub Secrets as `NPM_TOKEN`

### npm Dist Tags

| Tag | Purpose | Version Format |
|-----|---------|----------------|
| `latest` | Stable releases (default `npm install`) | `1.0.0` |
| `alpha` | Alpha/snapshot releases | `0.0.0-alpha-20260203123456` or `1.0.0-alpha.0` |
| `beta` | Beta releases | `1.0.0-beta.0` |
| `next` | Pre-release of next major version | `2.0.0-next.0` |

Install specific version: `npm install polychromos@alpha`

### Provenance Support

The existing release.yml already uses `--provenance` for npm publish. This requires:
- `id-token: write` permission in workflow
- Node.js setup with `registry-url`
- npm CLI 11.5.1+ (Node.js 24.x+)

## Code References

- `.changeset/config.json` - Changeset configuration
- `.github/workflows/changesets.yml` - Version PR automation
- `.github/workflows/release.yml:76-80` - npm publish with provenance
- `packages/polychromos/package.json` - CLI package configuration
- `packages/polychromos-types/package.json` - Types package configuration

## Recommended Implementation

For datetime-prefixed alpha releases, the recommended approach:

1. **Add prereleaseTemplate to changeset config**:
   ```json
   {
     "prereleaseTemplate": "{tag}-{datetime}"
   }
   ```

2. **Create alpha release workflow** (`.github/workflows/alpha-release.yml`) with:
   - `workflow_dispatch` for manual triggers
   - Optional: trigger on specific branches or conditions
   - Use `changeset version --snapshot alpha`
   - Publish with `--tag alpha`

3. **Manual alpha release command**:
   ```bash
   pnpm changeset version --snapshot alpha
   pnpm changeset publish --tag alpha
   ```

## Comparison: Snapshot vs Prerelease Mode

| Feature | Snapshot Releases | Prerelease Mode |
|---------|------------------|-----------------|
| Version format | `0.0.0-alpha-{datetime}` | `1.0.0-alpha.0` |
| Use case | Continuous testing | Formal alpha cycle |
| State tracking | None | `pre.json` file |
| Commits to main | Should not commit | Part of release history |
| Exit process | N/A (one-off) | `pre exit` + `version` |
| Version progression | New timestamp each time | Incremental |

## Historical Context

Related research documents:
- `thoughts/shared/research/2026-02-03-polychromos-cli-publishing-prerequisites.md` - CLI publishing setup
- `thoughts/shared/research/2026-02-03-lightfastai-dual-npm-cicd-pipeline.md` - CI/CD pipeline patterns

## Open Questions

1. Should alpha releases trigger on every push to main or only via manual workflow dispatch?
2. Should the `@polychromos/types` package also be published as alpha, or keep them in sync?
3. What cleanup strategy for old alpha versions on npm?

## External Resources

- [Changesets Snapshot Releases Documentation](https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md)
- [Changesets Prerelease Documentation](https://github.com/changesets/changesets/blob/main/docs/prereleases.md)
- [npm Dist Tag Documentation](https://docs.npmjs.com/cli/v10/commands/npm-dist-tag/)
- [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)
