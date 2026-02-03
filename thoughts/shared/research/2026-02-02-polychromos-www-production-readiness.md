---
date: 2026-02-02T19:15:26+08:00
researcher: Claude
git_commit: abbd13a70efe2adae2ac4617a7c80bb18c15daee
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos WWW Production Readiness: TanStack SSR, Performance, Security"
tags: [research, polychromos-www, production, ssr, tanstack-start, performance, security, lighthouse]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
last_updated_note: "Added follow-up research for SEO and Analytics production readiness"
---

# Research: Polychromos WWW Production Readiness

**Date**: 2026-02-02T19:15:26+08:00
**Researcher**: Claude
**Git Commit**: abbd13a70efe2adae2ac4617a7c80bb18c15daee
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Analyze production readiness of `apps/polychromos-www/` focusing on: TanStack SSR, Lighthouse/speed/performance, middleware, and security.

## Summary

The `polychromos-www` application is a TanStack Start SSR landing page with a Clerk waitlist form. The implementation demonstrates solid patterns for SSR, performance optimization, and security fundamentals. The app is **production-ready for its current scope** (landing page with waitlist form).

### Production Readiness Matrix

| Category | Status | Notes |
|----------|--------|-------|
| **TanStack SSR** | ✅ CONFIGURED | Nitro 3.0.1-alpha.0, intent preloading, scroll restoration |
| **Build** | ✅ PASSING | Vite build completes, Nitro server bundle generated |
| **Performance** | ✅ OPTIMIZED | Image optimization, font-display: swap, preloading |
| **Security** | ✅ FUNDAMENTALS | Type-safe env vars, server-side secrets, input validation |
| **Middleware** | ⚪ NONE | No custom middleware configured |
| **Security Headers** | ⚠️ MISSING | No CSP, HSTS, or custom headers configured |

---

## Detailed Findings

### 1. TanStack Start SSR Configuration

#### Stack Overview
- **Framework**: TanStack Start (catalog version from workspace)
- **Server**: Nitro 3.0.1-alpha.0 (alpha version)
- **Build Tool**: Vite 7
- **React**: React 19 (catalog:react19)

#### Vite Plugin Chain (`vite.config.ts:13-26`)

```typescript
plugins: [
  viteTsConfigPaths({ projects: ["./tsconfig.json"] }),  // Path aliases
  tailwindcss(),                                         // Tailwind v4
  tanstackStart(),                                       // SSR framework
  nitro(),                                               // Server runtime
  viteReact(),                                           // React JSX
  ViteImageOptimizer({ png: 80, jpeg: 80, webp: 80 }),  // Image compression
]
```

The SSR configuration is zero-config - both `tanstackStart()` and `nitro()` are called without options, relying on sensible defaults.

#### Router Configuration (`router.tsx:5-28`)

| Setting | Value | Purpose |
|---------|-------|---------|
| `scrollRestoration` | `true` | Restore scroll position on navigation |
| `defaultPreload` | `"intent"` | Preload on hover |
| `defaultPreloadDelay` | `50ms` | Delay before starting preload |
| `defaultPreloadStaleTime` | `30s` | Cache duration for preloaded data |
| `defaultStaleTime` | `0` | Data always treated as stale |
| `defaultGcTime` | `30min` | Garbage collection timeout |
| `defaultPendingMs` | `1000ms` | Show loading after 1 second |
| `defaultPendingMinMs` | `500ms` | Minimum loading display time |
| `notFoundMode` | `"fuzzy"` | Use nearest parent's 404 handler |

#### SSR Document Shell (`routes/__root.tsx:44-56`)

