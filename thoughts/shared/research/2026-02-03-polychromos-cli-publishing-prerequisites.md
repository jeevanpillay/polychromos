---
date: 2026-02-03T10:30:00+08:00
researcher: Claude
git_commit: cedfb4bbf2f1a7801785b0d985611f71b95f4049
branch: feat/polychromos-mvp-implementation
repository: x
topic: "End-to-end CLI-related setup prerequisites before publishing @polychromos/cli"
tags: [research, codebase, polychromos, cli, npm-publish, ci-cd, testing]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: End-to-end CLI-related Setup Prerequisites Before Publishing @polychromos/cli

**Date**: 2026-02-03T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: cedfb4bbf2f1a7801785b0d985611f71b95f4049
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

What is the end-to-end CLI-related setup that is a must-have before going to publishing `@packages/polychromos/`?

## Summary

The `@polychromos/cli` package has a solid foundation with:
- **Complete CLI implementation** with 10 commands (auth, project, version control, export)
- **Comprehensive test coverage** (unit tests with memfs, integration tests, E2E tests with real Convex backend)
- **Proper package configuration** (bin, exports, files fields configured)
- **TypeScript build pipeline** (outputs to dist/ with declarations)

**What's missing for publishing:**
1. No automated npm publishing workflow (GitHub Actions)
2. No Changesets configuration for version management
3. No `prepublishOnly` script to ensure build before publish
4. No `.npmignore` (though `files` field suffices)
5. No `publishConfig` for scoped package access
6. Workspace dependency `@polychromos/types` needs publishing strategy

## Detailed Findings

### Current Package Configuration

#### Package Identity (`packages/polychromos/package.json:1-14`)

```json
{
  "name": "@polychromos/cli",
  "version": "1.0.0",
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
  ]
}
```

- **Package name**: `@polychromos/cli` - Scoped to `@polychromos` organization
- **Binary**: Maps `polychromos` command to `./dist/index.js`
- **Exports**: Main entry point and library exports for programmatic use
- **Files**: Only `dist/` directory included in published package

#### Entry Point Configuration (`packages/polychromos/src/index.ts:1`)

```typescript
#!/usr/bin/env node
```

The shebang is correctly placed in the source file, which gets preserved in the compiled output.

### CLI Commands Implemented

The CLI provides 10 commands organized into three categories:

**Authentication Commands:**
| Command | File | Description |
|---------|------|-------------|
| `login` | `src/commands/login.ts` | Authenticate via Clerk session token |
| `logout` | `src/commands/logout.ts` | Clear stored credentials |
| `whoami` | `src/commands/whoami.ts` | Verify authentication status |

**Project Commands:**
| Command | File | Description |
|---------|------|-------------|
| `init <name>` | `src/commands/init.ts` | Create `design.json` workspace |
| `dev` | `src/commands/dev.ts` | Watch and sync to Convex |
| `export <format>` | `src/commands/export.ts` | Export to HTML/Tailwind |

**Version Control Commands:**
| Command | File | Description |
|---------|------|-------------|
| `undo` | `src/commands/undo.ts` | Revert last change via Convex |
| `redo` | `src/commands/redo.ts` | Restore undone change |
| `history` | `src/commands/history.ts` | Show version history |
| `checkpoint <name>` | `src/commands/checkpoint.ts` | Create named checkpoint |

### TypeScript Build Configuration

#### Compiler Settings (`packages/polychromos/tsconfig.json`)

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Key outputs:**
- `.js` files - Compiled JavaScript
- `.d.ts` files - Type declarations for TypeScript consumers
- `.js.map` and `.d.ts.map` - Source maps for debugging

### Test Infrastructure

#### Unit Tests (`vitest.config.ts`)

- **Environment**: Node.js
- **Mocking**: Uses `memfs` for filesystem isolation
- **Setup**: `test/setup.ts` resets virtual filesystem between tests
- **Coverage**: V8 provider with text/json/html reporters

**Test files:**
- `src/__tests__/commands/init.test.ts`
- `src/__tests__/commands/checkpoint.test.ts`
- `src/__tests__/commands/export.test.ts`
- `src/__tests__/commands/login.test.ts`
- `src/__tests__/commands/logout.test.ts`
- `src/__tests__/commands/whoami.test.ts`
- `src/__tests__/commands/history.test.ts`
- `src/__tests__/commands/undo.test.ts`
- `src/__tests__/commands/redo.test.ts`
- `src/lib/__tests__/version-manager.test.ts`
- `src/lib/__tests__/credentials.test.ts`

