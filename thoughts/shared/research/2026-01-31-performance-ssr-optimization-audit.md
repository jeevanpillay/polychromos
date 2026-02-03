---
date: 2026-01-31T21:22:00+11:00
researcher: Claude
git_commit: 5a470df5c1e1ab584fcb4af24de02993f287c7c2
branch: main
repository: x
topic: "Performance and SSR Optimization Audit for Production Deployment"
tags: [research, performance, ssr, tanstack-start, optimization, production]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Performance and SSR Optimization Audit for Production Deployment

**Date**: 2026-01-31T21:22:00+11:00
**Researcher**: Claude
**Git Commit**: 5a470df5c1e1ab584fcb4af24de02993f287c7c2
**Branch**: main
**Repository**: x

## Research Question

Document the current performance and SSR implementation in the TanStack Start application (`apps/www`) to understand what exists before production deployment.

## Summary

The application is a TanStack Start (v1.140.5) site using React 18 with SSR enabled via the `tanstackStart` Vite plugin. It employs prerendering with link crawling for static generation, intent-based route preloading, and Vercel Analytics/Speed Insights for monitoring. The codebase uses a centralized SEO system with JSON-LD structured data, self-hosted custom fonts (Joyride, PP Neue Montreal) plus @fontsource packages, and server functions via `createServerFn` for form submissions.

---

## Detailed Findings

### 1. SSR and Rendering Configuration

#### Entry Point Architecture
The application uses TanStack Start's convention-based entry points—no custom `ssr.tsx` or `client.tsx` files exist. The framework provides defaults from `@tanstack/react-start/src/default-entry/`.

#### Vite Configuration (`apps/www/vite.config.ts:39-44`)
```typescript
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
  },
})
```

- **Prerendering**: Enabled at build time for static HTML generation
- **Link Crawling**: Automatically discovers and prerenders linked routes
- **Plugins**: `tailwindcss()`, `tanstackStart()`, `tsConfigPaths()`, `react()`