```typescript
function RootDocument({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- `<HeadContent />` collects and injects meta tags from route tree
- `<Scripts />` injects hydration scripts at end of body
- HTML has `lang="en"` for accessibility
- Dark mode enabled by default via `className="dark"`

#### Build Output (`package.json:12`)

Production server: `node .output/server/index.mjs`

---

### 2. Performance Configuration

#### Image Optimization (`vite.config.ts:21-25`)

```typescript
ViteImageOptimizer({
  png: { quality: 80 },
  jpeg: { quality: 80 },
  webp: { quality: 80 },
})
```

All images compressed to 80% quality at build time.

#### Font Loading Strategy

**@fontsource Packages** (`__root.tsx:9-10`):
- `@fontsource/geist-mono` v5.1.1
- `@fontsource/geist-sans` v5.1.1

**Custom Fonts** (`styles/fonts.css`):

| Font Family | Weights | Format | Strategy |
|-------------|---------|--------|----------|
| HW Animo Semi Expanded | 400 | woff2, woff | `font-display: swap` |
| HW Animo Semi Condensed Outline | 400 | woff2, woff | `font-display: swap` |
| PP Neue Montreal | 100, 400, 500, 600, 700 | woff2 only | `font-display: swap` |

All custom fonts use `font-display: swap` to prevent FOIT (Flash of Invisible Text).

**Font Asset Count**: 54 font files in `public/fonts/`:
- 44 HW Animo variants (woff + woff2)
- 6 PP Neue Montreal variants (woff2)
- 8 Joyride variants (woff + woff2, unused)

#### Preloading Configuration

Intent-based preloading (`router.tsx:13-15`):
- Preloads route data when user hovers over links
- 50ms delay prevents unnecessary preloads on quick mouse movements
- 30-second cache for preloaded data

#### Caching Strategy (`router.tsx:18-19`)

- `defaultStaleTime: 0` - Always refetch on navigation (fresh data)
- `defaultGcTime: 1800000` - Keep cached data for 30 minutes in memory

#### Loading State UX (`router.tsx:22-23`)

- 1-second delay before showing loading state (avoids flash for fast navigations)
- Minimum 500ms display time (prevents jarring quick flashes)

---

### 3. Security Implementation

#### Environment Variable Protection (`env.ts`)

**Type-Safe Validation** using `@t3-oss/env-core`:

```typescript
export const env = createEnv({
  extends: [vercel()],
  clientPrefix: "VITE_",
  shared: { NODE_ENV: z.enum(["development", "production", "test"]) },
  server: { CLERK_SECRET_KEY: z.string().min(1) },
  client: { VITE_APP_URL: z.string().url() },
});
```

| Variable | Scope | Validation |
|----------|-------|------------|
| `NODE_ENV` | Shared | Enum: development, production, test |
| `CLERK_SECRET_KEY` | Server only | Non-empty string |
| `VITE_APP_URL` | Client safe | Valid URL |

**Client Prefix**: Only variables prefixed with `VITE_` are accessible in browser code.

**Validation Bypass**: Skipped in CI, lint, and build lifecycle events to allow type checking without secrets.

#### Server Function Security (`functions/waitlist.ts`)

**RPC Boundary** using `createServerFn`:

```typescript
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,  // Server-only
      },
      body: JSON.stringify({ email_address: data.email }),
    });
  });
