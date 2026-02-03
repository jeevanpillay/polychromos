---
date: 2026-01-31T12:00:00+08:00
researcher: Claude
git_commit: 463e024ab057bb1fc09b2ac24b9f70e0ac184589
branch: main
repository: x
topic: "Vercel TanStack Setup for Analytics and Important Configurations"
tags: [research, codebase, tanstack-start, vercel, analytics, sentry, ga4, web-vitals, turborepo]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Vercel TanStack Setup for Analytics and Important Configurations

**Date**: 2026-01-31T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 463e024ab057bb1fc09b2ac24b9f70e0ac184589
**Branch**: main
**Repository**: x

## Research Question

Research into Vercel TanStack setup for analytics and all the important things needed.

## Summary

This codebase is a Turborepo monorepo using **TanStack Start 1.157.17** with **Vite 7** as the build tool, optimized for **Vercel deployment**. The analytics stack consists of three integrated systems: **Google Analytics 4** for user behavior tracking, **Sentry** for error monitoring and session replay, and **Web Vitals** for Core Web Vitals performance metrics. All analytics are initialized in the root component with graceful degradation when environment variables are missing.

## Detailed Findings

### 1. TanStack Start Configuration

#### Primary Config File
**Location**: `apps/www/vite.config.ts`

```typescript
// Lines 13-18: TanStack Start plugin with prerendering
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
  },
})
```

**Key Settings**:
- **Prerendering enabled** (line 15): Generates static HTML at build time
- **Crawl links enabled** (line 16): Automatically discovers and prerenders all linked pages
- **Port**: 3000 (line 9)
- **SSR mode**: Enabled by default (declared in `routeTree.gen.ts:83`)

#### Router Configuration
**Location**: `apps/www/src/router.tsx`

```typescript
// Lines 5-11
export const getRouter = memoise(() =>
  createRouter({
    routeTree,
    scrollRestoration: true,
  }),
);
```

- Uses auto-generated route tree from `./routeTree.gen`
- Scroll restoration enabled for SPA navigation

#### File-Based Routing
**Location**: `apps/www/src/routes/`

Routes discovered:
- `__root.tsx` - Root layout with analytics initialization
- `index.tsx` - Home page (`/`)
- `about.tsx` - About page (`/about`)
- `$404.tsx` - 404 error page with SEO noindex
- `$500.tsx` - 500 error page with SEO noindex
- `sitemap[.]xml.tsx` - Dynamic sitemap generation

### 2. Vercel Deployment Configuration

#### No `vercel.json` File
The project relies on Vercel's auto-detection. Configuration is handled through:

1. **Turborepo global pass-through env vars** (`turbo.json:78-85`):
   ```json
   "globalPassThroughEnv": [
     "NODE_ENV",
     "CI",
     "VERCEL",
     "VERCEL_ENV",
     "VERCEL_URL",
     "npm_lifecycle_event"
   ]
   ```

2. **Vercel storage env vars** (`turbo.json:68-76`):
   - `KV_URL`, `KV_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Vercel KV)
   - `BLOB_READ_WRITE_TOKEN`, `BLOB_BASE_URI` (Vercel Blob)

3. **Vercel link script** (`package.json:24`):
   ```bash
   pnpm vercel:link  # runs: vercel link --repo
   ```

#### Deployment Instructions
**Location**: `README.md:106-115`

1. Connect GitHub repository to Vercel
2. Set root directory as project root
3. Build command: `pnpm build:www`
4. Deploy

### 3. Analytics Implementation

#### 3.1 Google Analytics 4
**Location**: `apps/www/src/lib/analytics.ts`

**Initialization** (lines 18-49):
```typescript
export function initGA4(): void {
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  // Creates script tag, initializes dataLayer and gtag
}
```

**Features**:
- `trackPageView(url)` - Page view tracking (lines 54-65)
- `trackEvent(eventName, eventData)` - Custom event tracking (lines 70-81)
- `setUserId(userId)` - User identification (lines 86-96)
- `setUserProperties(properties)` - User properties (lines 101-109)

**Environment Variable**: `VITE_GA4_MEASUREMENT_ID`

#### 3.2 Sentry Error Tracking
**Location**: `apps/www/src/lib/sentry.ts`

**Configuration** (lines 25-46):
```typescript
Sentry.init({
  dsn,
  environment,
  tracesSampleRate: environment === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: environment === "production" ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
});
```

**Features**:
- Browser tracing integration for performance monitoring
- Session replay integration (10% in prod, 100% in dev)
- 100% error capture on error scenarios
- `captureException(error)` - Error capture (lines 54-68)
- `captureMessage(message, level)` - Message capture (lines 73-83)
- `setUser(userId, email, username)` - User context (lines 88-98)

**Environment Variable**: `VITE_SENTRY_DSN`

#### 3.3 Web Vitals
**Location**: `apps/www/src/lib/web-vitals.ts`

**Metrics Tracked** (lines 72-90):
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)
- FID (First Input Delay)
- LCP (Largest Contentful Paint)
- TTFB (Time to First Byte)
- INP (Interaction to Next Paint)

**Dual Reporting**:
- Metrics sent to GA4 via `trackEvent("web_vitals", {...})` (lines 31-45)
- Metrics sent to Sentry via `captureMessage()` (lines 13-26)

**Package**: `web-vitals` v5.1.0

#### 3.4 Analytics Initialization
**Location**: `apps/www/src/routes/__root.tsx:53-72`

```typescript
useEffect(() => {
  initSentry();
  initGA4();
  reportWebVitals();

  trackPageView(window.location.pathname);

  const handleRouteChange = () => {
    trackPageView(window.location.pathname);
  };
  window.addEventListener("popstate", handleRouteChange);

  return () => window.removeEventListener("popstate", handleRouteChange);
}, []);
```

### 4. Environment Variables

#### Required for Analytics
**Location**: `apps/www/.env.example`

```bash
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_APP_URL=https://yourdomain.com
```

#### Full Environment Configuration
**Location**: `turbo.json:40-75`

| Category | Variables |
|----------|-----------|
| Analytics | `VITE_SENTRY_DSN`, `VITE_GA4_MEASUREMENT_ID`, `VITE_APP_URL`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` |
| Sentry Build | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |
| Database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| AI Services | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `BRAINTRUST_API_KEY` |
| Auth | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` |
| Infrastructure | `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `ARCJET_KEY`, `NEON_API_KEY` |
| Storage | `KV_URL`, `KV_TOKEN`, `BLOB_READ_WRITE_TOKEN` |
| Logging | `LOGTAIL_SOURCE_TOKEN` |

