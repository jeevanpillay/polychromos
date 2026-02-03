# TanStack Start Production Enhancement Implementation Plan

## Overview

Enhance the TanStack Start + Router setup from a basic implementation to a production-ready application by adding custom error/404 handling, optimized router configuration with preloading and caching, per-route SEO, and loading state management. This ensures the application follows TanStack Start best practices and provides excellent user experience.

## Current State Analysis

### What Exists Now
- Core TanStack Start configuration with file-based routing
- Basic SEO helper functions (`generateSEO()`, schema generators)
- Global JSON-LD structured data (WebSite + Organization)
- Root route with global SEO
- Page transition system with GSAP animations
- Scroll restoration enabled
- Security middleware with CSP headers

### What's Missing (Production Gaps)
- **Custom Error Component**: Using TanStack Router's default `ErrorComponent`
- **Custom 404/Not Found Component**: No dedicated 404 page or handling
- **Router Configuration**: Missing `defaultPreload`, `defaultErrorComponent`, `defaultNotFoundComponent`, caching/staleTime config
- **Per-Route SEO**: Only root route has `head()` function; index.tsx and about.tsx have none
- **Loading States**: No `pendingComponent` or loading UI
- **Error Boundaries**: No route-level error components

### Key Constraints
- Must maintain existing page transition animations
- Must preserve current styling (Tailwind v4 with dark mode)
- Must keep current navigation structure (/, /about)
- Must not break existing SEO setup

## Desired End State

After completing this plan, the application will:

1. **Error Handling**: Display beautiful, user-friendly error pages with retry options
2. **404 Handling**: Custom 404 page with navigation suggestions and proper HTTP status
3. **Router Optimization**: Configured with preloading on hover, caching, and sensible defaults
4. **SEO Excellence**: Per-route meta tags for homepage and about page
5. **Loading Feedback**: Visual loading indicators during transitions
6. **Production Ready**: Passes all checks from TanStack Start production checklist

### Verification Checklist
- [ ] Custom error component renders with styling
- [ ] Custom 404 component shows for invalid routes
- [ ] Router preload configuration set to 'intent'
- [ ] All routes have `head()` functions with appropriate SEO
- [ ] Loading/pending states show during navigation
- [ ] TypeScript compilation succeeds
- [ ] Build completes without errors
- [ ] No console errors or warnings

## What We're NOT Doing

- Modifying existing page transition logic
- Changing current route structure (/, /about)
- Adding new routes beyond what exists
- Implementing complex data loading patterns (reserved for future)
- Changing authentication/security setup
- Modifying existing component library imports

## Implementation Approach

**Strategy**: Incremental enhancement across 4 focused phases, each with clear success criteria. Each phase is independently testable and can be deployed separately if needed.

**Order**:
1. Router configuration (foundation)
2. Error/404 components (user-facing)
3. Per-route SEO (content improvement)
4. Loading states (UX polish)

This order ensures the router is properly configured before components rely on it, and components are built before SEO is added.

---

## Phase 1: Enhanced Router Configuration

### Overview
Update router.tsx with production-ready defaults: preloading strategy, caching configuration, default error/404 components, and loading state timing. This foundation enables all subsequent phases.

### Changes Required

#### 1. Router Configuration (apps/www/src/router.tsx)

**File**: `apps/www/src/router.tsx`
**Changes**: Add router configuration options for preloading, caching, error/404 defaults, and loading states