#### Root Route Document Structure (`apps/www/src/routes/__root.tsx:51-69`)
```typescript
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <JsonLd code={getWebsiteSchema(env.VITE_APP_URL)} />
        <JsonLd code={getOrganizationSchema(env.VITE_APP_URL)} />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <div className="bg-background relative flex min-h-screen flex-col">
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

- `<HeadContent />` - TanStack Router component that injects route-specific meta tags
- `<JsonLd />` - Custom component for structured data injection
- `<Analytics />` / `<SpeedInsights />` - Vercel monitoring components
- `<Scripts />` - TanStack Router hydration scripts

#### SSR Declaration (`apps/www/src/routeTree.gen.ts:117-122`)
```typescript
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true,
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
```

SSR is explicitly declared as `true` in the auto-generated route tree.

---

### 2. Router Configuration

**File**: `apps/www/src/router.tsx:5-29`

```typescript
export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30000,
    defaultStaleTime: 0,
    defaultGcTime: 1800000,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 500,
    notFoundMode: "fuzzy",
  });
  return router;
}
```

| Setting | Value | Description |
|---------|-------|-------------|
| `scrollRestoration` | `true` | Restores scroll position on navigation |
| `defaultPreload` | `"intent"` | Preloads routes on hover |
| `defaultPreloadDelay` | `50` | 50ms delay before preload triggers |
| `defaultPreloadStaleTime` | `30000` | 30-second cache for preloaded data |
| `defaultStaleTime` | `0` | Always treat data as stale (fresh fetch) |
| `defaultGcTime` | `1800000` | 30-minute garbage collection |
| `defaultPendingMs` | `1000` | Show loading state after 1 second |
| `defaultPendingMinMs` | `500` | Minimum 500ms loading display |
| `notFoundMode` | `"fuzzy"` | Uses nearest parent's notFoundComponent |

---

### 3. SEO and Meta Tag Implementation

#### Centralized SEO Helper (`apps/www/src/lib/seo.ts:19-60`)

The `generateSEO` function returns structured meta and link arrays for TanStack Router's `head()` export:

**Meta tags generated**:
- Charset, viewport, title, description, robots
- Open Graph: type, title, description, image, url, site_name
- Twitter Card: card type, title, description, image, creator
- Theme: theme-color (#000000), color-scheme (dark)

**Links generated**:
- Canonical URL
- SVG favicon
- Apple touch icon

**Defaults**:
- `ogImage`: `${env.VITE_APP_URL}/og-image.png`
- `ogType`: `"website"`
- `robots`: `"index, follow"`
- `twitterHandle`: `"@jeevanpillay"`

#### Route-Level Head Implementation

Each route defines its own `head()` function:

```typescript
// apps/www/src/routes/index.tsx:11-20
export const Route = createFileRoute("/")({
  head: () => {
    const seo = generateSEO({
      title: "Home - Jeevan Pillay Studio",
      description: "Jeevan Pillay is a researcher and founder...",
      canonicalUrl: env.VITE_APP_URL,
      ogType: "website",
    });
    return seo;
  },
  component: HomePage,
});
```

#### Structured Data (JSON-LD)

**Schemas implemented** (`apps/www/src/lib/seo.ts:65-98`):
- `WebSite` schema with author person entity
- `Organization` schema with logo and sameAs social links

**Rendering** (`apps/www/src/routes/__root.tsx:56-57`):
```typescript
<JsonLd code={getWebsiteSchema(env.VITE_APP_URL)} />
<JsonLd code={getOrganizationSchema(env.VITE_APP_URL)} />
```

#### Sitemap Generation (`apps/www/src/routes/sitemap[.]xml.tsx`)

- Custom `loader` function returns XML Response
- Cache-Control header: `public, max-age=3600` (1 hour)
- Static entries defined in `apps/www/src/lib/sitemap.ts:74-87`
- Includes `/` (daily, priority 1.0) and `/about` (monthly, priority 0.8)

---

### 4. Font Loading Architecture

#### Font Sources

| Font | Source | Location |
|------|--------|----------|
| Geist Sans/Mono | @fontsource packages | `node_modules/@fontsource/geist-*` |
| Joyride (STD, ALT, EXT, WIDE) | Self-hosted | `apps/www/public/fonts/joyride/` |
| PP Neue Montreal | Self-hosted | `apps/www/public/fonts/pp-neue-montreal/` |

#### Font Loading Strategy

**@fontsource Geist** (`apps/www/src/routes/__root.tsx:11-12`):
```typescript
import "@fontsource/geist-mono";
import "@fontsource/geist-sans";
```
- Uses `font-display: swap` (defined in package CSS)
- WOFF2 with WOFF fallback

**Joyride** (`packages/ui/src/globals.css:8-34`):
```css
@font-face {
  font-family: "Joyride";
  src: url("/fonts/joyride/JoyrideSTD.woff2") format("woff2"),
       url("/fonts/joyride/JoyrideSTD.woff") format("woff");
  font-weight: normal;
  font-style: normal;
}
```
- **No `font-display` declaration** (defaults to `auto`)
- Includes 16 WOFF2 + 16 WOFF variants

**PP Neue Montreal** (`apps/www/src/styles/fonts.css:9-55`):
```css
@font-face {
  font-family: "PP Neue Montreal";
  src: url("/fonts/pp-neue-montreal/PPNeueMontreal-Thin.woff2") format("woff2");
  font-weight: 100;
  font-style: normal;
  font-display: swap;
}
```
- Uses `font-display: swap`
- 6 weights (100, 400, 500, 600, 700, italic)
- WOFF2 only (no WOFF fallback)

#### Font File Count
- Joyride: 32 files (16 WOFF2 + 16 WOFF)
- PP Neue Montreal: 6 WOFF2 files
- @fontsource: Multiple weights bundled from node_modules

#### Preloading Status
**No font preloading configured**. The SEO helper (`lib/seo.ts:54-58`) only includes canonical, favicon, and apple-touch-icon links.

---

### 5. Component Performance Patterns

#### Client Directive Usage

Only one app component uses `"use client"`:
- **MelbourneTime** (`apps/www/src/components/melbourne-time.tsx:1`)

UI package client components:
- Lissajous, HtmlSvgConverter, Form, Dialog, Carousel, Chart, useToast

#### State Management

| Component | useState Hooks | Purpose |
|-----------|---------------|---------|
| HomePage | 1 | `contactOpen` dialog state |
| ContactDialog | 2 | `isSubmitting`, `submitStatus` |
| MelbourneTime | 1 | `time` string updated every second |
| HtmlSvgConverter | 9 | Form control states |

#### Memoization Usage

**useMemo** (found in UI package):
- `Lissajous` (`packages/ui/src/components/lissajous.tsx:48-72`) - Memoizes SVG path calculation
- `ChartTooltipContent` (`packages/ui/src/components/ui/chart.tsx:136-170`) - Memoizes tooltip label

**useCallback** (found in UI package):
- `Carousel` (`packages/ui/src/components/ui/carousel.tsx:70-98`) - 4 callbacks for scroll/keyboard handlers

**React.memo**: Not used in application code

#### Dynamic Imports / Lazy Loading
**Not implemented**. The codebase relies on TanStack Router's intent-based preloading instead of React.lazy or dynamic imports.

#### MelbourneTime Implementation (`apps/www/src/components/melbourne-time.tsx`)
- Uses `setInterval(updateTime, 1000)` for real-time updates
- `suppressHydrationWarning` on render to prevent SSR mismatch
- Cleanup via `clearInterval` in useEffect return

---

### 6. Server Functions and Data Fetching

#### Server Function Pattern (`apps/www/src/functions/contact.ts:18-47`)

```typescript
export const sendContactEmail = createServerFn({ method: "POST" })
  .inputValidator((data: ContactFormData) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    const { error } = await resend.emails.send({...});
    if (error) throw new Error("Failed to send email. Please try again.");
    return { success: true };
  });
