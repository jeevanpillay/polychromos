# ASCII Cat Page Transition Implementation Plan

## Overview

Implement a page transition effect where a blue overlay slides in from left-to-right, revealing an ASCII art cat drawn in white monospace lines. Once fully revealed, the overlay continues sliding out to expose the new page content. The transition is triggered via a custom `TransitionLink` component.

## Current State Analysis

**Existing infrastructure:**
- TanStack Router with file-based routing (`apps/www/src/routes/`)
- Root layout at `__root.tsx:31-36` wraps all pages via `<Outlet />`
- No animation libraries currently installed
- Tailwind v4 with CSS animations via `@theme` directive in `globals.css`
- Geist Mono font available for ASCII art rendering

**Key discoveries:**
- Router instance created via `getRouter()` factory in `router.tsx:5-11`
- `RootComponent` renders `<Outlet />` inside `RootDocument`
- CSS keyframes pattern exists for accordion animations in `globals.css:57-74`

## Desired End State

After implementation:
1. A `TransitionLink` component exists that wraps navigation with the transition effect
2. Clicking a `TransitionLink` triggers: overlay slides in → ASCII cat appears → overlay slides out → new page renders
3. The transition feels smooth, intentional, and playful (~1.2-1.5 seconds total)
4. Accessibility: Users with `prefers-reduced-motion` skip the animation
5. GSAP is installed and configured for precise timeline control

**Verification:**
- Click any `TransitionLink` and observe the full transition sequence
- Verify timing: ~500ms slide in, ~300ms pause with cat visible, ~500ms slide out
- Check `prefers-reduced-motion: reduce` behavior in browser settings
- Confirm no layout shift or flash of content during transition

## What We're NOT Doing

- Auto-triggering on all route changes (only via `TransitionLink`)
- Adding the transition to existing navigation components
- Creating exit animations for the old page content
- Supporting customizable ASCII art (hardcoded cat only)
- Implementing route-specific transition variants

## Implementation Approach

Use **GSAP Timeline** for the transition animation because:
1. Precise sequencing of multi-stage animations
2. No AnimatePresence issues with TanStack Router
3. Industry-standard, production-proven library
4. Built-in easing functions (`power2.out`, `power2.in`)

The architecture:
- `PageTransitionProvider` - Context to manage transition state
- `PageTransition` - The overlay component with GSAP animation
- `TransitionLink` - Wrapper that triggers transition before navigation
- `usePageTransition` - Hook to access transition state

---

## Phase 1: Install Dependencies and Set Up Context

### Overview
Install GSAP and create the transition context/provider infrastructure.

### Changes Required:

#### 1. Install GSAP
**Command**: Run in `apps/www/` directory
```bash
pnpm add gsap @gsap/react
```

#### 2. Create PageTransition Context
**File**: `apps/www/src/components/page-transition/context.tsx`

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface PageTransitionContextValue {
  isTransitioning: boolean;
  pendingPath: string | null;
  startTransition: (path: string) => void;
  completeTransition: () => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(
  null
);

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const startTransition = useCallback((path: string) => {
    setPendingPath(path);
    setIsTransitioning(true);
  }, []);

  const completeTransition = useCallback(() => {
    setPendingPath(null);
    setIsTransitioning(false);
  }, []);

  return (
    <PageTransitionContext.Provider
      value={{
        isTransitioning,
        pendingPath,
        startTransition,
        completeTransition,
      }}
    >
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error(
      "usePageTransition must be used within a PageTransitionProvider"
    );
  }
  return context;
}
```

#### 3. Create Index Export
**File**: `apps/www/src/components/page-transition/index.ts`

```ts
export { PageTransitionProvider, usePageTransition } from "./context";
```

### Success Criteria:

#### Automated Verification:
- [x] Dependencies installed: `pnpm ls gsap @gsap/react` shows both packages
- [x] TypeScript compiles: `pnpm typecheck` passes
- [x] Build succeeds: `pnpm build:www` completes without errors

#### Manual Verification:
- [x] Context files exist at expected paths

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 2.

---

## Phase 2: Create PageTransition Component

### Overview
Build the overlay component with ASCII cat and GSAP timeline animation.

### Changes Required:

#### 1. Create PageTransition Component
**File**: `apps/www/src/components/page-transition/page-transition.tsx`

```tsx
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useRouter } from "@tanstack/react-router";
import { usePageTransition } from "./context";

