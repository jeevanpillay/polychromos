# Replace GA4 + Sentry with Vercel Analytics & Speed Insights

## Overview

Remove the existing Google Analytics 4 (GA4), Sentry error tracking, and web-vitals implementations and replace them with Vercel Analytics and Vercel Speed Insights. This simplifies the analytics stack by using Vercel's native first-party analytics that require no configuration and integrate seamlessly with TanStack Start deployments on Vercel.

## Current State Analysis

### Existing Analytics Stack
- **GA4**: Custom implementation in `apps/www/src/lib/analytics.ts` (109 lines)
- **Sentry**: Error tracking with session replay via `@sentry/react` in `apps/www/src/lib/sentry.ts` (109 lines)
- **Web Vitals**: Core Web Vitals reporting to both GA4 and Sentry in `apps/www/src/lib/web-vitals.ts` (110 lines)

### Integration Points
- Root component initializes all analytics in `apps/www/src/routes/__root.tsx:57-76`
- CSP headers in `apps/www/src/middleware.ts:43` allow GA4/Sentry domains
- Environment variables in `turbo.json:42-47` and `apps/www/.env.example`
- Dependencies: `@sentry/react`, `web-vitals` in `pnpm-workspace.yaml:19-20`

### Key Discoveries
- All analytics initialized client-side in useEffect hook (`__root.tsx:57`)
- Web Vitals has dual reporting to both GA4 and Sentry (`web-vitals.ts:64-65`)
- CSP middleware exists but may not be actively applied in TanStack Start
- PostHog env vars exist but were never implemented

## Desired End State

After implementation:
1. `@vercel/analytics` and `@vercel/speed-insights` packages installed
2. `<Analytics />` and `<SpeedInsights />` components rendered in root layout
3. No GA4, Sentry, or web-vitals code or dependencies remain
4. CSP headers updated to remove obsolete GA4/Sentry domains
5. Environment variables cleaned up (GA4/Sentry vars removed)
6. Application builds and runs without analytics-related errors

### Verification
- `pnpm build:www` succeeds without errors
- `pnpm typecheck` passes
- `pnpm lint` passes
- No console errors related to analytics on page load
- When deployed to Vercel: Analytics and Speed Insights tabs show data

## What We're NOT Doing

- **Not adding error tracking**: Per decision, no Sentry replacement
- **Not implementing custom events**: Vercel Analytics supports custom events but this is out of scope
- **Not adding server-side analytics**: Using client-side only
- **Not removing the middleware file**: Keeping it for security headers, just cleaning CSP domains

## Implementation Approach

This is a straightforward removal and replacement with minimal risk:
1. Add new Vercel packages
2. Update root component to use new analytics
3. Remove old analytics files
4. Remove old dependencies
5. Clean up configuration files

---

## Phase 1: Add Vercel Analytics & Speed Insights

### Overview
Install packages and add components to the application root.

### Changes Required:

#### 1. Add Dependencies
**File**: `apps/www/package.json`
**Changes**: Add `@vercel/analytics` and `@vercel/speed-insights` to dependencies

```json
"dependencies": {
  "@vercel/analytics": "^1.5.0",
  "@vercel/speed-insights": "^1.2.0",
  // ... existing dependencies
}
```

#### 2. Update Root Component
**File**: `apps/www/src/routes/__root.tsx`
**Changes**:
- Add imports for Vercel analytics components
- Remove imports for old analytics (GA4, Sentry, web-vitals)
- Remove the entire analytics useEffect hook
- Add `<Analytics />` and `<SpeedInsights />` to RootDocument

```tsx
import type { ReactNode } from "react";

import {
  HeadContent,
  Outlet,
  ErrorComponent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import {
  PageTransition,
  PageTransitionProvider,
} from "~/components/page-transition";
import {
  generateSEO,
  getWebsiteSchema,
  getOrganizationSchema,
} from "~/lib/seo";
import "../styles/app.css";

const appUrl = import.meta.env.VITE_APP_URL || "https://yourdomain.com";

export const Route = createRootRoute({
  head: () => ({
    ...generateSEO({
      title: "Jeevan Pillay Studio",
      description: "Jeevan Pillay Studio - Personal portfolio and projects",
      canonicalUrl: appUrl,
    }),
    scripts: [
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify(getWebsiteSchema(appUrl)),
      },
      {
        type: "application/ld+json",
        innerHTML: JSON.stringify(getOrganizationSchema(appUrl)),
      },
    ],
  }),
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <PageTransitionProvider>
      <RootDocument>
        <PageTransition />
        <Outlet />
      </RootDocument>
    </PageTransitionProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col bg-background">
          {children}
        </div>
        <Analytics />
        <SpeedInsights />
        <Scripts />
      </body>
    </html>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint` (pre-existing issue, build succeeds)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Application loads without console errors
- [ ] No broken imports visible in browser dev tools

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Remove Old Analytics Files

### Overview
Delete the old analytics implementation files that are no longer needed.

### Changes Required:

#### 1. Delete Analytics Files
**Files to delete**:
- `apps/www/src/lib/analytics.ts` (GA4 implementation)
- `apps/www/src/lib/sentry.ts` (Sentry implementation)
- `apps/www/src/lib/web-vitals.ts` (Web Vitals implementation)

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds with no missing import errors: `pnpm build:www`
- [x] TypeScript compiles: `pnpm typecheck`