```

- Uses `createServerFn` from `@tanstack/react-start`
- Zod validation via `.inputValidator()`
- Server-only execution with Resend API

#### Route Loader Pattern (`apps/www/src/routes/sitemap[.]xml.tsx:24-34`)

```typescript
export async function loader() {
  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

- Returns custom Response object
- Sets cache headers directly

#### No TanStack Query
The codebase does not use TanStack Query. Data fetching uses:
1. TanStack Router's `loader` / `beforeLoad`
2. TanStack Start's `createServerFn`
3. Router-level caching configuration

---

### 7. Vercel Analytics and Deployment

#### Analytics Packages (`apps/www/package.json:23-24`)
```json
"@vercel/analytics": "^1.5.0",
"@vercel/speed-insights": "^1.2.0"
```

#### Integration (`apps/www/src/routes/__root.tsx:63-64`)
```typescript
<Analytics />
<SpeedInsights />
```

Both components:
- Require no configuration or API keys
- Auto-activate when deployed to Vercel
- Use first-party routes (`/_vercel/insights/*`)
- Load asynchronously to avoid blocking

#### Environment Variables

**URL Resolution** (`apps/www/src/env.ts:4-7`):
1. `VITE_APP_URL` (explicit)
2. `https://${VERCEL_URL}` (Vercel auto-provided)
3. `http://localhost:3000` (development fallback)

**Turborepo Pass-Through** (`turbo.json:73-80`):
- `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `NODE_ENV`, `CI`

#### Build Output
- Output directory: `.output/` (TanStack Start default)
- Start command: `node .output/server/index.mjs`
- No `vercel.json` file (auto-detection)

---

### 8. Middleware Configuration

**File**: `apps/www/src/middleware.ts`

```typescript
// Line 11
headers.set("X-DNS-Prefetch-Control", "on");
```

DNS prefetch control is enabled, but no specific DNS prefetch links are configured for external resources.

---

## Code References

### SSR Configuration
- `apps/www/vite.config.ts:39-44` - TanStack Start plugin with prerender config
- `apps/www/src/routeTree.gen.ts:117-122` - SSR declaration
- `apps/www/src/routes/__root.tsx:51-69` - Root document structure

### Router Settings
- `apps/www/src/router.tsx:5-29` - Router configuration with caching

### SEO System
- `apps/www/src/lib/seo.ts:19-60` - generateSEO function
- `apps/www/src/lib/seo.ts:65-98` - JSON-LD schemas
- `apps/www/src/components/json-ld.tsx:28-35` - JsonLd component

### Font Loading
- `apps/www/src/routes/__root.tsx:11-12` - @fontsource imports
- `packages/ui/src/globals.css:8-34` - Joyride @font-face declarations
- `apps/www/src/styles/fonts.css:9-55` - PP Neue Montreal declarations

### Component Performance
- `apps/www/src/components/melbourne-time.tsx:1-37` - Real-time client component
- `packages/ui/src/components/lissajous.tsx:48-72` - useMemo example
- `packages/ui/src/components/ui/carousel.tsx:70-98` - useCallback examples

### Server Functions
- `apps/www/src/functions/contact.ts:18-47` - createServerFn pattern
- `apps/www/src/routes/sitemap[.]xml.tsx:24-34` - Route loader with cache headers

### Analytics
- `apps/www/src/routes/__root.tsx:63-64` - Vercel components
- `apps/www/src/env.ts:4-7` - URL resolution with Vercel fallback

---

## Architecture Documentation

### Current Patterns

1. **SSR with Prerendering**: TanStack Start handles SSR automatically with static generation at build time via `prerender.enabled: true` and `crawlLinks: true`.

2. **Intent-Based Preloading**: Routes preload on hover (`defaultPreload: "intent"`) with 50ms delay and 30-second cache.

3. **Centralized SEO**: Single `generateSEO` function ensures consistent meta tags across routes with per-route customization via `head()` exports.

4. **Self-Hosted Fonts**: Custom fonts served from `/public/fonts/` with varying `font-display` strategies.

5. **Server Functions**: Form submissions use `createServerFn` for type-safe RPC-style server calls.

6. **Zero-Config Analytics**: Vercel Analytics and Speed Insights require no configuration when deployed.

### Build Pipeline
1. Turborepo orchestrates builds (`pnpm build:www`)
2. Vite builds with TanStack Start plugin
3. Prerendering crawls and generates static HTML
4. Output to `.output/server/` and `.output/client/`
5. Vercel deploys from `.output/`

---

## Related Research

- `thoughts/shared/research/2026-01-31-vercel-tanstack-setup-analytics.md` - Vercel configuration details
- `thoughts/shared/research/2026-01-31-tanstack-start-router-production-setup.md` - Router setup patterns
- `thoughts/shared/research/2026-01-31-t3-oss-env-vite-vercel.md` - Environment variable handling

---

## Open Questions

1. **Font Preloading**: Should critical fonts (Joyride, PP Neue Montreal) be preloaded via `<link rel="preload">`?

2. **Joyride font-display**: The Joyride @font-face declarations lack `font-display: swap` - is this intentional?

3. **WOFF Fallbacks**: PP Neue Montreal only has WOFF2 files - is WOFF fallback needed for older browser support?

4. **Code Splitting**: No React.lazy or dynamic imports are used - would route-level code splitting improve initial load?

5. **robots.txt Sitemap URL**: The sitemap URL in `public/robots.txt` is `https://yourdomain.com/sitemap.xml` - needs update to actual domain.

6. **TanStack Query**: Should TanStack Query be added for more sophisticated client-side caching if the app grows?
