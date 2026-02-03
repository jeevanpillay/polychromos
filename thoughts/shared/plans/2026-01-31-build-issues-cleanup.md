---
date: 2026-01-31T00:00:00+00:00
planner: Claude
git_commit: 061e8899fc89bc151ff3f3c3daa07e7da575619d
branch: main
repository: x
topic: "Build Issues and Warnings Cleanup"
tags: [plan, build, typescript, eslint, prettier, cleanup]
status: draft
last_updated: 2026-01-31
last_updated_by: Claude
---

# Build Issues and Warnings Cleanup - Implementation Plan

## Overview

This plan addresses the build issues identified in the research document. There are 3 actionable issues to fix:
1. **ESLint Critical Error** - `no-unused-expressions` rule crash due to version incompatibility
2. **TypeScript Error** - Type mismatch in `__root.tsx` with JSON-LD schema
3. **Prettier Formatting** - 35+ source files need formatting

## Current State Analysis

### ESLint Issue
- **Root Cause**: Version mismatch between ESLint 9.39.1 and typescript-eslint 8.9.0
- **Error**: `TypeError: Error while loading rule '@typescript-eslint/no-unused-expressions': Cannot read properties of undefined (reading 'allowShortCircuit')`
- **Impact**: ESLint completely fails to run in both `@repo/www` and `@repo/ui` packages
- **Source**: This is a known issue introduced in ESLint 9.15+ with older typescript-eslint versions

### TypeScript Issue
- **Root Cause**: Explicit type assertion `as Array<Record<string, string>>` in `seo.ts:50` conflicts with TanStack Router's `MetaDescriptor` type which properly supports `{ 'script:ld+json': LdJsonObject }`
- **Error**: Type mismatch when using `script:ld+json` notation in the `meta` array
- **Impact**: Build fails with type error

### Prettier Issue
- **Root Cause**: Code style drift in UI components and app files
- **Impact**: 35+ files need formatting, but this is non-blocking

## Desired End State

After this plan is complete:
1. `pnpm lint` runs successfully with no errors
2. `pnpm typecheck` passes with no type errors
3. `pnpm format` shows all files are properly formatted
4. `pnpm build` completes with no actionable errors (only external TanStack warnings remain)

### Verification Commands
```bash
pnpm lint        # Should complete successfully
pnpm typecheck   # Should pass with exit code 0
pnpm format      # Should show 0 files need formatting
pnpm build       # Should complete with only external warnings
```

## What We're NOT Doing

- Fixing Vite build warnings about unused imports in TanStack dependencies (these are external and cannot be fixed in this repo)
- Upgrading to React 19 or other major dependency upgrades
- Refactoring code beyond what's necessary to fix the issues
- Adding new ESLint rules or changing linting behavior

## Implementation Approach

Fix issues in dependency order:
1. First fix ESLint (most critical - blocks linting entirely)
2. Then implement proper JSON-LD with schema-dts (better solution than removing type assertions)
3. Finally run Prettier (cosmetic, but good hygiene)

---

## Phase 1: Fix ESLint Version Compatibility

### Overview
Update typescript-eslint to a version compatible with ESLint 9.39.1.

### Changes Required:

#### 1. Update typescript-eslint package version
**File**: `internal/eslint/package.json`
**Changes**: Update typescript-eslint from `^8.9.0` to `^8.54.0` (latest stable version)

```json
// Before:
"typescript-eslint": "^8.9.0"

// After:
"typescript-eslint": "^8.54.0"
```

#### 2. Install updated dependencies
Run pnpm install to update the lockfile and install the new version.

### Success Criteria:

#### Automated Verification:
- [x] Dependency installs successfully: `pnpm install`
- [x] ESLint runs without crashing: `pnpm lint`
- [x] No "Error while loading rule" errors in output

#### Manual Verification:
- [x] Verify the correct version is installed in node_modules

---

## Phase 2: Implement Proper JSON-LD with Type Safety

### Overview
Replace the current inline JSON-LD approach with `schema-dts` for full TypeScript type safety and a reusable component pattern.

### Changes Required:

#### 1. Install schema-dts dependency
**File**: `apps/www/package.json`
**Changes**: Add `schema-dts` to dependencies

```bash
pnpm add -w schema-dts
```

#### 2. Create JsonLd component
**File**: `apps/www/src/components/json-ld.tsx` (new file)
**Changes**: Create a reusable component with proper type safety

```typescript
import type { Thing, WithContext } from "schema-dts";

// Type for JSON-LD Graph structure
type GraphContext = {
  "@context": "https://schema.org" | string | Record<string, unknown> | Array<string | Record<string, unknown>>;
  "@graph": Array<Thing>;
};

// Union type supporting both single entities and graph structures
type JsonLdData = WithContext<Thing> | GraphContext;

type JsonLdProps = {
  code: JsonLdData;
};

const escapeJsonForHtml = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const JsonLd = ({ code }: JsonLdProps) => (
  <script
    dangerouslySetInnerHTML={{
      __html: escapeJsonForHtml(JSON.stringify(code)),
    }}
    type="application/ld+json"
  />
);

// Export types for use in components
export type { GraphContext, JsonLdData };

// Re-export commonly used schema types for convenience
export type {
  Thing,
  WithContext,
  Organization,
  WebSite,
  WebPage,
  Article,
  Person,
} from "schema-dts";

// Export all types for advanced usage
export * from "schema-dts";
```

