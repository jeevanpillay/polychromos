# Polychromos WWW Production Hardening Implementation Plan

## Overview

Add production-hardening to `apps/polychromos-www/` including security headers middleware, font file cleanup (remove 50 unused files), SEO/performance improvements (resource hints, meta tags), and Vercel Analytics/Speed Insights integration.

## Current State Analysis

### Security Headers
- **Main www app**: Has comprehensive security middleware at `apps/www/src/middleware.ts`
- **Polychromos WWW**: No middleware, no security headers configured
- **Impact**: Would score ~70-80 on Lighthouse Best Practices instead of 90+

### Font Files
- **Total files**: 54 font files in `public/fonts/`
- **Actually used**: 10 files (4 HW Animo + 6 PP Neue Montreal)
- **Unused**: 44 files (~4.5MB wasted in build output)
  - 40 HW Animo variants (various widths + outline variants)
  - 8 Joyride files (no `@font-face` declaration exists)

### SEO/Performance
- Basic meta tags only (charset, viewport, title, description)
- No Open Graph or Twitter Card meta tags
- No canonical URL
- No preconnect for `api.clerk.com` (waitlist API)
- No font preloading for critical fonts
- No JSON-LD structured data

## Desired End State

After implementation:
1. All HTTP responses include security headers (HSTS, CSP, X-Frame-Options, etc.)
2. Only 10 font files shipped (down from 54)
3. Comprehensive SEO meta tags with OG/Twitter support
4. Resource hints for Clerk API and critical fonts
5. Vercel Analytics and Speed Insights tracking page views and performance
6. Lighthouse Best Practices score 90+

### Verification Commands
```bash
# Build passes
pnpm --filter polychromos-www build

# Typecheck passes
pnpm --filter polychromos-www typecheck

# Lint passes
pnpm lint

# Font files reduced
ls apps/polychromos-www/public/fonts/**/* | wc -l  # Should be ~10
```

## What We're NOT Doing

- Adding sitemap.xml or robots.txt (landing page only)
- Changing the visual design
- Adding new routes or features
- Modifying the waitlist form logic

## Implementation Approach

Follow the existing patterns from `apps/www/`:
- Security middleware: Copy and adapt `apps/www/src/middleware.ts`
- SEO helper: Create simplified version of `apps/www/src/lib/seo.ts`
- Resource hints: Add to `head()` function in root route

---

## Phase 1: Add Security Headers Middleware

### Overview
Create security middleware using TanStack Start's `createMiddleware` API that adds HTTP security headers to all responses. Register as global middleware via `createStart`.

### Changes Required:

#### 1. Create Security Middleware
**File**: `apps/polychromos-www/src/lib/middleware.ts` (NEW)

```typescript
import { createMiddleware } from "@tanstack/react-start";
import {
  getResponseHeaders,
  setResponseHeaders,
} from "@tanstack/react-start/server";

export const securityHeadersMiddleware = createMiddleware().server(
  ({ next }) => {
    const headers = getResponseHeaders();
    headers.set("X-DNS-Prefetch-Control", "on");
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.clerk.com https://vitals.vercel-insights.com",
      "frame-ancestors 'none'",
    ].join("; "));
    setResponseHeaders(headers);
    return next();
  },
);
```

#### 2. Register Global Middleware
**File**: `apps/polychromos-www/src/start.ts` (NEW)

```typescript
import { createStart } from "@tanstack/react-start";
import { securityHeadersMiddleware } from "~/lib/middleware";

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
```