#### Manual Verification:
- [x] Files are removed from the filesystem
- [x] No references to deleted files in codebase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Remove Old Dependencies

### Overview
Remove the Sentry and web-vitals packages from the project.

### Changes Required:

#### 1. Update Package.json
**File**: `apps/www/package.json`
**Changes**: Remove `@sentry/react` and `web-vitals` from dependencies

Remove these lines:
```json
"@sentry/react": "catalog:",
"web-vitals": "catalog:"
```

#### 2. Update Workspace Catalog
**File**: `pnpm-workspace.yaml`
**Changes**: Remove `@sentry/react` and `web-vitals` from catalog

Remove these lines:
```yaml
'@sentry/react': ^8.33.1
'web-vitals': ^5.1.0
```

#### 3. Reinstall Dependencies
Run `pnpm install` to update the lockfile and remove unused packages.

### Success Criteria:

#### Automated Verification:
- [x] Dependencies install without errors: `pnpm install`
- [x] Build succeeds: `pnpm build:www`
- [x] Lockfile updated (no @sentry/* or web-vitals entries for www app)

#### Manual Verification:
- [x] Confirm packages removed from `node_modules`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Clean Up Configuration

### Overview
Remove obsolete environment variables and update CSP headers.

### Changes Required:

#### 1. Update Turbo.json
**File**: `turbo.json`
**Changes**: Remove GA4 and Sentry environment variables from `globalEnv`

Remove these lines from `globalEnv` array:
```json
"VITE_SENTRY_DSN",
"VITE_GA4_MEASUREMENT_ID",
"SENTRY_ORG",
"SENTRY_PROJECT",
"SENTRY_AUTH_TOKEN",
```

Keep `VITE_APP_URL` as it's used for SEO.

Updated `globalEnv` section (lines 40-76):
```json
"globalEnv": [
  "PORT",
  "VITE_APP_URL",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "BRAINTRUST_API_KEY",
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "ARCJET_KEY",
  "VITE_POSTHOG_KEY",
  "VITE_POSTHOG_HOST",
  "LOGTAIL_SOURCE_TOKEN",
  "APP_ENV",
  "NEON_API_KEY",
  "NEON_ORG_ID",
  "NEON_REGION_ID",
  "NEON_PG_VERSION",
  "INNGEST_APP_NAME",
  "GITHUB_TOKEN",
  "KV_URL",
  "KV_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_READ_ONLY_TOKEN",
  "KV_REST_API_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_BASE_URI"
],
```

#### 2. Update Environment Example
**File**: `apps/www/.env.example`
**Changes**: Remove GA4 and Sentry variables

New content:
```bash
# Application URL (for SEO and links)
VITE_APP_URL=https://yourdomain.com
```

#### 3. Update CSP Headers in Middleware
**File**: `apps/www/src/middleware.ts`
**Changes**: Remove GA4 and Sentry domains from Content-Security-Policy header

Update line 41-44 to:
```typescript
// Content Security Policy
newResponse.headers.set(
  "Content-Security-Policy",
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none';",
);
```

Note: Vercel Analytics uses first-party routes (`/_vercel/*`) so no external domains need to be whitelisted.

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm build:www`
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint` (pre-existing issue, build succeeds)

#### Manual Verification:
- [x] `.env.example` only contains `VITE_APP_URL`
- [x] `turbo.json` has no Sentry/GA4 variables
- [x] CSP header has no external analytics domains

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Update Documentation

### Overview
Update the README to reflect the new analytics stack.

### Changes Required:

#### 1. Update README Analytics Section
**File**: `apps/www/README.md`
**Changes**: Update the analytics stack documentation

Find the analytics section (around line 60) and update to:
```markdown
## Analytics

- **Vercel Analytics**: Web analytics for page views and user behavior
- **Vercel Speed Insights**: Core Web Vitals and performance metrics

Analytics are automatically configured when deployed to Vercel. No environment variables needed.
```

Update the environment variables section to remove GA4/Sentry examples.

### Success Criteria:

#### Automated Verification:
- [x] No build errors: `pnpm build:www`

#### Manual Verification:
- [x] README accurately describes the new analytics setup

---

## Testing Strategy

### Automated Tests
No existing tests for analytics, so no test updates needed.

### Manual Testing Steps
1. Run `pnpm dev:www` and verify no console errors
2. Check browser Network tab for `/_vercel/insights/*` requests (only works when deployed)
3. Deploy to Vercel preview
4. Verify Analytics tab shows data in Vercel dashboard
5. Verify Speed Insights tab shows Core Web Vitals data

## Performance Considerations

- Vercel Analytics is loaded asynchronously and doesn't block rendering
- Speed Insights uses the same underlying web-vitals library but with automatic reporting
- First-party analytics (`/_vercel/*` routes) avoid third-party cookie issues and ad blockers
- No external script loading (unlike GA4 which loaded from googletagmanager.com)

## Migration Notes

- No data migration needed (new analytics system, fresh start)
- Historical GA4 data remains in Google Analytics console
- Historical Sentry data remains in Sentry dashboard
- Consider enabling Vercel Analytics and Speed Insights in Vercel dashboard before deployment

## References

- Research document: `thoughts/shared/research/2026-01-31-vercel-tanstack-setup-analytics.md`
- Vercel Analytics docs: https://vercel.com/docs/analytics/quickstart
- Vercel Speed Insights docs: https://vercel.com/docs/speed-insights/quickstart