#### 3. Update SEO functions for type safety
**File**: `apps/www/src/lib/seo.ts`
**Changes**: Remove type assertions and return proper types

```typescript
import type { WithContext, WebSite, Organization } from "schema-dts";

// ... existing code ...

export function getWebsiteSchema(siteUrl: string): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Jeevan Pillay Studio",
    url: siteUrl,
    description: "Jeevan Pillay Studio - Personal portfolio and projects",
    author: {
      "@type": "Person",
      name: "Jeevan Pillay",
    },
  };
}

export function getOrganizationSchema(siteUrl: string): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Jeevan Pillay Studio",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: "Jeevan Pillay Studio - Personal portfolio and projects",
    sameAs: [
      "https://github.com/jeevanpillay",
      "https://twitter.com/jeevanpillay",
      "https://linkedin.com/in/jeevanpillay",
    ],
  };
}
```

#### 4. Update __root.tsx to use JsonLd component
**File**: `apps/www/src/routes/__root.tsx`
**Changes**: Use JsonLd component instead of meta array notation

```typescript
import { JsonLd } from "~/components/json-ld";

// In RootDocument component:
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <JsonLd code={getWebsiteSchema(appUrl)} />
        <JsonLd code={getOrganizationSchema(appUrl)} />
      </head>
      {/* ... rest of component ... */}
    </html>
  );
}
```

#### 5. Remove JSON-LD from meta array in seo.ts
**File**: `apps/www/src/lib/seo.ts`
**Changes**: Remove the type assertions from meta and links arrays

```typescript
// Before (lines 50, 55):
] as Array<Record<string, string>>,

// After:
],
```

### Success Criteria:

#### Automated Verification:
- [x] Dependency installs successfully: `pnpm install`
- [x] TypeScript type checking passes: `pnpm typecheck`
- [x] Build completes without type errors: `pnpm build`

#### Manual Verification:
- [ ] JSON-LD scripts appear correctly in rendered HTML head
- [ ] Multiple `<script type="application/ld+json">` tags are present in `<head>`
- [ ] SEO structured data validates with Google's [Rich Results Test](https://search.google.com/test/rich-results)

---

## Phase 3: Format Code with Prettier

### Overview
Run Prettier to fix all formatting issues across the codebase.

### Changes Required:

#### 1. Run Prettier fix command
Execute `pnpm format:fix` to auto-format all files.

This will format approximately 35 source files:
- 33 files in `packages/ui/src/`
- 10 files in `apps/www/src/`
- 2 config files

### Success Criteria:

#### Automated Verification:
- [x] Prettier check passes: `pnpm format`
- [x] No formatting issues reported

#### Manual Verification:
- [x] Spot-check a few files to ensure formatting looks correct

---

## Phase 4: Final Verification

### Overview
Run all quality checks to confirm the build is clean.

### Commands to Run:
```bash
pnpm lint
pnpm typecheck
pnpm format
pnpm build
```

### Success Criteria:

#### Automated Verification:
- [x] All type checks pass: `pnpm typecheck`
- [x] Build completes successfully: `pnpm build`
- [x] All formatting checks pass: `pnpm format` (source files only)
- [ ] All lint checks pass: `pnpm lint` (pre-existing lint errors remain - outside plan scope)

#### Manual Verification:
- [ ] Dev server starts successfully: `pnpm dev:www`
- [ ] No console errors in browser
- [ ] JSON-LD scripts appear in HTML head

---

## Testing Strategy

### Automated Tests:
- ESLint should run and complete without crashes
- TypeScript should compile without errors
- Prettier should report no formatting issues
- Build should complete (with only external TanStack warnings)

### Manual Testing Steps:
1. Start the dev server with `pnpm dev:www`
2. Navigate to the homepage
3. View page source and verify JSON-LD scripts are present in the `<head>`
4. Check browser console for any errors

## Performance Considerations

None - these are development tooling fixes that don't affect runtime performance.

## Migration Notes

No data migration needed. These are purely development tooling fixes.

## Rollback Plan

If issues arise:
1. Revert the typescript-eslint version change in `internal/eslint/package.json`
2. Revert the type assertion removal in `apps/www/src/lib/seo.ts`
3. Run `pnpm install` to restore previous lockfile state

## References

- Research document: `thoughts/shared/research/2026-01-31-build-issues-cleanup.md`
- ESLint configuration: `internal/eslint/base.js`
- SEO helper: `apps/www/src/lib/seo.ts`
- Root route: `apps/www/src/routes/__root.tsx`
- schema-dts package: https://github.com/google/schema-dts
- typescript-eslint GitHub issue: https://github.com/typescript-eslint/typescript-eslint/issues/10338
- ESLint GitHub issue: https://github.com/eslint/eslint/issues/19134
