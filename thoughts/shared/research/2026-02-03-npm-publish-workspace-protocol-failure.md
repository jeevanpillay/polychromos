---
date: 2026-02-03T17:45:00+08:00
researcher: Claude
git_commit: 59c75cf47992bb871e20479d20d3b10a5fb14023
branch: main
repository: polychromos
topic: "npm publish failure due to workspace: protocol in published package"
tags: [research, codebase, npm, publishing, workspace-protocol, pnpm, changesets]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: npm Publish Failure Due to workspace: Protocol in Published Package

**Date**: 2026-02-03T17:45:00+08:00
**Researcher**: Claude
**Git Commit**: 59c75cf47992bb871e20479d20d3b10a5fb14023
**Branch**: main
**Repository**: polychromos

## Research Question

The polychromos CLI was published to npm, but installation fails with:
```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

What is the current publishing setup and why did this failure occur?

## Summary

The `polychromos` CLI package at `packages/polychromos/` has a dependency on `@polychromos/types` using pnpm's `workspace:*` protocol. When the package was published to npm using `npm publish`, this workspace reference was **not resolved** to a real version number, causing end users to receive a package.json with an invalid dependency specification.

**Root cause**: The publish workflow uses `npm publish` directly instead of `pnpm publish` or Changesets' publish command. The `workspace:*` protocol is a pnpm-specific feature that needs to be resolved during publish time, which `npm publish` does not handle.

## Detailed Findings

### Current Package Dependencies

#### polychromos CLI (`packages/polychromos/package.json:51-59`)

```json
{
  "dependencies": {
    "@polychromos/types": "workspace:*",
    "chokidar": "^3.6.0",
    "commander": "^12.1.0",
    "convex": "^1.31.7",
    "open": "^11.0.0",
    "rfc6902": "^5.1.1",
    "zod": "^4.3.6"
  }
}
```

The `@polychromos/types` dependency uses `workspace:*` which tells pnpm to resolve this to the local workspace package during development.

#### polychromos-types (`packages/polychromos-types/package.json:1-5`)

```json
{
  "name": "@polychromos/types",
  "version": "0.1.0-alpha.0",
  "description": "TypeScript types and schemas for Polychromos design system",
  "type": "module"
}
```

This package is also configured for publishing with the same version as the CLI.

### Current Release Workflow

#### Release Workflow (`.github/workflows/release.yml:80-92`)

```yaml
# TODO: Remove --tag alpha when ready for stable release
# Alpha releases are installed with: npm install polychromos@alpha
# Stable releases (default): npm install polychromos
- name: Publish @polychromos/types to npm
  working-directory: ./packages/polychromos-types
  run: npm publish --access public --provenance --tag alpha || echo "Package already published or publish failed"
  continue-on-error: true
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

- name: Publish polychromos to npm
  working-directory: ./packages/polychromos
  run: npm publish --access public --provenance --tag alpha || echo "Package already published or publish failed"
  continue-on-error: true
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The workflow uses `npm publish` directly in the package directories. This approach:
1. Does **not** resolve `workspace:*` references
2. Publishes the package.json as-is with the workspace protocol intact

### Changesets Configuration

#### Fixed Versioning (`.changeset/config.json:8`)

```json
{
  "fixed": [["polychromos", "@polychromos/types"]]
}
```

The Changesets config groups both packages for fixed versioning, meaning they always share the same version number.

### The workspace: Protocol

The `workspace:*` protocol is a pnpm-specific feature:

1. **During development**: pnpm resolves `workspace:*` to a symlink to the local package
2. **During pnpm publish**: pnpm automatically replaces `workspace:*` with the actual version
3. **During npm publish**: npm does **not** understand this protocol and publishes it verbatim

### What Gets Published

When `npm publish` runs in `packages/polychromos/`:
- The `package.json` is included as-is
- The `workspace:*` dependency remains unresolved
- End users see: `"@polychromos/types": "workspace:*"` in their node_modules

### The Failed Installation

From the GitHub Actions log:
```
Run npm install -g polychromos@alpha
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

npm cannot resolve the `workspace:*` protocol and fails.

## Code References

- `packages/polychromos/package.json:52` - `@polychromos/types` dependency with `workspace:*`
- `packages/polychromos-types/package.json:1-5` - Types package configuration
- `.github/workflows/release.yml:80-92` - npm publish steps using `npm publish`
- `.changeset/config.json:8` - Fixed versioning configuration

## Architecture Documentation

### Current Publishing Flow

```
Changeset merged to main
         ↓
Changesets Action creates "Version Packages" PR
         ↓
Version PR merged
         ↓
Release workflow triggers (release.yml)
         ↓
pnpm install (installs dependencies)
         ↓
pnpm build (builds packages)
         ↓
npm publish (in packages/polychromos-types) ← Publishes with workspace:* unresolved
         ↓
npm publish (in packages/polychromos) ← Publishes with workspace:* unresolved
         ↓
Verification step tries: npm install -g polychromos@alpha
         ↓
FAILS: "Unsupported URL Type workspace:"
```

### Root Cause

The issue is using `npm publish` instead of `pnpm publish`. Only pnpm understands and resolves the `workspace:*` protocol.

## Historical Context (from thoughts/)

### Related Research Documents

- `thoughts/shared/research/2026-02-03-polychromos-cli-publishing-prerequisites.md` - Original research on publishing prerequisites
- `thoughts/shared/plans/2026-02-03-polychromos-cli-npm-publish-pipeline.md` - Implementation plan for the publishing pipeline

### Key Historical Notes

The original plan document notes:
> Types package uses `workspace:*` dependency - stays internal, not published

However, the implementation evolved to publish both packages. The `workspace:*` protocol needs to be handled during publish.

## Resolution Options

### Option A: Use pnpm publish

Replace `npm publish` with `pnpm publish` in the release workflow:

```yaml
- name: Publish polychromos to npm
  working-directory: ./packages/polychromos
  run: pnpm publish --access public --tag alpha --no-git-checks
```

pnpm will automatically resolve `workspace:*` to the actual version (`0.1.0-alpha.0`).

### Option B: Use Changesets publish

Replace manual publish with `pnpm changeset:publish`:

```yaml
- name: Publish packages
  run: pnpm changeset:publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Changesets handles workspace protocol resolution and publishing order.

### Option C: Replace workspace:* with explicit version

Change the dependency in `packages/polychromos/package.json`:

```json
{
  "dependencies": {
    "@polychromos/types": "0.1.0-alpha.0"
  }
}
```

This requires manual version sync or a pre-publish script.

### Option D: Bundle types into CLI package

Remove the `@polychromos/types` dependency entirely by inlining the types. This eliminates the workspace dependency but increases maintenance burden.

## Open Questions

1. **Which resolution to use?** Options A (pnpm publish) or B (Changesets publish) are the most aligned with the current tooling.

2. **Provenance support**: Does `pnpm publish` support `--provenance`? If not, how to maintain supply chain security?

3. **Publishing order**: When both packages need updates, `@polychromos/types` must be published before `polychromos`. Does the chosen solution handle this?

4. **Alpha tag handling**: How do pnpm/Changesets handle the `--tag alpha` for pre-release versions?
