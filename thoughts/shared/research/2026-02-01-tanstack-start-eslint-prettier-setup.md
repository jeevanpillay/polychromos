---
date: 2026-02-01T10:00:00+00:00
researcher: Claude Code
topic: "TanStack Start ESLint/Prettier Configuration Migration from Next.js"
tags: [research, web-analysis, eslint, prettier, tanstack-start, monorepo, turborepo]
status: complete
created_at: 2026-02-01
confidence: high
sources_count: 18
---

# Web Research: TanStack Start ESLint/Prettier Configuration

**Date**: 2026-02-01
**Topic**: Correct @internal/ setup for ESLint and Prettier for TanStack Start (migrating from Next.js)
**Confidence**: High - Based on official TanStack docs, ESLint v9 docs, and Turborepo best practices

## Research Question

How to correctly configure the @repo/eslint-config and @repo/prettier-config internal packages for TanStack Start, specifically:
1. Stop linting auto-generated files (routeTree.gen.ts)
2. Remove Next.js-specific configuration
3. Add TanStack Router ESLint plugin
4. Properly configure ignores in ESLint flat config

## Executive Summary

Your current ESLint setup is based on Next.js and includes the `@next/eslint-plugin-next` which is not needed for TanStack Start. The main changes needed are:

1. **Replace `nextjs.js` with `tanstack.js`** - Add `@tanstack/eslint-plugin-router` for route-specific linting
2. **Add proper ignores for auto-generated files** - `routeTree.gen.ts` should be excluded from linting/formatting
3. **Update `apps/www/eslint.config.js`** - Remove Next.js config, add TanStack Router config
4. **Create `.prettierignore`** - The prettier-ignore comments in generated files don't work in JS/TS

## Current State Analysis

### What You Have

```
internal/
├── eslint/
│   ├── base.js        ✅ Good - uses typescript-eslint flat config
│   ├── nextjs.js      ❌ Remove - Next.js specific
│   ├── react.js       ✅ Keep - needed for React
│   └── package.json   ⚠️  Update - add TanStack plugin, remove Next.js
├── prettier/
│   └── index.js       ✅ Good - but needs .prettierignore
└── typescript/
    └── ...            ✅ Keep as-is
```

### Current `apps/www/eslint.config.js`

```javascript
import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";
import nextjsConfig from "@repo/eslint-config/nextjs";  // ❌ Remove
import reactConfig from "@repo/eslint-config/react";

export default [
  {
    ignores: [".next/**"],  // ❌ Change to TanStack Start ignores
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,           // ❌ Remove
  ...restrictEnvAccess,
];
```

## Key Metrics & Findings

### TanStack Router ESLint Plugin

**Finding**: TanStack provides an official ESLint plugin specifically for Router/Start projects
**Source**: [TanStack Router Docs](https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router)

- **Package**: `@tanstack/eslint-plugin-router`
- **Purpose**: Enforces correct property order in route definitions (TypeScript generics depend on order)
- **Config**: `pluginRouter.configs['flat/recommended']`

### Auto-Generated Files Handling

