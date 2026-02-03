---
date: 2026-02-02T22:51:14Z
researcher: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "End-to-end CI/CD pipeline for npm publish in @lightfastai/dual"
tags: [research, codebase, ci-cd, npm-publish, goreleaser, changesets, github-actions]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: End-to-end CI/CD Pipeline for npm Publish in @lightfastai/dual

**Date**: 2026-02-02T22:51:14Z
**Researcher**: Claude
**Git Commit**: cedfb4bbf2f1a7801785b0d985611f71b95f4049
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x (researching external repo: lightfastai/dual)

## Research Question

Investigate the end-to-end CI/CD pipeline being used for npm publish in the @lightfastai/dual repository.

## Summary

The `@lightfastai/dual` repository implements a fully automated multi-channel release pipeline that publishes to three distribution channels:
1. **GitHub Releases** - Go binaries for darwin/linux (amd64/arm64)
2. **Homebrew Tap** - Formula in `lightfastai/homebrew-tap`
3. **npm Registry** - Node.js wrapper package `@lightfastai/dual`

The pipeline uses **Changesets** for version management, **GoReleaser** for binary builds, and **GitHub Actions** for orchestration. The npm package is a wrapper that downloads the native Go binary during `postinstall`.

## Detailed Findings

### Pipeline Architecture Overview

```
Developer creates PR with changeset
         ↓
Merge to main
         ↓
changesets.yml workflow creates "Version Packages" PR
         ↓
Maintainer merges "Version Packages" PR
         ↓
release.yml workflow detects npm/package.json change
         ↓
┌────────────────────────────────────────────────────────┐
│  Job 1: check-release                                  │
│  - Validates commit message contains "version packages"│
│  - Extracts version from npm/package.json              │
│  - Checks tag doesn't already exist                    │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│  Job 2: create-tag                                     │
│  - Creates annotated git tag (v1.2.3)                  │
│  - Pushes tag to origin                                │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│  Job 3: goreleaser (parallel with npm-publish)         │
│  - Builds Go binaries for darwin/linux × amd64/arm64   │
│  - Creates GitHub Release with checksums               │
│  - Updates Homebrew tap formula                        │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│  Job 4: npm-publish                                    │
│  - Publishes @lightfastai/dual to npm with provenance  │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│  Job 5: verify-release                                 │
│  - Waits 60s for npm propagation                       │
│  - Verifies GitHub Release exists                      │
│  - Verifies npm package is published                   │
│  - Tests binary download and execution                 │
│  - Checks Homebrew formula was updated                 │
└────────────────────────────────────────────────────────┘
```

### Workflow 1: Changesets (`changesets.yml`)

**Location**: `.github/workflows/changesets.yml`

**Trigger**:
- Push to `main` branch
- Path changes: `.changeset/**`, `npm/package.json`, `.github/workflows/changesets.yml`

**Purpose**: Automatically creates/updates a "Version Packages" PR when changesets are merged to main.

**Key Configuration**:
```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  version:
    steps:
      - uses: changesets/action@v1
        with:
          version: npm run version
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN }}
```

### Workflow 2: Release (`release.yml`)

**Location**: `.github/workflows/release.yml`

**Trigger**:
- Push to `main` branch with path changes to `npm/package.json` or `.changeset/**`
- Manual workflow dispatch

**Concurrency**: `release-${{ github.workflow }}` with `cancel-in-progress: false`

**Permissions**:
```yaml
permissions:
  contents: write
  packages: write
  id-token: write  # Required for npm provenance
```

**Jobs**:

#### Job 1: check-release
Determines if a release should proceed:
1. Reads version from `npm/package.json`
2. Validates commit message contains "version packages" (from Changesets)
3. Checks if tag already exists on remote

Outputs: `should_release`, `version`, `tag`

#### Job 2: create-tag
Creates and pushes the git tag:
```bash
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"
```

#### Job 3: goreleaser
Builds and releases Go binaries:
- Uses `goreleaser/goreleaser-action@v6`
- Go version: 1.23
- Publishes to GitHub Releases and updates Homebrew tap
- Uses `LIGHTFAST_RELEASE_BOT_HOMEBREW_TAP_TOKEN` for tap push access

#### Job 4: npm-publish
Publishes to npm:
```yaml
- name: Publish to npm
  working-directory: ./npm
  run: npm publish --access public --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.LIGHTFAST_RELEASE_BOT_NPM_TOKEN }}
```

Key features:
- Uses Node.js 20
- Publishes with `--provenance` for supply chain security
- Registry URL: `https://registry.npmjs.org`

#### Job 5: verify-release
Verification steps:
1. Wait 60 seconds for npm propagation
2. Verify GitHub Release: `gh release view $TAG`
3. Verify npm package: `npm view "@lightfastai/dual@$VERSION"`
4. Test binary download and execution
5. Verify Homebrew formula update

### GoReleaser Configuration (`.goreleaser.yml`)

**Version**: 2

**Before Hooks**:
```yaml
before:
  hooks:
    - go mod tidy
    - go test ./...
```