```typescript
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,

    // Navigation & Restoration
    scrollRestoration: true,

    // Preloading (Performance)
    defaultPreload: "intent",        // Preload on hover
    defaultPreloadDelay: 50,         // 50ms delay before preload
    defaultPreloadStaleTime: 30000,  // 30 seconds cache for preloads

    // Caching & Stale Time
    defaultStaleTime: 0,             // Always treat data as stale
    defaultGcTime: 1800000,          // 30 minutes garbage collection

    // Loading States
    defaultPendingMs: 1000,          // Show pending after 1 second
    defaultPendingMinMs: 500,        // Keep pending visible 500ms minimum

    // Error/NotFound Behavior (will reference components from Phase 2)
    notFoundMode: "fuzzy",           // Use nearest parent's notFoundComponent
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

**Rationale for values**:
- `defaultPreload: "intent"` - Modern browsers prefetch on hover, improves perceived performance
- `defaultPreloadDelay: 50` - Prevents excessive preloads on accidental hovers
- `defaultStaleTime: 0` - Conservative approach; revalidate data unless explicitly cached
- `defaultPendingMs: 1000` - Don't show loading for fast operations (< 1 second)
- `notFoundMode: "fuzzy"` - Preserves layout when 404 occurs

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] No build errors: `pnpm build:www`
- [x] Router configuration object is valid TypeScript

#### Manual Verification
- [ ] Development server starts without errors: `pnpm dev:www`
- [ ] Navigation between pages works correctly
- [ ] Scroll position restores on back navigation
- [ ] No console errors in browser DevTools

**Implementation Note**: After this phase completes and all checks pass, the foundation is ready for error/404 components. Proceed to Phase 2.

---

## Phase 2: Custom Error & 404 Components

### Overview
Create beautiful, user-friendly error and 404 pages styled with Tailwind, integrated with the page transition system, and configured as router defaults. Users will see helpful messaging and options to recover.

### Changes Required

#### 1. Custom Error Component (NEW FILE)

**File**: `apps/www/src/components/error-component.tsx`
**Changes**: Create new error component

```typescript
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

