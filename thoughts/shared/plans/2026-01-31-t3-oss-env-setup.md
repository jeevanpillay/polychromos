# T3 OSS Environment Variables Setup Implementation Plan

## Overview

Implement type-safe environment variables using `@t3-oss/env-core` and Zod for the portfolio site (`apps/www`). This provides build-time and runtime validation for the `VITE_APP_URL` variable used in SEO configuration.

## Current State Analysis

The current implementation uses `import.meta.env.VITE_APP_URL` directly with a fallback string:
- `apps/www/src/routes/__root.tsx:28` - `const appUrl = import.meta.env.VITE_APP_URL ?? "https://yourdomain.com"`
- `apps/www/src/lib/seo.ts:24` - Hardcoded `ogImage` default URL
- No type safety or build-time validation
- `.env.example` already exists with the correct variable template

### Key Discoveries:
- Only one client-side environment variable is needed: `VITE_APP_URL`
- `.gitignore` already ignores `.env` and `.env*.local` files
- `apps/www/.env.example` already documents the required variable
- No `@t3-oss/env-core` or `zod` packages installed yet

## Desired End State

After implementation:
1. Environment variables are validated at build time (in `vite.config.ts`)
2. Environment variables are type-safe throughout the application
3. Missing or invalid environment variables cause clear error messages at build time
4. The `env` object is the single source of truth for all environment configuration

### Verification:
- `pnpm build:www` succeeds with valid `.env` file
- `pnpm build:www` fails with descriptive error when `VITE_APP_URL` is missing or invalid
- `pnpm typecheck` passes
- SEO canonical URLs work correctly in production

## What We're NOT Doing

- Not adding server-side environment variables (not needed for static portfolio)
- Not adding Vercel system environment variables to the schema (they're auto-exposed)
- Not modifying the root `.env.example` (it's for other apps in the monorepo)
- Not adding complex runtime environment detection

## Implementation Approach

Simple 3-phase approach:
1. Install dependencies
2. Create env schema and integrate into build
3. Update consumers to use the validated env object

---

## Phase 1: Install Dependencies

### Overview
Install `@t3-oss/env-core` and `zod` packages in the www app.

### Changes Required:

#### 1. Install packages
**Command**: Run in project root
```bash
pnpm --filter @polychromos/www add @t3-oss/env-core zod
```

### Success Criteria:

#### Automated Verification:
- [x] Packages appear in `apps/www/package.json` dependencies
- [x] `pnpm install` completes without errors
- [x] `pnpm typecheck` passes

---

## Phase 2: Create Environment Schema

### Overview
Create the centralized environment configuration with Zod validation.

### Changes Required:

#### 1. Create env.ts
**File**: `apps/www/src/env.ts` (new file)
**Purpose**: Define and export the validated environment object

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_APP_URL: z.string().url(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```

**Note**: We use `import.meta.env` instead of `process.env` because Vite exposes client variables through `import.meta.env`. No default value is provided - this forces explicit configuration in Vercel.

#### 2. Add build-time validation in vite.config.ts
**File**: `apps/www/vite.config.ts`
**Changes**: Import env to trigger validation at build time

```typescript
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Validate environment variables at build time
import "./src/env";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
      },
    }),
    tsConfigPaths(),
    react(),
  ],
});
```

#### 3. Create local .env file for development
**File**: `apps/www/.env` (local, gitignored)
**Content**:
```bash
VITE_APP_URL=http://localhost:3000
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm dev:www` starts successfully with `.env` file present
- [x] Build fails with clear error message when `VITE_APP_URL` is missing

#### Manual Verification:
- [x] Remove `.env` temporarily and verify build fails with descriptive Zod error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the build validation works correctly before proceeding to the next phase.

---

## Phase 3: Update Consumers

### Overview
Update all files that use environment variables to import from the centralized `env` object.

### Changes Required:

#### 1. Update __root.tsx
**File**: `apps/www/src/routes/__root.tsx`
**Changes**: Replace `import.meta.env.VITE_APP_URL` with `env.VITE_APP_URL`

**Before**:
```typescript
const appUrl = import.meta.env.VITE_APP_URL ?? "https://yourdomain.com";
```

**After**:
```typescript
import { env } from "~/env";

// Remove the old appUrl constant and use env.VITE_APP_URL directly
```

Update usages:
- Line 32-36: `canonicalUrl: env.VITE_APP_URL`
- Line 59: `getWebsiteSchema(env.VITE_APP_URL)`
- Line 60: `getOrganizationSchema(env.VITE_APP_URL)`

#### 2. Update seo.ts ogImage default
**File**: `apps/www/src/lib/seo.ts`
**Changes**: Consider using the env variable for ogImage base URL

**Before**:
```typescript
ogImage = "https://yourdomain.com/og-image.png",
```

**After** (Option A - keep simple):
```typescript
// Leave as-is if og-image.png will always be at the canonical domain
ogImage = "https://jeevanpillay.studio/og-image.png",
```

**After** (Option B - dynamic):
```typescript
import { env } from "~/env";

// In function parameters:
ogImage = `${env.VITE_APP_URL}/og-image.png`,
```

**Recommendation**: Use Option B for consistency, since the canonical URL should match where assets are served from.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (no new errors introduced by our changes)
- [x] `pnpm build:www` succeeds
- [x] No `import.meta.env.VITE_APP_URL` references remain in source files (except in env.ts)

#### Manual Verification:
- [ ] Dev server shows correct canonical URLs in page source
- [ ] Production build has correct canonical URLs
- [ ] JSON-LD schemas contain correct URLs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that SEO tags are correct before marking complete.

---

## Vercel Configuration

After code changes are deployed, configure Vercel:

1. Go to Project Settings → Environment Variables
2. Add `VITE_APP_URL`:
   - **Production**: `https://jeevanpillay.studio` (or your actual domain)
   - **Preview**: Can use `https://your-project.vercel.app` or leave unset to fail (forcing production-only deploys)

Note: Vercel system variables (like `VERCEL_URL`) are auto-exposed and don't need manual configuration.

---

## Testing Strategy

### Unit Tests:
- Not applicable (simple environment validation)

### Integration Tests:
- Build succeeds with valid env
- Build fails with missing/invalid env

### Manual Testing Steps:
1. Remove `apps/www/.env` and run `pnpm build:www` - should fail with Zod validation error
2. Add back `apps/www/.env` with valid URL and run `pnpm build:www` - should succeed
3. Add `apps/www/.env` with invalid URL (e.g., "not-a-url") and run `pnpm build:www` - should fail with Zod validation error
4. Run `pnpm dev:www` and inspect page source for correct canonical URL
5. Check network tab for correct og:url meta tag

---

## References

- Research document: `thoughts/shared/research/2026-01-31-t3-oss-env-vite-vercel.md`
- T3 Env documentation: https://env.t3.gg/docs/core
- Vite environment variables: https://vite.dev/guide/env-and-mode