**Build Configuration**:
```yaml
builds:
  - id: dual
    main: ./cmd/dual
    binary: dual
    env:
      - CGO_ENABLED=0
    goos:
      - darwin
      - linux
    goarch:
      - amd64
      - arm64
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
      - -X main.commit={{.Commit}}
      - -X main.date={{.Date}}
```

**Archives**:
- Format: tar.gz (zip for Windows)
- Includes: README.md, LICENSE*, CLAUDE.md
- Naming: `dual_Darwin_x86_64.tar.gz`, etc.

**Homebrew Tap**:
```yaml
brews:
  - name: dual
    repository:
      owner: lightfastai
      name: homebrew-tap
      token: "{{ .Env.GITHUB_TOKEN }}"
    directory: Formula
    homepage: "https://github.com/lightfastai/dual"
    description: "CLI tool that manages port assignments across different development contexts"
    license: "MIT"
```

**Changelog Generation**:
Groups by conventional commit type (feat, fix, perf, refactor)

### npm Package Structure

**Location**: `npm/` directory

**package.json**:
```json
{
  "name": "@lightfastai/dual",
  "version": "1.2.2",
  "bin": {
    "dual": "./bin/dual.js"
  },
  "scripts": {
    "postinstall": "node postinstall.js"
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "os": ["darwin", "linux", "win32"],
  "cpu": ["x64", "arm64"],
  "dependencies": {
    "tar": "^6.2.0"
  }
}
```

**postinstall.js** (Key Flow):
1. Detects platform and architecture
2. Skips download in CI environments (unless `DUAL_FORCE_INSTALL=true`)
3. Constructs download URL: `https://github.com/lightfastai/dual/releases/download/v{VERSION}/dual_{Platform}_{Arch}.tar.gz`
4. Downloads and extracts the binary to `bin/dual`
5. Makes the binary executable (chmod 755)

**bin/dual.js**:
- Node.js wrapper that spawns the native binary
- Forwards all arguments and environment variables
- Preserves exit codes and handles signals (SIGINT, SIGTERM, SIGQUIT)

### Changesets Configuration

**Location**: `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

**Root package.json scripts**:
```json
{
  "scripts": {
    "changeset": "changeset",
    "changeset:add": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
  },
  "workspaces": ["npm"]
}
```

### Required GitHub Secrets

| Secret Name | Purpose |
|------------|---------|
| `LIGHTFAST_RELEASE_BOT_GITHUB_TOKEN` | Creating "Version Packages" PRs |
| `LIGHTFAST_RELEASE_BOT_HOMEBREW_TAP_TOKEN` | Pushing to homebrew-tap repository |
| `LIGHTFAST_RELEASE_BOT_NPM_TOKEN` | Publishing to npm registry |

### Alternative Release Method

**Manual Release Script**: `scripts/prepare-release.sh`

For emergency/hotfix releases that bypass Changesets:
```bash
./scripts/prepare-release.sh --dry-run 1.2.3
./scripts/prepare-release.sh 1.2.3
git push origin main
git push origin v1.2.3
```

Performs:
1. Pre-flight checks (clean git, tag doesn't exist, npm version not published)
2. Updates `npm/package.json` version
3. Creates commit and annotated tag
4. Outputs push instructions

### Test Workflow (`test.yml`)

Runs on push/PR to main:
- **Unit Tests**: `go test ./internal/...` with race detection and coverage
- **Integration Tests**: `go test ./test/integration/...`
- **Lint**: golangci-lint
- **Build**: Compile binary and verify execution

## Code References

- `.github/workflows/release.yml` - Main release workflow
- `.github/workflows/changesets.yml` - Changesets version PR workflow
- `.github/workflows/test.yml` - Test and lint workflow
- `.goreleaser.yml` - GoReleaser configuration
- `.changeset/config.json` - Changesets configuration
- `npm/package.json` - npm package definition
- `npm/postinstall.js` - Binary download script
- `npm/bin/dual.js` - Node.js binary wrapper
- `scripts/prepare-release.sh` - Manual release script
- `RELEASE.md` - Comprehensive release documentation

## Architecture Documentation

### Release Flow Pattern

1. **Version Management**: Changesets handles version bumping and changelog generation automatically
2. **Path-Based Triggering**: Release workflow triggers on `npm/package.json` changes, not tag pushes
3. **Tag Creation in Workflow**: Tags are created within the workflow after version detection
4. **Supply Chain Security**: npm publish uses `--provenance` for cryptographic attestation
5. **Multi-Channel Verification**: Automated verification of all three distribution channels

### npm Package Pattern

The npm package follows the pattern used by esbuild, @swc/core, and biome:
- Publish a small wrapper package that downloads the native binary
- Use `postinstall` script for platform-specific binary download
- Skip download in CI to avoid failures during version bumping

## Historical Context (from thoughts/)

No prior research documents found for this external repository.

## Related Research

N/A - This is an external repository analysis.

## Open Questions

None - the pipeline is well-documented in the repository's `RELEASE.md`.