**Naming Convention**:
- `VITE_*` prefix: Exposed to client-side code
- No prefix: Server-only (not exposed to browser)

### 5. Build Pipeline

#### Turborepo Tasks
**Location**: `turbo.json:4-38`

| Task | Dependencies | Outputs |
|------|--------------|---------|
| `build` | `^build` | `.cache/tsbuildinfo.json`, `dist/**`, `.output/**` |
| `dev` | `^dev` | Persistent, no cache |
| `lint` | `^topo`, `^build` | `.cache/.eslintcache` |
| `typecheck` | `^topo`, `^build` | `.cache/tsbuildinfo.json` |
| `format` | - | `.cache/.prettiercache` |

#### Build Commands
**Location**: `package.json`

```bash
pnpm build        # Build all packages
pnpm build:www    # Build www app only (turbo run build -F @repo/www)
pnpm dev          # Development mode
pnpm dev:www      # www dev with watch mode
pnpm typecheck    # TypeScript checking
pnpm lint         # ESLint
pnpm format       # Prettier check
```

#### Build Output
- Server bundle: `.output/server/index.mjs`
- Static assets: `.output/**`
- Start command: `node .output/server/index.mjs`

### 6. Security Headers
**Location**: `apps/www/src/middleware.ts:16-44`

| Header | Value |
|--------|-------|
| HSTS | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Restricts camera, microphone, geolocation, payment |

**CSP Whitelisted Domains**:
- Scripts: `https://www.googletagmanager.com`, `https://www.google-analytics.com`
- Connections: `https://*.sentry.io`, GA domains

### 7. SEO Configuration
**Location**: `apps/www/src/lib/seo.ts`

**Features**:
- `generateSEO()` - Generates meta tags (lines 27-56)
- `getWebsiteSchema()` - JSON-LD WebSite schema (lines 61-75)
- `getOrganizationSchema()` - JSON-LD Organization schema (lines 80-96)

**Sitemap Generation**:
**Location**: `apps/www/src/routes/sitemap[.]xml.tsx`
- Dynamic route at `/sitemap.xml`
- Uses `generateSitemapXML()` from `~/lib/sitemap`
- Cached for 1 hour via Cache-Control header

## Code References

### Configuration Files
- `apps/www/vite.config.ts` - Vite and TanStack Start config
- `apps/www/src/router.tsx` - Router setup
- `turbo.json` - Turborepo build orchestration
- `pnpm-workspace.yaml` - Workspace and catalog definitions

### Analytics Files
- `apps/www/src/lib/analytics.ts` - Google Analytics 4 implementation
- `apps/www/src/lib/sentry.ts` - Sentry error tracking
- `apps/www/src/lib/web-vitals.ts` - Core Web Vitals reporting
- `apps/www/src/routes/__root.tsx` - Analytics initialization

### SEO Files
- `apps/www/src/lib/seo.ts` - SEO utilities and JSON-LD schemas
- `apps/www/src/lib/sitemap.ts` - Sitemap generation
- `apps/www/src/routes/sitemap[.]xml.tsx` - Sitemap route

### Environment Files
- `.env.example` - Root environment template
- `apps/www/.env.example` - App-specific template

## Architecture Documentation

### Data Flow

1. **Application Load**:
   - `RootComponent` mounts → `useEffect` executes
   - `initSentry()` → Sentry SDK initialized with DSN
   - `initGA4()` → GA4 script loaded, gtag configured
   - `reportWebVitals()` → CWV listeners registered
   - Initial `trackPageView()` sent

2. **Route Navigation**:
   - Browser `popstate` event fires
   - `handleRouteChange()` callback executes
   - `trackPageView(window.location.pathname)` sent to GA4

3. **Web Vitals**:
   - Browser reports metric (LCP, FID, CLS, etc.)
   - `reportMetric()` receives data
   - Dual send: `sendToGA4()` + `sendToSentry()`

4. **Error Handling**:
   - Error occurs in application
   - `captureException(error)` called
   - Sentry receives with full context

### Key Patterns

- **Graceful Degradation**: Missing env vars log warnings, don't crash
- **Lazy Initialization**: Analytics check flags before operations
- **Dual Reporting**: Web Vitals sent to both GA4 and Sentry
- **Type Safety**: TypeScript types for all analytics functions
- **Error Boundaries**: All tracking wrapped in try-catch

## What's NOT Included

- **Vercel Analytics**: `@vercel/analytics` package not installed
- **Vercel Speed Insights**: `@vercel/speed-insights` package not installed
- **PostHog**: Env vars defined but not implemented
- **Environment validation**: No Zod schemas for env vars
- **Custom TypeScript env types**: No `ImportMetaEnv` interface defined

## Open Questions

1. Should Vercel Analytics be added for deployment-aware metrics?
2. Should environment variables have Zod validation?
3. Is PostHog integration planned (env vars exist but no implementation)?
4. Should custom TypeScript types be added for `import.meta.env`?