```

**Security Properties**:
1. **Method restriction**: POST only
2. **Input validation**: Zod schema validates before handler
3. **Secret isolation**: `CLERK_SECRET_KEY` never sent to client
4. **Error sanitization**: Generic error message ("Failed to join waitlist") - no sensitive details leaked

#### Input Validation (`functions/waitlist.ts:6-8`)

```typescript
export const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});
```

Validation runs on both client (form UX) and server (security boundary).

---

### 4. Middleware Configuration

**Status**: No custom middleware exists.

**Evidence**:
- No files matching `*middleware*` pattern
- No `nitro.config.ts` file
- No custom headers in `vite.config.ts`
- No `.vercel/vercel.json` with headers configuration

The application relies entirely on TanStack Start and Nitro defaults.

---

### 5. Security Headers (Missing)

**Current Head Configuration** (`__root.tsx:21-29`):

```typescript
head: () => ({
  meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title: "Polychromos" },
    { name: "description", content: "Code-driven design platform" },
  ],
  links: [{ rel: "icon", href: "/favicon.svg" }],
})
```

**Missing Security Headers**:

| Header | Status | Impact |
|--------|--------|--------|
| `Content-Security-Policy` | ❌ Missing | XSS protection |
| `Strict-Transport-Security` | ❌ Missing | HTTPS enforcement |
| `X-Frame-Options` | ❌ Missing | Clickjacking protection |
| `X-Content-Type-Options` | ❌ Missing | MIME sniffing protection |
| `Referrer-Policy` | ❌ Missing | Referrer leakage |
| `Permissions-Policy` | ❌ Missing | Feature restrictions |

---

### 6. Route Structure

| File | Path | Component |
|------|------|-----------|
| `routes/__root.tsx` | Shell | `RootDocument` with `<Outlet />` |
| `routes/index.tsx` | `/` | `HomePage` (landing page with waitlist form) |
| `routes/$.tsx` | `/*` | `CustomNotFoundComponent` (404 catch-all) |

**Route Tree** (`routeTree.gen.ts`):
- Auto-generated by TanStack Router plugin
- Declares `ssr: true` at type level
- Should not be manually edited

---

### 7. Error Handling

**Root-Level Boundaries** (`__root.tsx:30-32`):

```typescript
errorComponent: (props) => <CustomErrorComponent {...props} />,
notFoundComponent: () => <CustomNotFoundComponent />,
pendingComponent: () => <LoadingComponent />,
```

**Error Component** (`components/error-component.tsx`):
- Shows error details only in development mode (`env.NODE_ENV === "development"`)
- Production users see generic "Something went wrong" message
- Provides "Try Again" (router.invalidate) and "Go Home" actions

**Loading Component** (`components/loading-component.tsx`):
- Animated dots loader with inline CSS keyframes
- Self-contained styling to avoid external CSS blocking

---

### 8. CSS Architecture

**Import Order** (`__root.tsx:9-18`):
1. @fontsource packages (Geist fonts)
2. Custom fonts CSS (`~/styles/fonts.css`)
3. App CSS (`../styles/app.css`)

**App CSS** (`styles/app.css`):
```css
@import "tailwindcss";
@import "@polychromos/ui/globals.css";

.dark { /* Color variable overrides */ }
```

**Design Tokens** (oklch color space):
- Uses OKLCH color format for perceptually uniform colors
- Custom dark mode palette with 14 CSS variables
- Example: `--background: oklch(0.145 0 0)` (near black)

---

## Lighthouse Considerations

### Positive Factors

1. **SSR**: Full HTML sent on first request
2. **Font Display Swap**: Text immediately visible
3. **Image Optimization**: Build-time compression
4. **Minimal JS**: Landing page has minimal interactivity
5. **Dark Mode Default**: Lower power consumption on OLED

### Potential Issues

1. **Font Count**: 54 font files (though only ~8 used in practice)
2. **Nitro Alpha**: Using 3.0.1-alpha.0 (stability risk)
3. **No Resource Hints**: Missing preconnect for api.clerk.com
4. **No Security Headers**: Would fail security audit

### Estimated Lighthouse Impact

| Metric | Expected | Notes |
|--------|----------|-------|
| Performance | 85-95 | SSR + optimized images |
| Accessibility | 90+ | Dark mode, lang="en", semantic HTML |
| Best Practices | 70-80 | Missing security headers |
| SEO | 90+ | Meta tags present, semantic structure |

---

## Code References

- `apps/polychromos-www/vite.config.ts:1-27` - Vite configuration with SSR plugins
- `apps/polychromos-www/src/router.tsx:1-35` - Router configuration with preloading
- `apps/polychromos-www/src/routes/__root.tsx:1-56` - Root route with SSR document shell
- `apps/polychromos-www/src/env.ts:1-35` - Type-safe environment variables
- `apps/polychromos-www/src/functions/waitlist.ts:1-34` - Secure server function
- `apps/polychromos-www/src/styles/fonts.css:1-97` - Font definitions
- `apps/polychromos-www/src/styles/app.css:1-24` - Tailwind + dark mode

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-02-polychromos-production-readiness-assessment.md` - Overall MVP production readiness (focuses on polychromos-app, not www)
- `thoughts/shared/research/2026-02-02-polychromos-www-clerk-waitlist-form-integration.md` - Clerk waitlist integration research
- `thoughts/shared/plans/2026-02-02-polychromos-www-clerk-waitlist-integration.md` - Waitlist implementation plan