**Finding**: `routeTree.gen.ts` should be committed to git but excluded from linting/formatting
**Source**: [TanStack Router Discussion #1218](https://github.com/TanStack/router/discussions/1218)

- **Official Recommendation**: Don't gitignore `routeTree.gen.ts` - it's essential for TypeScript and runtime
- **Linting**: Exclude from ESLint via global ignores
- **Formatting**: The `prettier-ignore-start` comments in generated files DON'T work in JS/TS (only Markdown)
- **Solution**: Must use `.prettierignore` file

### ESLint Flat Config Best Practices (2026)

**Finding**: ESLint v9 with flat config is the current standard; v8 reached EOL October 2024
**Source**: [ESLint Docs](https://eslint.org/docs/latest/use/configure/configuration-files)

- **New in 2025**: `defineConfig()` and `globalIgnores()` helpers available
- **Global ignores**: A config object with ONLY `ignores` key applies globally
- **Pattern**: Use `**/routeTree.gen.ts` to match anywhere in the project

## Trade-off Analysis

### Option 1: Minimal Changes (Recommended)

| Factor | Impact | Notes |
|--------|--------|-------|
| Effort | Low | Just swap configs and add ignores |
| Risk | Low | Keeps existing base.js and react.js |
| Breaking | None | Just removes unused Next.js config |

### Option 2: Full Migration to @tanstack/eslint-config

| Factor | Impact | Notes |
|--------|--------|-------|
| Effort | Medium | Need to align with TanStack conventions |
| Risk | Medium | May change existing lint rules |
| Breaking | Some | Different rule sets |

## Recommendations

Based on research findings, **Option 1** is recommended:

### 1. Update `internal/eslint/package.json`

Remove Next.js plugin, add TanStack Router plugin:

```json
{
  "name": "@repo/eslint-config",
  "exports": {
    "./base": "./base.js",
    "./react": "./react.js",
    "./tanstack": "./tanstack.js"
  },
  "dependencies": {
    "@eslint/compat": "^1.2.0",
    "@tanstack/eslint-plugin-router": "^1.95.3",
    "eslint-plugin-import": "^2.31.0",
    "eslint-plugin-react": "^7.37.1",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-turbo": "^2.1.3",
    "typescript-eslint": "^8.54.0"
  }
}
```

### 2. Create `internal/eslint/tanstack.js`

```javascript
import pluginRouter from "@tanstack/eslint-plugin-router";

/** @type {Awaited<import('typescript-eslint').Config>} */
export default [
  ...pluginRouter.configs["flat/recommended"],
];
```

### 3. Delete `internal/eslint/nextjs.js`

No longer needed.

### 4. Update `internal/eslint/base.js` ignores

Add to the existing config:

```javascript
export default tseslint.config(
  // Existing gitignore
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  // Add TanStack-specific ignores
  {
    ignores: [
      "**/*.config.*",
      "**/routeTree.gen.ts",   // TanStack Router generated
      "**/*.gen.ts",           // Any generated files
      ".output/**",            // TanStack Start build output
      ".nitro/**",             // Nitro server output
    ]
  },
  // ... rest of config
);
```

### 5. Update `apps/www/eslint.config.js`

```javascript
import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";
import reactConfig from "@repo/eslint-config/react";
import tanstackConfig from "@repo/eslint-config/tanstack";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [
      ".output/**",
      ".nitro/**",
      ".vinxi/**",
    ],
  },
  ...baseConfig,
  ...reactConfig,
  ...tanstackConfig,
  ...restrictEnvAccess,
];
```

### 6. Create root `.prettierignore`

```
# Build outputs
.next
.output
.nitro
.vinxi
.turbo
dist
build

# Dependencies
node_modules

# Auto-generated files
**/routeTree.gen.ts
**/*.gen.ts

# Lock files
pnpm-lock.yaml
```

### 7. VSCode Settings (Optional)

Add to `.vscode/settings.json` to reduce noise:

```json
{
  "files.readonlyInclude": {
    "**/routeTree.gen.ts": true
  },
  "search.exclude": {
    "**/routeTree.gen.ts": true
  }
}
```

## Detailed Findings

### TanStack Start Build Directories

**Question**: What directories does TanStack Start generate?
**Finding**: `.output/`, `.nitro/`, and `.vinxi/`
**Relevance**: These should all be ignored by ESLint and Prettier

### Prettier-Ignore Comments Don't Work

**Question**: Why doesn't the generated file's prettier-ignore work?
**Finding**: `prettier-ignore-start`/`end` comments only work in Markdown, not JS/TS
**Source**: [TanStack Router Issue #2673](https://github.com/TanStack/router/issues/2673)
**Solution**: Must use `.prettierignore` file

### Property Order in Routes

**Question**: Why is the TanStack ESLint plugin important?
**Finding**: TypeScript generics in TanStack Router depend on property order. The plugin catches ordering issues.
**Source**: [TanStack ESLint Plugin Docs](https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router)

## Files to Modify

| File | Action | Reason |
|------|--------|--------|
| `internal/eslint/package.json` | Modify | Add @tanstack/eslint-plugin-router, remove @next/eslint-plugin-next |
| `internal/eslint/base.js` | Modify | Add TanStack-specific ignores |
| `internal/eslint/tanstack.js` | Create | TanStack Router plugin config |
| `internal/eslint/nextjs.js` | Delete | Not needed for TanStack Start |
| `apps/www/eslint.config.js` | Modify | Use tanstack config instead of nextjs |
| `.prettierignore` | Create | Ignore generated files |
| `.vscode/settings.json` | Optional | Hide generated files in editor |

## Risk Assessment

### Low Priority
- **Rule differences**: TanStack plugin adds route-specific rules that may catch new issues

### None/Minimal
- **Migration risk**: Changes are additive/subtractive, not breaking
- **CI impact**: May need to regenerate routeTree.gen.ts after formatting if it was previously formatted

## Open Questions

1. **jsx-a11y**: Currently not in use - consider adding for accessibility linting
2. **Prettier Tailwind config**: The current config references `packages/ui/tailwind.config.ts` - verify this still exists with Tailwind v4

## Sources

### Official Documentation
- [ESLint Plugin Router | TanStack Router Docs](https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router)
- [Configuration Files - ESLint](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Ignore Files - ESLint](https://eslint.org/docs/latest/use/configure/ignore)
- [Ignoring Code - Prettier](https://prettier.io/docs/ignore)

### GitHub Issues & Discussions
- [Should routeTree.gen.ts be gitignored? · Discussion #1218](https://github.com/TanStack/router/discussions/1218)
- [Generated prettier-ignore comments do nothing · Issue #2673](https://github.com/TanStack/router/issues/2673)
- [Documentation: Inconsistent instructions · Issue #5354](https://github.com/TanStack/router/issues/5354)

### Turborepo
- [ESLint | Turborepo](https://turborepo.dev/repo/docs/handbook/linting/eslint)

### NPM Packages
- [@tanstack/eslint-plugin-router](https://www.npmjs.com/package/@tanstack/eslint-plugin-router)
- [@tanstack/eslint-config](https://www.npmjs.com/package/@tanstack/eslint-config)
- [eslint-config-prettier](https://www.npmjs.com/package/eslint-config-prettier)

---

**Last Updated**: 2026-02-01
**Confidence Level**: High - Based on official documentation and maintainer recommendations
**Next Steps**: Implement the changes in order (package.json → configs → app config → prettierignore)
