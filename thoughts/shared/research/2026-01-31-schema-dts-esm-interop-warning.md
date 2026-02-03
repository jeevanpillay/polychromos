---
date: 2026-01-31T17:45:00+11:00
researcher: Claude
git_commit: ebe626e4837fab799e84e81c94e68b1d6593f3eb
branch: main
repository: x
topic: "schema-dts ESM interop warning with export * syntax"
tags: [research, codebase, schema-dts, esm, vite, json-ld]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: schema-dts ESM Interop Warning

**Date**: 2026-01-31T17:45:00+11:00
**Researcher**: Claude
**Git Commit**: ebe626e4837fab799e84e81c94e68b1d6593f3eb
**Branch**: main
**Repository**: x

## Research Question

Why does Vite display the warning "Unable to interop `export * from "schema-dts"` in json-ld.tsx, this may lose module exports"?

## Summary

The warning occurs because:
1. **schema-dts is a CommonJS-only package** - It ships only `dist/schema.js` using CommonJS format (`exports.__esModule = true`)
2. **json-ld.tsx uses `export * from "schema-dts"`** - This ESM re-export syntax is incompatible with CJS modules
3. **schema-dts exports only TypeScript types** - The runtime JS file is essentially empty (`"use strict"; Object.defineProperty(exports, "__esModule", { value: true });`)

## Detailed Findings

### json-ld.tsx Implementation

**Location**: `apps/www/src/components/json-ld.tsx`

The file has three export patterns:

1. **Type-only imports** (line 1):
   ```typescript
   import type { Thing, WithContext } from "schema-dts";
   ```

2. **Named type re-exports** (lines 41-49):
   ```typescript
   export type {
     Thing,
     WithContext,
     Organization,
     WebSite,
     WebPage,
     Article,
     Person,
   } from "schema-dts";
   ```

3. **Wildcard re-export** (line 52):
   ```typescript
   export * from "schema-dts";
   ```

The wildcard export at line 52 is the source of the warning.

### schema-dts Package Structure

**Location**: `node_modules/schema-dts/package.json`

| Field | Value |
|-------|-------|
| version | 1.1.5 |
| main | `./dist/schema.js` |
| types | `./dist/schema.d.ts` |
| exports field | Not present (uses legacy format) |
| module format | CommonJS only |

**dist/schema.js contents**:
```javascript
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
```

The runtime JavaScript file is essentially empty because schema-dts is a **type-only package**. All its value comes from the TypeScript type definitions in `dist/schema.d.ts`.

### Why the Warning Occurs

Vite uses esbuild for development bundling. When it encounters `export * from "schema-dts"`:

1. Vite tries to analyze what values to re-export from the CommonJS module
2. The CJS module has no named exports (only the empty `__esModule` marker)
3. Vite cannot statically determine what to re-export
4. The warning is issued because the interop may "lose module exports"

In practice, since schema-dts only contains TypeScript types (which are erased at runtime), there are no actual runtime exports to lose. The warning is technically accurate but functionally harmless.

### Usage in Codebase

**Files importing from schema-dts:**

| File | Imports |
|------|---------|
| `apps/www/src/components/json-ld.tsx:1` | `type { Thing, WithContext }` |
| `apps/www/src/lib/seo.ts:1` | `type { Organization, Person, WebSite, WithContext }` |

**Files importing from json-ld.tsx:**

| File | Line | Usage |
|------|------|-------|
| `apps/www/src/routes/__root.tsx` | 16 | `import { JsonLd } from "~/components/json-ld"` |

The root layout renders two JSON-LD scripts:
- `<JsonLd code={getWebsiteSchema(env.VITE_APP_URL)} />` (line 56)
- `<JsonLd code={getOrganizationSchema(env.VITE_APP_URL)} />` (line 57)

## Code References

- `apps/www/src/components/json-ld.tsx:1` - Type import from schema-dts
- `apps/www/src/components/json-ld.tsx:41-49` - Named type re-exports
- `apps/www/src/components/json-ld.tsx:52` - Wildcard export causing warning
- `apps/www/src/lib/seo.ts:1` - Additional schema-dts type imports
- `apps/www/src/routes/__root.tsx:16,56-57` - JsonLd component usage

## Architecture Documentation

### Module Interop Pattern

The codebase uses TanStack Start + Vite, which runs in ESM mode. The schema-dts package is a CommonJS module attempting to be consumed via ESM syntax.

The `export * from "schema-dts"` syntax at line 52 of json-ld.tsx attempts to re-export all exports from a CJS module, which Vite/esbuild cannot statically analyze for interop.

### Type-Only Package Characteristic

schema-dts is unusual in that:
- Its runtime JavaScript file contains no actual exports
- All its value is in TypeScript type definitions
- The `export * from "schema-dts"` re-exports types only, not runtime values

## Open Questions

1. Whether the warning affects production builds or only development mode
2. Whether other consumers might need runtime exports from json-ld.tsx that are currently lost