## Related Research

- `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md` - Authentication patterns
- `thoughts/shared/research/2026-02-02-polychromos-tanstack-start-setup.md` - TanStack Start setup

## Open Questions

1. **Nitro Version**: Is 3.0.1-alpha.0 stable enough for production?
2. **Font Subsetting**: Are all 54 font files needed? Could subset to reduce payload?
3. **Security Headers**: Should these be added via Vercel config or Nitro middleware?
4. **Preconnect**: Should add `<link rel="preconnect" href="https://api.clerk.com">` for waitlist form?
5. **Unused Fonts**: Joyride fonts in public/fonts/ appear unused - can they be removed?

---

## Follow-up Research: SEO & Analytics Production Readiness

**Date**: 2026-02-02T22:15:00+08:00

### SEO Implementation Status

#### Current SEO Meta Tags (`routes/__root.tsx:21-29`)

| Tag | Value | Status |
|-----|-------|--------|
| `charset` | utf-8 | ✅ Present |
| `viewport` | width=device-width, initial-scale=1 | ✅ Present |
| `title` | "Polychromos" | ✅ Present |
| `description` | "Code-driven design platform" | ✅ Present |
| `lang` | "en" (on html element) | ✅ Present |
| `favicon` | /favicon.svg | ✅ Present |

#### Missing SEO Elements

| Element | Status | Impact |
|---------|--------|--------|
| **Open Graph tags** | ❌ Missing | Social media sharing preview |
| **Twitter Card tags** | ❌ Missing | Twitter/X sharing preview |
| **Canonical URL** | ❌ Missing | Duplicate content prevention |
| **robots.txt** | ❌ Missing | Search engine crawl directives |
| **sitemap.xml** | ❌ Missing | Search engine discovery |
| **JSON-LD structured data** | ❌ Missing | Rich snippets |
| **apple-touch-icon** | ❌ Missing | iOS home screen icon |
| **og:image** | ❌ Missing | Social sharing image |
| **theme-color** | ❌ Missing | Browser chrome color |

#### robots.txt Status
- **File exists**: No
- **Location expected**: `public/robots.txt`
- **Current behavior**: Search engines will crawl everything by default

#### sitemap.xml Status
- **File exists**: No
- **Location expected**: `public/sitemap.xml`
- **Current routes to index**: Only `/` (homepage)

---

### Analytics Implementation Status

#### Current Analytics Integration

| Tool | Status | Evidence |
|------|--------|----------|
| **Google Analytics 4** | ❌ Not implemented | No `gtag.js` or GA4 measurement ID |
| **Google Tag Manager** | ❌ Not implemented | No GTM container script |
| **Meta Pixel (Facebook)** | ❌ Not implemented | No fbq script |
| **Plausible** | ❌ Not implemented | No plausible script |
| **PostHog** | ❌ Not implemented | No posthog-js |
| **Vercel Analytics** | ❌ Not implemented | No @vercel/analytics |
| **Vercel Speed Insights** | ❌ Not implemented | No @vercel/speed-insights |
| **Clerk Analytics** | ⚪ Via API | Waitlist entries tracked in Clerk dashboard |

#### Analytics Search Results
- Grep for `analytics`, `gtag`, `gtm`, `pixel`, `posthog`, `plausible` returned no matches
- No analytics-related packages in `package.json`

---

### SEO Technical Implementation Details

#### HTML Structure Analysis (`routes/index.tsx`)

**Heading Hierarchy**:
- `<h1>` at lines 172-201: "DESIGN IS NO LONGER STATIC PIXELS. IT IS EXECUTABLE LOGIC."
  - This is decorative typography at the bottom of the page
  - Primary value proposition is in a `<p>` tag at line 83-88, not a heading