const ASCII_CAT = `    /\\_/\\
   ( o.o )
    > ^ <`;

export function PageTransition() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLPreElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const router = useRouter();
  const { isTransitioning, pendingPath, completeTransition } =
    usePageTransition();

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!isTransitioning || !overlayRef.current || !catRef.current) {
      return;
    }

    // Kill any existing timeline
    timelineRef.current?.kill();

    if (prefersReducedMotion) {
      // Skip animation, navigate immediately
      if (pendingPath) {
        router.navigate({ to: pendingPath });
      }
      completeTransition();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        // Navigate to the pending path
        if (pendingPath) {
          router.navigate({ to: pendingPath });
        }
        completeTransition();
      },
    });
    timelineRef.current = tl;

    tl
      // Initial state
      .set(overlayRef.current, { xPercent: -100, display: "flex" })
      .set(catRef.current, { opacity: 0 })
      // Stage 1: Overlay slides in from left
      .to(overlayRef.current, {
        xPercent: 0,
        duration: 0.5,
        ease: "power2.out",
      })
      // ASCII cat fades in
      .to(
        catRef.current,
        {
          opacity: 1,
          duration: 0.2,
        },
        "-=0.1"
      )
      // Brief pause to appreciate the cat
      .to({}, { duration: 0.3 })
      // ASCII cat fades out
      .to(catRef.current, {
        opacity: 0,
        duration: 0.15,
      })
      // Stage 2: Overlay slides out to right
      .to(
        overlayRef.current,
        {
          xPercent: 100,
          duration: 0.5,
          ease: "power2.in",
        },
        "-=0.1"
      )
      // Hide overlay
      .set(overlayRef.current, { display: "none" });

    return () => {
      timelineRef.current?.kill();
    };
  }, [isTransitioning, pendingPath, router, completeTransition]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 hidden items-center justify-center"
      style={{ backgroundColor: "oklch(0.4512 0.275 269.89)" }}
      aria-hidden="true"
    >
      <pre
        ref={catRef}
        className="select-none font-mono text-white opacity-0"
        style={{
          fontSize: "clamp(1rem, 4vw, 2rem)",
          lineHeight: 1.1,
          letterSpacing: "-0.05em",
          whiteSpace: "pre",
        }}
      >
        {ASCII_CAT}
      </pre>
    </div>
  );
}
```

#### 2. Update Index Export
**File**: `apps/www/src/components/page-transition/index.ts`

```ts
export { PageTransitionProvider, usePageTransition } from "./context";
export { PageTransition } from "./page-transition";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck` passes
- [x] Build succeeds: `pnpm build:www` completes without errors
- [ ] Lint passes: `pnpm lint` has no errors (Note: ESLint has a pre-existing config issue unrelated to this feature)

#### Manual Verification:
- [ ] Component renders without errors when `isTransitioning` is false (hidden)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 3.

---

## Phase 3: Create TransitionLink Component

### Overview
Build the link component that triggers the page transition.

### Changes Required:

#### 1. Create TransitionLink Component
**File**: `apps/www/src/components/page-transition/transition-link.tsx`

```tsx
import { type ReactNode, useCallback } from "react";
import { usePageTransition } from "./context";

interface TransitionLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