**Note**: Uses `getResponseHeaders()` before `setResponseHeaders()` as a workaround for [known issue #5407](https://github.com/TanStack/router/issues/5407).

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter polychromos-www typecheck`
- [x] Build succeeds: `pnpm --filter polychromos-www build`
- [x] Lint passes: `pnpm lint` (note: pre-existing lint issues in env.ts unrelated to this phase)

#### Manual Verification:
- [ ] Run dev server: `pnpm --filter polychromos-www dev`
- [ ] Check response headers in browser DevTools (Network tab)
- [ ] Verify `Strict-Transport-Security` header present
- [ ] Verify `Content-Security-Policy` header present
- [ ] Verify waitlist form still works (CSP allows Clerk API)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the security headers are being applied correctly.

---

## Phase 2: Clean Up Unused Font Files

### Overview
Remove 44 unused font files to reduce build output size by ~4.5MB.

### Changes Required:

#### 1. Delete Unused HW Animo Variants
**Directory**: `apps/polychromos-www/public/fonts/hw-animo/`

**Keep** (4 files used in fonts.css):
- `hw-animo-semi-expanded-regular.woff2`
- `hw-animo-semi-expanded-regular.woff`
- `hw-animo-semicondensed-regular-outline.woff2`
- `hw-animo-semicondensed-regular-outline.woff`

**Delete** (40 files):
```bash
# Compressed variants
rm hw-animo-compressed-regular.woff hw-animo-compressed-regular.woff2
rm hw-animo-compressed-regular-outline.woff hw-animo-compressed-regular-outline.woff2

# Condensed variants (not semi-condensed)
rm hw-animo-condensed-regular.woff hw-animo-condensed-regular.woff2
rm hw-animo-condensed-regular-outline.woff hw-animo-condensed-regular-outline.woff2

# Expanded variants (not semi-expanded)
rm hw-animo-expanded-regular.woff hw-animo-expanded-regular.woff2
rm hw-animo-expanded-regular-outline.woff hw-animo-expanded-regular-outline.woff2

# Extra condensed variants
rm hw-animo-extra-condensed-regular.woff hw-animo-extra-condensed-regular.woff2
rm hw-animo-extracondensed-regular-outline.woff hw-animo-extracondensed-regular-outline.woff2

# Extra expanded variants
rm hw-animo-extra-expanded-regular.woff hw-animo-extra-expanded-regular.woff2
rm hw-animo-extraexpanded-regular-outline.woff hw-animo-extraexpanded-regular-outline.woff2

# Normal variants
rm hw-animo-normal-regular.woff hw-animo-normal-regular.woff2
rm hw-animo-normal-regular-outline.woff hw-animo-normal-regular-outline.woff2

# Semi-condensed regular (keep outline only)
rm hw-animo-semi-condensed-regular.woff hw-animo-semi-condensed-regular.woff2

# Semi-expanded outline (keep regular only)
rm hw-animo-semiexpanded-regular-outline.woff hw-animo-semiexpanded-regular-outline.woff2

# Ultra condensed variants
rm hw-animo-ultra-condensed-regular.woff hw-animo-ultra-condensed-regular.woff2
rm hw-animo-ultracondensed-regular-outline.woff hw-animo-ultracondensed-regular-outline.woff2

# Ultra expanded variants
rm hw-animo-ultra-expanded-regular.woff hw-animo-ultra-expanded-regular.woff2
rm hw-animo-ultraexpanded-regular-outline.woff hw-animo-ultraexpanded-regular-outline.woff2

# Wide variants
rm hw-animo-wide-regular.woff hw-animo-wide-regular.woff2
rm hw-animo-wide-regular-outline.woff hw-animo-wide-regular-outline.woff2
```

#### 2. Delete Entire Joyride Directory
**Directory**: `apps/polychromos-www/public/fonts/joyride/`

No `@font-face` declaration exists for Joyride in polychromos-www. Delete all 8 files:
```bash
rm -rf apps/polychromos-www/public/fonts/joyride/
```

### Success Criteria:

#### Automated Verification:
- [x] Build succeeds: `pnpm --filter polychromos-www build`
- [x] Font count reduced: `find apps/polychromos-www/public/fonts -type f | wc -l` returns 10

#### Manual Verification:
- [ ] Run dev server and verify fonts display correctly
- [ ] Check hero text uses HW Animo Semi Expanded
- [ ] Check "EXECUTABLE LOGIC" uses HW Animo Semi Condensed Outline
- [ ] Check body text uses PP Neue Montreal

**Implementation Note**: After completing this phase, verify all fonts render correctly before proceeding.

---

## Phase 3: Add SEO & Resource Hints

### Overview
Create SEO helper function and add resource hints for Clerk API preconnect and critical font preloading.

### Changes Required:

#### 1. Create SEO Helper
**File**: `apps/polychromos-www/src/lib/seo.ts` (NEW)

```typescript
import { env } from "~/env";

/**
 * SEO Configuration for Polychromos WWW
 */

export interface SEOConfig {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export function generateSEO(config: SEOConfig) {
  const {
    title,
    description,
    canonicalUrl = env.VITE_APP_URL,
    ogImage = `${env.VITE_APP_URL}/og-image.png`,
  } = config;

  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "Polychromos" },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      // Theme
      { name: "theme-color", content: "#000000" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      // Preconnect for Clerk API (waitlist form)
      { rel: "preconnect", href: "https://api.clerk.com" },
      { rel: "dns-prefetch", href: "https://api.clerk.com" },
      // Critical font preloads
      {
        rel: "preload",
        href: "/fonts/hw-animo/hw-animo-semi-expanded-regular.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      },
      {
        rel: "preload",
        href: "/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      },
    ],
  };
}
```

#### 2. Update Root Route to Use SEO Helper
**File**: `apps/polychromos-www/src/routes/__root.tsx`

```typescript
import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import "~/styles/fonts.css";

import { CustomErrorComponent } from "~/components/error-component";
import { LoadingComponent } from "~/components/loading-component";
import { CustomNotFoundComponent } from "~/components/not-found-component";
import { generateSEO } from "~/lib/seo";

import "../styles/app.css";

export const Route = createRootRoute({
  head: () =>
    generateSEO({
      title: "Polychromos | Code-Driven Design Platform",
      description:
        "Bridge the gap between Figma and React. Direct manipulation of the DOM with a designer-friendly interface. Code-first. Real-time. No more handoff friction.",
    }),
  errorComponent: (props) => <CustomErrorComponent {...props} />,
  notFoundComponent: () => <CustomNotFoundComponent />,
  pendingComponent: () => <LoadingComponent />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
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

#### 3. Create OG Image Placeholder
**File**: `apps/polychromos-www/public/og-image.png`

Create a 1200x630px OG image with:
- Dark background (#0a0a0a)
- "POLYCHROMOS" in HW Animo Semi Expanded
- Tagline: "Code-Driven Design Platform"

**Note**: This can be a simple placeholder initially; a proper branded image can be created later.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter polychromos-www typecheck`
- [x] Build succeeds: `pnpm --filter polychromos-www build`
- [x] Lint passes: `pnpm lint` (pre-existing lint issues in env.ts unrelated to this phase)

#### Manual Verification:
- [ ] View page source, verify OG meta tags present
- [ ] Check `<link rel="preconnect">` for api.clerk.com in head
- [ ] Check `<link rel="preload">` for critical fonts in head
- [ ] Test OG image preview using https://opengraph.xyz or social media debuggers
- [ ] Verify canonical URL is correct

**Note**: OG image placeholder (`public/og-image.png`) should be created manually with design tools. A proper 1200x630px branded image can be created later.

**Implementation Note**: After completing this phase, run a Lighthouse audit to verify Best Practices score has improved.

---

## Phase 4: Add Vercel Analytics & Speed Insights

### Overview
Add Vercel Analytics for page view tracking and Speed Insights for Core Web Vitals monitoring. Lazy-load both to avoid impacting initial page load.

### Changes Required:

#### 1. Add Dependencies
**File**: `apps/polychromos-www/package.json`

Add to dependencies:
```json
{
  "dependencies": {
    "@vercel/analytics": "^1.5.0",
    "@vercel/speed-insights": "^1.2.0"
  }
}
```

Run:
```bash
pnpm --filter polychromos-www add @vercel/analytics @vercel/speed-insights
```

#### 2. Update Root Route with Analytics
**File**: `apps/polychromos-www/src/routes/__root.tsx`

Update the file to lazy-load analytics components:

```typescript
import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import "~/styles/fonts.css";

import { CustomErrorComponent } from "~/components/error-component";
import { LoadingComponent } from "~/components/loading-component";
import { CustomNotFoundComponent } from "~/components/not-found-component";
import { generateSEO } from "~/lib/seo";

import "../styles/app.css";

// Lazy load analytics - not critical for initial render
const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
);
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((m) => ({
    default: m.SpeedInsights,
  })),
);

export const Route = createRootRoute({
  head: () =>
    generateSEO({
      title: "Polychromos | Code-Driven Design Platform",
      description:
        "Bridge the gap between Figma and React. Direct manipulation of the DOM with a designer-friendly interface. Code-first. Real-time. No more handoff friction.",
    }),
  errorComponent: (props) => <CustomErrorComponent {...props} />,
  notFoundComponent: () => <CustomNotFoundComponent />,
  pendingComponent: () => <LoadingComponent />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans antialiased">
        {children}
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}
```

**Key changes from Phase 3**:
- Import `lazy` and `Suspense` from React
- Lazy-load `Analytics` and `SpeedInsights` components
- Wrap analytics in `<Suspense fallback={null}>` before `<Scripts />`

### Success Criteria:

#### Automated Verification:
- [x] Dependencies installed: `pnpm --filter polychromos-www list @vercel/analytics @vercel/speed-insights`
- [x] TypeScript compiles: `pnpm --filter polychromos-www typecheck`
- [x] Build succeeds: `pnpm --filter polychromos-www build`
- [x] Lint passes: `pnpm lint` (pre-existing lint issues in env.ts unrelated to this phase)

#### Manual Verification:
- [ ] Deploy to Vercel (preview or production)
- [ ] Check Vercel Analytics dashboard shows page views
- [ ] Check Vercel Speed Insights shows Core Web Vitals
- [ ] Verify analytics scripts don't block initial render (check Network waterfall)
- [ ] CSP doesn't block analytics (no console errors)

**Implementation Note**: Analytics only work when deployed to Vercel. Local dev will show components but won't track data.

---

## Testing Strategy

### Automated Tests
- TypeScript compilation catches type errors
- Build process validates all imports resolve
- Lint ensures code style consistency

### Manual Testing Steps
1. Start dev server: `pnpm --filter polychromos-www dev`
2. Open http://localhost:3002
3. Check Network tab for security headers on document response
4. Verify all fonts render correctly (hero, body text)
5. Submit waitlist form to verify CSP allows Clerk API
6. Run Lighthouse audit in Chrome DevTools
7. Test OG preview at https://opengraph.xyz
8. Deploy to Vercel and verify Analytics/Speed Insights dashboards populate

### Lighthouse Targets
| Metric | Target | Notes |
|--------|--------|-------|
| Performance | 90+ | SSR + optimized images |
| Accessibility | 95+ | Dark mode, semantic HTML |
| Best Practices | 90+ | Security headers added |
| SEO | 95+ | Meta tags, canonical, structured |

---

## Performance Considerations

### Font Loading
- Critical fonts preloaded to avoid FOUT
- `font-display: swap` prevents FOIT
- Unused fonts removed reduces initial payload

### Network
- Preconnect to Clerk API reduces connection latency for waitlist form
- DNS prefetch as fallback for older browsers

### Bundle Size
- Removing 44 font files saves ~4.5MB in build output
- Analytics packages (~10KB gzipped) lazy-loaded after initial render

### Analytics
- Vercel Analytics and Speed Insights lazy-loaded via React.lazy()
- Wrapped in Suspense to not block rendering
- Only active when deployed to Vercel (no-op locally)

---

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-www-production-readiness.md`
- Security middleware pattern: `apps/www/src/middleware.ts:1-45`
- SEO helper pattern: `apps/www/src/lib/seo.ts:1-127`
- Analytics pattern: `apps/www/src/routes/__root.tsx:29-37`
- Font CSS: `apps/polychromos-www/src/styles/fonts.css:1-98`