#### E2E Tests (`vitest.e2e.config.ts`)

- **Global setup**: `test/e2e/setup.ts` - Starts local Convex, extracts Clerk token via Playwright
- **Timeouts**: 60s for tests, 120s for hooks
- **Sequential execution**: Prevents race conditions

**E2E test files:**
- `test/e2e/auth.spec.ts` - Authentication verification
- `test/e2e/dev.spec.ts` - File watching and sync
- `test/e2e/version.spec.ts` - Undo/redo/history

#### Integration Tests

- `test/integration/cli-convex-sync.test.ts` - Config loading, single-flight pattern

### Dependencies

#### Production Dependencies (`package.json:27-35`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@polychromos/types` | `workspace:*` | Shared type definitions |
| `commander` | `^12.1.0` | CLI framework |
| `convex` | `^1.31.7` | Backend integration |
| `chokidar` | `^3.6.0` | File watching |
| `rfc6902` | `^5.1.1` | JSON Patch operations |
| `open` | `^11.0.0` | Open URLs in browser |
| `zod` | `^4.3.6` | Schema validation |

**Critical note**: `@polychromos/types` uses `workspace:*` protocol, which gets resolved during publish.

### Workspace Configuration

#### pnpm Workspace (`pnpm-workspace.yaml`)

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/tools/*"
  - "internal/*"
```

The `packages/polychromos/` directory is included via `packages/*` pattern.

#### Root .npmrc

```
auto-install-peers = true
link-workspace-packages=true
```

Workspace linking enabled for development.

#### Turbo Pipeline (`turbo.json`)

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".cache/tsbuildinfo.json", "dist/**", ".output/**"]
    }
  }
}
```

Build tasks run in dependency order (`^build` ensures `@polychromos/types` builds first).

### CI/CD Workflows

#### Existing Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Unit Tests | `.github/workflows/test.yml` | Runs on PR/push to main |
| E2E Tests | `.github/workflows/e2e.yml` | Polychromos app E2E |
| CLI E2E | `.github/workflows/e2e-cli.yml` | CLI-specific E2E with Convex |

**What's missing:**
- No `.github/workflows/release.yml` for npm publishing
- No `.github/workflows/changesets.yml` for version management

### Types Package Dependency

#### @polychromos/types (`packages/polychromos-types/package.json`)

```json
{
  "name": "@polychromos/types",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./validators": "./src/validators.ts",
    "./fixtures": "./src/fixtures/index.ts"
  }
}
```

**Publishing consideration**: This package exports TypeScript source directly (no build step). When `@polychromos/cli` is published, the `workspace:*` reference will be replaced with `^1.0.0`, requiring `@polychromos/types` to be published first or simultaneously.

### Current npm Scripts (`package.json:15-25`)

```json
{
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
  }
}
```

**Missing scripts:**
- `prepublishOnly` - Should run `pnpm build` before publish
- `prepack` - Alternative hook for build verification

## Code References

- `packages/polychromos/package.json` - Package configuration
- `packages/polychromos/src/index.ts` - CLI entry point with shebang
- `packages/polychromos/tsconfig.json` - TypeScript build config
- `packages/polychromos/vitest.config.ts` - Unit test configuration
- `packages/polychromos/vitest.e2e.config.ts` - E2E test configuration
- `packages/polychromos/test/e2e/setup.ts` - E2E global setup
- `packages/polychromos-types/package.json` - Types package config
- `.github/workflows/test.yml` - CI test workflow
- `.github/workflows/e2e-cli.yml` - CLI E2E workflow
- `turbo.json` - Build pipeline configuration
- `pnpm-workspace.yaml` - Workspace definition

## Architecture Documentation

### Current CLI Architecture

```
@polychromos/cli
├── src/
│   ├── index.ts              # Entry point with Commander.js
│   ├── commands/             # Command implementations
│   │   ├── login.ts          # Clerk session token auth
│   │   ├── logout.ts         # Clear credentials
│   │   ├── whoami.ts         # Verify auth via Convex
│   │   ├── init.ts           # Create design.json
│   │   ├── dev.ts            # Watch + sync to Convex
│   │   ├── export.ts         # HTML/Tailwind export
│   │   ├── undo.ts           # Convex undo mutation
│   │   ├── redo.ts           # Convex redo mutation
│   │   ├── history.ts        # Query version history
│   │   └── checkpoint.ts     # Local checkpoint
│   └── lib/
│       ├── config.ts         # .polychromos/config.json handling
│       ├── credentials.ts    # ~/.polychromos/credentials.json handling
│       ├── version-manager.ts # Local JSONL event log
│       └── index.ts          # Library exports
└── dist/                     # Compiled output (published)
```

### Authentication Flow

```
User runs: polychromos login
         ↓
CLI prompts for Clerk session token
         ↓
Token saved to ~/.polychromos/credentials.json
         ↓
Subsequent commands use token for Convex auth
```

### Sync Architecture

```
User runs: polychromos dev
         ↓
Load config from .polychromos/config.json
         ↓
Watch design.json with chokidar
         ↓
On change: debounce 300ms, read file, sync to Convex
         ↓
Single-flight pattern prevents concurrent mutations
```

## Historical Context (from thoughts/)

### Related Research Documents

- `thoughts/shared/research/2026-02-03-lightfastai-dual-npm-cicd-pipeline.md` - Reference implementation for npm CI/CD pipeline using Changesets + GitHub Actions
- `thoughts/shared/plans/2026-02-02-polychromos-mvp-implementation.md` - Original MVP implementation plan
- `thoughts/shared/plans/2026-02-02-polychromos-e2e-testing-cli-convex.md` - E2E testing implementation plan
- `thoughts/shared/research/2026-02-02-undo-redo-version-history-cli-sync.md` - Version control architecture

### Reference: @lightfastai/dual Pipeline

The `@lightfastai/dual` repository provides a reference implementation for npm publishing:

1. **Changesets** manages versions and creates "Version Packages" PRs
2. **GitHub Actions** triggers on `package.json` changes
3. **npm publish** with `--provenance` for supply chain security
4. **Verification job** confirms successful publication

## What's Complete (Ready for Publishing)

1. **CLI Implementation**
   - All 10 commands implemented and functional
   - Proper error handling and user feedback
   - Commander.js integration with descriptions and arguments

2. **Build Configuration**
   - TypeScript compiles to ES2022 modules
   - Declaration files generated for library consumers
   - Source maps for debugging

3. **Package Configuration**
   - `bin` field correctly configured
   - `exports` field with main and library entry points
   - `files` field limits published content to `dist/`

4. **Test Infrastructure**
   - Unit tests with memfs mocking
   - Integration tests for sync patterns
   - E2E tests with real Convex backend
   - CI workflows for automated testing

5. **Credentials Management**
   - Secure storage in `~/.polychromos/`
   - Environment variable support (`POLYCHROMOS_TOKEN`)
   - Token validation and expiry handling

## What's Missing (Required for Publishing)

### 1. Publishing Lifecycle Scripts

Add to `packages/polychromos/package.json`:
```json
{
  "scripts": {
    "prepublishOnly": "pnpm build && pnpm test:coverage"
  }
}
```

### 2. publishConfig for Scoped Package

Add to `packages/polychromos/package.json`:
```json
{
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  }
}
```

### 3. Changesets Configuration

Create `.changeset/config.json`:
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

### 4. GitHub Actions Release Workflow

Create `.github/workflows/release.yml` with:
- Trigger on `packages/polychromos/package.json` changes
- Verify commit message contains "version packages"
- Run `pnpm build` and `pnpm test`
- Publish with `npm publish --access public --provenance`

### 5. Types Package Publishing Strategy

Options:
- **Option A**: Publish `@polychromos/types` first, then `@polychromos/cli`
- **Option B**: Inline types into CLI package (remove dependency)
- **Option C**: Use Changesets linked packages for atomic release

### 6. Required GitHub Secrets

| Secret Name | Purpose |
|------------|---------|
| `NPM_TOKEN` | Publishing to npm registry |
| `GITHUB_TOKEN` | Creating version PRs (built-in) |

## Open Questions

1. **Types package strategy**: Should `@polychromos/types` be published separately or bundled into `@polychromos/cli`?

2. **Convex URL configuration**: The CLI currently requires `.polychromos/config.json` with `convexUrl`. Should this be configurable via environment variable for published package?

3. **Version sync**: Should `@polychromos/cli` and `@polychromos/types` versions be kept in sync (linked Changesets)?

4. **Pre-release testing**: Should there be a canary/beta publishing channel for testing before stable release?