export function TransitionLink({
  to,
  children,
  className,
}: TransitionLinkProps) {
  const { startTransition, isTransitioning } = usePageTransition();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      // Don't start a new transition if one is already in progress
      if (isTransitioning) {
        return;
      }

      startTransition(to);
    },
    [to, startTransition, isTransitioning]
  );

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
```

#### 2. Update Index Export
**File**: `apps/www/src/components/page-transition/index.ts`

```ts
export { PageTransitionProvider, usePageTransition } from "./context";
export { PageTransition } from "./page-transition";
export { TransitionLink } from "./transition-link";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck` passes
- [x] Build succeeds: `pnpm build:www` completes without errors
- [ ] Lint passes: `pnpm lint` has no errors (Note: ESLint has a pre-existing config issue unrelated to this feature)

#### Manual Verification:
- [ ] TransitionLink renders as an anchor element

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 4.

---

## Phase 4: Integrate with Root Layout

### Overview
Wire up the PageTransitionProvider and PageTransition component in the root layout.

### Changes Required:

#### 1. Update Root Layout
**File**: `apps/www/src/routes/__root.tsx`

```tsx
import type { ReactNode } from "react";

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import {
  PageTransition,
  PageTransitionProvider,
} from "~/components/page-transition";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jeevan Pillay" },
      { name: "description", content: "Jeevan Pillay Studio" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col bg-background">
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck` passes
- [x] Build succeeds: `pnpm build:www` completes without errors
- [ ] Lint passes: `pnpm lint` has no errors (Note: ESLint has a pre-existing config issue unrelated to this feature)
- [x] Dev server starts: `pnpm dev:www` runs without errors

#### Manual Verification:
- [ ] Home page loads normally at http://localhost:3000
- [ ] No console errors related to context or transitions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 5.

---

## Phase 5: Create Test Route and Verify Transition

### Overview
Add a test route and link to verify the transition works end-to-end.

### Changes Required:

#### 1. Create About Page Route
**File**: `apps/www/src/routes/about.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { TransitionLink } from "~/components/page-transition";

export const Route = createFileRoute("/about")({
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

#### 2. Update Home Page with TransitionLink
**File**: `apps/www/src/routes/index.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { TransitionLink } from "~/components/page-transition";

export const Route = createFileRoute("/")({
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

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck` passes
- [x] Build succeeds: `pnpm build:www` completes without errors
- [ ] Lint passes: `pnpm lint` has no errors (Note: ESLint has a pre-existing config issue unrelated to this feature)

#### Manual Verification:
- [ ] Navigate from Home → About: Blue overlay slides in from left, ASCII cat appears, overlay slides out to right, about page visible
- [ ] Navigate from About → Home: Same transition sequence
- [ ] Timing feels smooth (~1.2-1.5 seconds total)
- [ ] ASCII cat is centered, white, and legible
- [ ] No layout shift or flash of content
- [ ] Enable `prefers-reduced-motion: reduce` in browser/OS settings and verify navigation happens instantly without animation

**Implementation Note**: This is the final phase. After manual verification confirms everything works, the feature is complete.

---

## Testing Strategy

### Unit Tests:
- Context state management (startTransition, completeTransition)
- TransitionLink prevents default navigation

### Integration Tests:
- Full transition sequence with mocked GSAP
- Reduced motion preference handling

### Manual Testing Steps:
1. Click TransitionLink on home page
2. Observe: overlay slides in from left (~500ms)
3. Observe: ASCII cat fades in and is visible (~300ms)
4. Observe: cat fades out, overlay slides right (~500ms)
5. Verify: new page content is visible
6. Repeat navigation back to verify consistency
7. Test with `prefers-reduced-motion: reduce` enabled

## Performance Considerations

- GSAP uses `transform: translateX()` which is GPU-accelerated
- Overlay is `display: none` when not animating (no layout cost)
- Timeline is killed on cleanup to prevent memory leaks
- Reduced motion users skip animation entirely

## Accessibility Notes

- Overlay has `aria-hidden="true"` (decorative)
- ASCII cat is not announced by screen readers
- Reduced motion preference is respected
- Navigation still works with JavaScript disabled (graceful degradation via `<a href>`)

## References

- Original research: `thoughts/shared/research/2025-12-11-design-research-ascii-cat-page-transition.md`
- GSAP Timeline docs: https://gsap.com/docs/v3/GSAP/Timeline/
- TanStack Router: https://tanstack.com/router/latest

---

**Last Updated**: 2025-12-11
**Ready to Implement**: Yes
