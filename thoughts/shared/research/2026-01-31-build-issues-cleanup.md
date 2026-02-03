---
date: 2026-01-31T00:00:00+00:00
researcher: Claude
git_commit: 061e8899fc89bc151ff3f3c3daa07e7da575619d
branch: main
repository: x
topic: "Build Issues and Warnings Audit"
tags: [research, build, typescript, eslint, prettier, cleanup]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Build Issues and Warnings Audit

**Date**: 2026-01-31
**Researcher**: Claude
**Git Commit**: 061e8899fc89bc151ff3f3c3daa07e7da575619d
**Branch**: main
**Repository**: x

## Research Question
Run pnpm build and identify all build issues, warnings, and code quality problems that need cleanup.

## Summary

The codebase has **4 categories of issues** that need attention:

1. **Vite Build Warnings** (3 warnings) - Unused imports in TanStack dependencies (external, not actionable)
2. **TypeScript Error** (1 error) - Type mismatch in `__root.tsx` with JSON-LD schema
3. **ESLint Error** (1 critical error) - Rule configuration incompatibility breaking linting entirely
4. **Prettier Formatting** (35 actual source files) - Code style issues in UI components and app files

## Detailed Findings

### 1. Vite Build Warnings (External - Not Actionable)

During SSR build, Vite reports unused imports from TanStack packages:

```
"createRequestHandler", "defineHandlerCallback", "transformPipeableStreamWithRouter"
and "transformReadableStreamWithRouter" are imported from external module
"@tanstack/router-core/ssr/server" but never used in
"../../node_modules/@tanstack/start-server-core/dist/esm/index.js".

"RawStream" is imported from external module "@tanstack/router-core" but never used in
"../../node_modules/@tanstack/start-client-core/dist/esm/index.js".

"hydrate" and "json" are imported from external module "@tanstack/router-core/ssr/client"
but never used in "../../node_modules/@tanstack/start-client-core/dist/esm/index.js".
```

**Status**: These are internal to TanStack Start dependencies. Cannot be fixed in this repo.

---

### 2. TypeScript Error (Actionable)

**File**: `apps/www/src/routes/__root.tsx:30`

**Error**: Type mismatch when using `script:ld+json` for JSON-LD structured data in the `head` function.

```typescript
error TS2322: Type '{ "script:ld+json": { "@context": string; "@type": string; ... }; }'
has no properties in common with type 'DetailedHTMLProps<MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>'.
```

**Root Cause**: The `meta` array expects standard HTML meta tag properties, but `script:ld+json` is a TanStack-specific notation for injecting JSON-LD scripts. The type definitions don't recognize this pattern.

**Current Code**:
```typescript
head: () => {
  const seo = generateSEO({ ... });
  return {
    ...seo,
    meta: [
      ...seo.meta,
      { "script:ld+json": getWebsiteSchema(appUrl) },      // ← Type error
      { "script:ld+json": getOrganizationSchema(appUrl) }, // ← Type error
    ],
  };
},
```

**Resolution Options**:
1. Use type assertion to satisfy TypeScript
2. Move JSON-LD to `scripts` array if TanStack supports it there
3. Use a different method for injecting JSON-LD (e.g., in RootDocument component)

---

### 3. ESLint Configuration Error (Critical - Actionable)

**Error**: ESLint completely fails to run due to rule configuration incompatibility:

```
TypeError: Error while loading rule '@typescript-eslint/no-unused-expressions':
Cannot read properties of undefined (reading 'allowShortCircuit')
```

**Affected Packages**:
- `@repo/www`
- `@repo/ui`

**Root Cause**: Version mismatch between `eslint` (9.39.1) and `@typescript-eslint/eslint-plugin`. The `no-unused-expressions` rule expects a configuration format that differs between ESLint versions.

**Resolution**: Update ESLint or TypeScript-ESLint packages to compatible versions, or adjust the rule configuration in the ESLint config.

---

### 4. Prettier Formatting Issues (Actionable)

**Source Files Needing Formatting** (excluding build artifacts and .next):

#### `packages/ui/src/` (33 files)
- `components/base-node.tsx`
- `components/info-card.tsx`
- `components/ui/accordion.tsx`
- `components/ui/alert.tsx`
- `components/ui/avatar.tsx`
- `components/ui/badge.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/carousel.tsx`
- `components/ui/chart.tsx`
- `components/ui/checkbox.tsx`
- `components/ui/command.tsx`
- `components/ui/dialog.tsx`
- `components/ui/drawer.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/form.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/popover.tsx`
- `components/ui/resizable.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/separator.tsx`
- `components/ui/sheet.tsx`
- `components/ui/sidebar.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/slider.tsx`
- `components/ui/tabs.tsx`
- `components/ui/textarea.tsx`
- `components/ui/toast.tsx`
- `components/ui/toggle.tsx`
- `components/ui/tooltip.tsx`
- `globals.css`
- `mdx.css`

#### `apps/www/src/` (10 files)
- `components/page-transition/context.tsx`
- `components/page-transition/page-transition.tsx`
- `components/page-transition/transition-link.tsx`
- `lib/sitemap.ts`
- `middleware.ts`
- `routes/__root.tsx`
- `routes/about.tsx`
- `routes/index.tsx`
- `routes/sitemap[.]xml.tsx`
- `routeTree.gen.ts` (auto-generated, may not need formatting)

#### Other
- `apps/www/vite.config.ts`
- `apps/www/README.md`

**Resolution**: Run `pnpm format:fix` to auto-fix all formatting issues.

---

## Priority Summary

| Priority | Issue | Action |
|----------|-------|--------|
| **Critical** | ESLint broken | Fix package version compatibility |
| **High** | TypeScript error | Fix type annotation in `__root.tsx` |
| **Medium** | Prettier formatting | Run `pnpm format:fix` |
| **None** | Vite warnings | No action needed (external deps) |

## Commands to Fix

```bash
# Fix formatting issues
pnpm format:fix

# After fixing ESLint config and TypeScript error:
pnpm typecheck
pnpm lint
```

## Code References

- `apps/www/src/routes/__root.tsx:30` - TypeScript error location
- `internal/eslint/` - ESLint configuration to review for version compatibility