**Semantic HTML**:
- ✅ `<header>` used for navigation (line 55)
- ✅ `<main>` used for content (line 77)
- ⚠️ No `<footer>` element
- ⚠️ Hero value proposition uses `<p>` not `<h1>`
- ⚠️ No `<nav>` wrapper for navigation links

**Alt Text for Images**:
- No images on the landing page (text-only design)
- Favicon is SVG with no alt (expected)

#### URL Structure
- Single page app with only `/` route
- 404 catch-all at `routes/$.tsx`
- Clean URLs (no trailing slashes, no hash routing)

---

### Social Sharing Preview Status

#### Open Graph Tags (Missing)

Expected for proper social sharing:
```html
<meta property="og:title" content="Polychromos">
<meta property="og:description" content="Code-driven design platform">
<meta property="og:image" content="https://polychromos.design/og-image.png">
<meta property="og:url" content="https://polychromos.design">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Polychromos">
```

#### Twitter Card Tags (Missing)

Expected for Twitter/X sharing:
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Polychromos">
<meta name="twitter:description" content="Code-driven design platform">
<meta name="twitter:image" content="https://polychromos.design/twitter-card.png">
```

---

### Favicon & PWA Status

#### Current Favicon (`public/favicon.svg`)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0a0a0a"/>
  <text x="50" y="70" font-family="system-ui, sans-serif"
        font-size="60" font-weight="bold" text-anchor="middle"
        fill="#fafafa">P</text>
</svg>
```

| Asset | Status | Notes |
|-------|--------|-------|
| `favicon.svg` | ✅ Present | Simple "P" on dark background |
| `favicon.ico` | ❌ Missing | Legacy browser support |
| `apple-touch-icon.png` | ❌ Missing | iOS home screen |
| `android-chrome-*.png` | ❌ Missing | Android home screen |
| `manifest.json` | ❌ Missing | PWA manifest |
| `browserconfig.xml` | ❌ Missing | Windows tile |

---

### SEO & Analytics Checklist Summary

#### SEO Checklist

| Item | Status | Priority |
|------|--------|----------|
| Basic meta tags (title, description) | ✅ Done | - |
| Viewport meta tag | ✅ Done | - |
| HTML lang attribute | ✅ Done | - |
| SVG favicon | ✅ Done | - |
| Open Graph meta tags | ❌ Missing | High |
| Twitter Card meta tags | ❌ Missing | High |
| Canonical URL | ❌ Missing | Medium |
| robots.txt | ❌ Missing | Medium |
| sitemap.xml | ❌ Missing | Low (single page) |
| JSON-LD structured data | ❌ Missing | Low |
| Multi-size favicons | ❌ Missing | Low |
| H1 for primary value prop | ⚠️ Misused | Medium |

#### Analytics Checklist

| Item | Status | Priority |
|------|--------|----------|
| Any analytics platform | ❌ Missing | High |
| Waitlist conversion tracking | ⚠️ Partial | Medium |
| Error tracking (Sentry, etc) | ❌ Missing | Medium |
| Performance monitoring | ❌ Missing | Low |

---

### Code References (SEO & Analytics Focus)

- `apps/polychromos-www/src/routes/__root.tsx:21-29` - Head meta configuration
- `apps/polychromos-www/src/routes/index.tsx:52-206` - Landing page HTML structure
- `apps/polychromos-www/public/favicon.svg:1-4` - SVG favicon definition
- `apps/polychromos-www/package.json:15-27` - Dependencies (no analytics packages)

---

### Open Questions (SEO & Analytics)

1. **Analytics Choice**: Which analytics platform should be integrated? Options:
   - Vercel Analytics (simple, GDPR-friendly, already on Vercel)
   - Plausible (privacy-focused, no cookies)
   - Google Analytics 4 (full-featured, requires cookie consent)
   - PostHog (product analytics, session replay)

2. **Social Image**: Should an og:image be created for social sharing?

3. **Domain**: What is the production domain for canonical URLs?

4. **Cookie Consent**: If GA4 is chosen, will a cookie consent banner be needed?

5. **Sitemap Generation**: Should sitemap.xml be statically placed or dynamically generated?