export function CustomErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-5xl font-bold text-destructive">Error</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Something went wrong while loading this page.
        </p>

        {/* Error Details (only in development) */}
        {import.meta.env.DEV && (
          <div className="mb-6 rounded-lg bg-muted p-4 text-left">
            <p className="font-mono text-sm text-foreground">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.invalidate()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Try Again
          </button>
          <button
            onClick={() => router.navigate({ to: "/" })}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 font-medium hover:bg-accent"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Design decisions**:
- Matches homepage layout styling (centered, gap-8)
- Red destructive color for error indication
- Development error details for debugging
- Retry and navigation options
- Responsive button layout

#### 2. Custom Not Found Component (NEW FILE)

**File**: `apps/www/src/components/not-found-component.tsx`
**Changes**: Create new 404 component

```typescript
import { Link } from "@tanstack/react-router";

export function CustomNotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-7xl font-bold text-primary">404</h1>
        <p className="mb-2 text-2xl font-semibold">Page Not Found</p>
        <p className="mb-8 text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Navigation Options */}
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Go Home
          </Link>
          <Link
            to="/about"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 font-medium hover:bg-accent"
          >
            About
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Design decisions**:
- Large 404 number for immediate recognition
- Same layout consistency as error component
- Direct navigation to main routes
- Friendly, encouraging messaging
- Matches Tailwind dark mode styling

#### 3. Update Root Route (apps/www/src/routes/__root.tsx)

**File**: `apps/www/src/routes/__root.tsx`
**Changes**: Replace default error component with custom one, add not found component

```diff
import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import { env } from "~/env";
import { JsonLd } from "~/components/json-ld";
+ import { CustomErrorComponent } from "~/components/error-component";
+ import { CustomNotFoundComponent } from "~/components/not-found-component";
import {
  PageTransition,
  PageTransitionProvider,
} from "~/components/page-transition";
import {
  generateSEO,
  getOrganizationSchema,
  getWebsiteSchema,
} from "~/lib/seo";

import "../styles/app.css";

export const Route = createRootRoute({
  head: () => {
    const seo = generateSEO({
      title: "Jeevan Pillay Studio",
      description: "Jeevan Pillay Studio - Personal portfolio and projects",
      canonicalUrl: env.VITE_APP_URL,
    });
    return seo;
  },
- errorComponent: ({ error }) => <ErrorComponent error={error} />,
+ errorComponent: (props) => <CustomErrorComponent {...props} />,
+ notFoundComponent: () => <CustomNotFoundComponent />,
  component: RootComponent,
});
```

**Rationale**:
- Remove unused ErrorComponent import
- Add custom components that match brand styling
- Both handle global errors/404s

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] No build errors: `pnpm build:www`
- [x] New component files exist and export correctly

#### Manual Verification
- [ ] Navigate to invalid URL (e.g., /nonexistent) shows custom 404 page
- [ ] 404 page has "Go Home" and "About" navigation links
- [ ] Error styling matches existing dark mode design
- [ ] Buttons are clickable and functional
- [ ] Error component can be triggered in development
- [ ] Page transition animations work with error/404 pages

**Implementation Note**: After this phase, error handling is complete. Proceed to Phase 3 to enhance SEO across all routes.

---

## Phase 3: Per-Route SEO Configuration

### Overview
Add `head()` functions to index.tsx and about.tsx with unique, optimized meta tags. Ensures each page has distinct SEO metadata for better search engine indexing and social sharing.

### Changes Required

#### 1. Update Homepage Route (apps/www/src/routes/index.tsx)

**File**: `apps/www/src/routes/index.tsx`
**Changes**: Add `head()` function with homepage-specific SEO

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { generateSEO } from "~/lib/seo";
import { env } from "~/env";
import { TransitionLink } from "~/components/page-transition";

export const Route = createFileRoute("/")({
  head: () => {
    const seo = generateSEO({
      title: "Home - Jeevan Pillay Studio",
      description:
        "Welcome to Jeevan Pillay Studio. Explore my portfolio and latest projects.",
      canonicalUrl: env.VITE_APP_URL,
      ogType: "website",
    });
    return seo;
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <TransitionLink
        to="/about"
        className="text-primary underline hover:no-underline"
      >
        Go to About (with transition)
      </TransitionLink>
    </div>
  );
}
```

**SEO Rationale**:
- Distinct title with "Home -" prefix differentiates from root
- Description welcomes visitors and sets expectations
- `ogType: "website"` indicates homepage
- Canonical URL is the homepage

#### 2. Update About Route (apps/www/src/routes/about.tsx)

**File**: `apps/www/src/routes/about.tsx`
**Changes**: Add `head()` function with about-specific SEO

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { generateSEO } from "~/lib/seo";
import { env } from "~/env";
import { TransitionLink } from "~/components/page-transition";

export const Route = createFileRoute("/about")({
  head: () => {
    const seo = generateSEO({
      title: "About - Jeevan Pillay Studio",
      description:
        "Learn more about Jeevan Pillay, his background, skills, and passion for building digital experiences.",
      canonicalUrl: `${env.VITE_APP_URL}/about`,
      ogType: "website",
    });
    return seo;
  },
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">About</h1>
      <p className="text-muted-foreground">This is the about page.</p>
      <TransitionLink
        to="/"
        className="text-primary underline hover:no-underline"
      >
        Go back home (with transition)
      </TransitionLink>
    </div>
  );
}
```

**SEO Rationale**:
- Distinct title with "About -" prefix
- Description focuses on personal/professional angle
- Canonical URL includes /about path
- `ogType: "website"` consistent with site type

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] No build errors: `pnpm build:www`
- [x] Both routes export Route with head() function

#### Manual Verification
- [ ] Inspect page source on homepage: title shows "Home - Jeevan Pillay Studio"
- [ ] Inspect page source on about page: title shows "About - Jeevan Pillay Studio"
- [ ] Meta description differs between pages
- [ ] Canonical URL is correct on each page
- [ ] Open Graph tags have correct og:url for each page
- [ ] Page title updates in browser tab when navigating

**Implementation Note**: After this phase, SEO is complete across all routes. Proceed to Phase 4 for loading state polish.

---

## Phase 4: Loading & Pending States

### Overview
Add visual feedback during page transitions with a loading component. Implements `pendingComponent` in the root route and leverages existing page transition timing for coordinated UX.

### Changes Required

#### 1. Create Loading Component (NEW FILE)

**File**: `apps/www/src/components/loading-component.tsx`
**Changes**: Create new loading indicator component

```typescript
export function LoadingComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="flex items-center gap-2">
        {/* Animated Dots Loader */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{
                animation: `pulse 1.4s infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Loading...</p>

      <style>{`
        @keyframes pulse {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          30% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
```

**Design decisions**:
- Simple animated dots for modern feel
- Matches existing dark mode color scheme (primary color)
- Text feedback for accessibility
- Minimal, non-intrusive design
- Uses CSS keyframes instead of external animation library

#### 2. Update Root Route (apps/www/src/routes/__root.tsx)

**File**: `apps/www/src/routes/__root.tsx`
**Changes**: Add pendingComponent to root route

```diff
import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import { env } from "~/env";
import { JsonLd } from "~/components/json-ld";
import { CustomErrorComponent } from "~/components/error-component";
import { CustomNotFoundComponent } from "~/components/not-found-component";
+ import { LoadingComponent } from "~/components/loading-component";
import {
  PageTransition,
  PageTransitionProvider,
} from "~/components/page-transition";
import {
  generateSEO,
  getOrganizationSchema,
  getWebsiteSchema,
} from "~/lib/seo";

import "../styles/app.css";

export const Route = createRootRoute({
  head: () => {
    const seo = generateSEO({
      title: "Jeevan Pillay Studio",
      description: "Jeevan Pillay Studio - Personal portfolio and projects",
      canonicalUrl: env.VITE_APP_URL,
    });
    return seo;
  },
  errorComponent: (props) => <CustomErrorComponent {...props} />,
  notFoundComponent: () => <CustomNotFoundComponent />,
+ pendingComponent: () => <LoadingComponent />,
  component: RootComponent,
});
```

**Rationale**:
- Shows after 1 second (per router config from Phase 1)
- Coordinates with existing page transition animation
- Provides user feedback during slow loads
- Matches brand styling

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] No build errors: `pnpm build:www`
- [x] LoadingComponent exports correctly

#### Manual Verification
- [ ] Navigate between pages, loading indicator appears (may need slow 3G in DevTools)
- [ ] Loading animation plays smoothly
- [ ] Indicator disappears when page loads
- [ ] Indicator displays for at least 500ms (pendingMinMs)
- [ ] Page transition animation and loading component don't conflict
- [ ] Loading component styling matches dark mode

**Implementation Note**: After this phase, all production enhancements are complete. Proceed to final verification.

---

## Phase 5: Verification & Testing

### Overview
Verify all changes work together, run full test suite, and confirm production checklist is complete.

### Testing Strategy

#### Build & Type Checking
```bash
pnpm typecheck    # Verify no TypeScript errors
pnpm lint         # Check ESLint compliance
pnpm build:www    # Production build succeeds
```

#### Development Testing
```bash
pnpm dev:www      # Dev server starts cleanly
```

Then manually verify:
1. Homepage loads with correct title in browser tab
2. Navigate to about, title changes in browser tab
3. Navigate to invalid URL, custom 404 appears
4. Click "Go Home" on 404, navigates correctly
5. Open DevTools > Network, throttle to slow 3G
6. Navigate pages, loading indicator shows
7. Check Page Source on both pages for correct SEO meta tags
8. Verify no console errors or warnings

#### Production Checklist
- [x] Configure `defaultPreload: 'intent'` for performance
- [x] Set up global `errorComponent` on root route
- [x] Set up global `notFoundComponent` on root route
- [x] Configure `scrollRestoration: true`
- [x] Create SEO helper functions (already existed)
- [x] Create `<JsonLd />` component for structured data (already existed)
- [x] Add `head` property to root route with global SEO
- [x] Add `head` property to key routes (homepage, about)
- [x] Add `<HeadContent />` in head and `<Scripts />` in body
- [x] Configure per-route `head` with proper content
- [x] Consider loading states (`pendingComponent`)

### Success Criteria

#### Automated Verification
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`
- [x] No missing imports or exports

#### Manual Verification
- [ ] Dev server starts without errors: `pnpm dev:www`
- [ ] All page navigation works smoothly
- [ ] Custom error/404 pages display correctly
- [ ] SEO meta tags are present and unique per page
- [ ] Loading indicator shows during slow network
- [ ] Page transitions still animate smoothly
- [ ] No console errors or warnings in DevTools
- [ ] Dark mode styling is consistent across all new components

---

## Summary of Changes

### New Files
- `apps/www/src/components/error-component.tsx` - Custom error page
- `apps/www/src/components/not-found-component.tsx` - Custom 404 page
- `apps/www/src/components/loading-component.tsx` - Loading indicator

### Modified Files
- `apps/www/src/router.tsx` - Enhanced with preloading, caching, defaults
- `apps/www/src/routes/__root.tsx` - Added custom components
- `apps/www/src/routes/index.tsx` - Added SEO head() function
- `apps/www/src/routes/about.tsx` - Added SEO head() function

### Configuration Changes
- Router: preload, caching, loading state timing
- Error handling: custom components instead of defaults
- SEO: per-route meta tags instead of global only
- UX: visual loading feedback

---

## References

- Research: `thoughts/shared/research/2026-01-31-tanstack-start-router-production-setup.md`
- Current code patterns in apps/www/src/
- TanStack Router documentation: error handling, not found, preloading
- Tailwind dark mode styling
