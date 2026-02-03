---
date: 2026-02-01T00:00:00+11:00
researcher: Claude
git_commit: 88f3b6fc362c048ea55808db6cc6f2c54d73a38b
branch: main
repository: x
topic: "WebGL Background Restructure - Moving from Root to Index Route"
tags: [research, codebase, webgl, routing, z-index, layout]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
---

# Research: WebGL Background Restructure - Moving from Root to Index Route

**Date**: 2026-02-01
**Researcher**: Claude
**Git Commit**: 88f3b6fc362c048ea55808db6cc6f2c54d73a38b
**Branch**: main
**Repository**: x

## Research Question

How to restructure the codebase so that the WebGL background effect currently in `__root.tsx` is only applied to `index.tsx`, with other routes using `bg-background`, while ensuring proper z-index layering for content in `index.tsx`.

## Summary

The WebGL background is currently rendered at the root layout level (`__root.tsx`), making it visible across all routes. To move it to only the homepage (`index.tsx`), the WebGL component needs to be removed from the root and added directly to the index route. The z-index layering is straightforward: the WebGL background uses `z-0` with `fixed inset-0` positioning, and content needs `relative z-10` to appear above it. The body already has `bg-background` applied via global CSS, so no changes are needed for the fallback background.

## Detailed Findings

### Current Architecture

#### Root Layout (`apps/www/src/routes/__root.tsx`)

The root layout currently manages:
1. **Body styling** (line 73): `className="bg-background min-h-screen font-sans antialiased"`
2. **WebGL Background** (lines 74-77): Lazy-loaded and rendered inside `<Suspense>`
3. **Content wrapper** (line 78): `<div className="relative z-10 flex min-h-screen flex-col">`

```tsx
<body className="bg-background min-h-screen font-sans antialiased">
  <Suspense fallback={null}>
    <WebGLBackground />
  </Suspense>
  <div className="relative z-10 flex min-h-screen flex-col">
    {children}
  </div>
</body>
```

#### WebGL Background Component (`apps/www/src/components/webgl-background.tsx`)

Key characteristics:
- **Positioning** (line 190): `className="fixed inset-0 z-0"` - Full viewport, lowest z-index
- **Mobile handling** (lines 185-187): Returns `null` on mobile (< 768px width)
- **Reduced motion** (lines 48-57): Respects `prefers-reduced-motion` preference
- **Post-processing** (lines 82-92): Includes film grain effect via `postprocessing` library

#### Homepage (`apps/www/src/routes/index.tsx`)

Current structure:
- **Main container** (line 33): `className="min-h-screen text-foreground flex flex-col"`
- **Fixed contact button** (line 38): `className="hidden lg:inline-flex fixed top-12 right-12 z-40"`
- **No background rendering**: Relies entirely on root layout for background

### Z-Index Layering System

The application uses a consistent z-index hierarchy:

| Layer | Z-Index | Purpose | Location |
|-------|---------|---------|----------|
| Body background | N/A | `bg-background` fallback | `globals.css:227` |
| WebGL canvas | `z-0` | Animated gradient | `webgl-background.tsx:190` |
| Page content | `z-10` | All route content | `__root.tsx:78` |
| Fixed UI | `z-40` | Contact button | `index.tsx:38` |
| Dialogs/modals | `z-50` | Overlays | `dialog.tsx:24,46` |
| Toasts | `z-[100]` | Notifications | `toast.tsx:20` |

### Route Structure

Current routes in the application:
- `apps/www/src/routes/__root.tsx` - Root layout
- `apps/www/src/routes/index.tsx` - Homepage
- `apps/www/src/routes/sitemap[.]xml.tsx` - Sitemap generation (no visual UI)

The `tools/` directory exists but the `twitter-banner.tsx` file does not exist yet (untracked in git status).

### Global CSS Configuration

**File**: `packages/ui/src/globals.css`

Body background is defined in the base layer (lines 222-229):
```css
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

Dark mode background color (line 152):
```css
.dark {
  --background: oklch(0 0 0); /* Pure black */
}
```

**File**: `apps/www/src/styles/app.css`

Simple import structure:
```css
@import "tailwindcss";
@import "@polychromos/ui/globals.css";
```

### Required Changes for Restructure

#### 1. Remove WebGL from Root Layout (`__root.tsx`)

**Lines to remove** (74-77):
```tsx
<Suspense fallback={null}>
  <WebGLBackground />
</Suspense>
```

**Lines to remove** (19-23):
```tsx
const WebGLBackground = lazy(() =>
  import("~/components/webgl-background").then((m) => ({
    default: m.WebGLBackground,
  })),
);
```

**Modify content wrapper** (line 78):
- Current: `<div className="relative z-10 flex min-h-screen flex-col">`
- After: `<div className="flex min-h-screen flex-col">` (remove `relative z-10` since no WebGL to layer above)

#### 2. Add WebGL to Homepage (`index.tsx`)

**Add lazy import at top**:
```tsx
const WebGLBackground = lazy(() =>
  import("~/components/webgl-background").then((m) => ({
    default: m.WebGLBackground,
  })),
);
```

**Modify component structure**:
```tsx
function HomePage() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      {/* WebGL Background - renders below content */}
      <Suspense fallback={null}>
        <WebGLBackground />
      </Suspense>

      <div className="relative z-10 min-h-screen text-foreground flex flex-col">
        {/* existing content */}
      </div>
    </>
  );
}
```

Key points:
- Wrap content in a fragment (`<>`) to include WebGL sibling
- Add `relative z-10` to the main content container
- WebGL uses `fixed inset-0 z-0` so it will position correctly without parent changes

#### 3. Body Background (No Changes Needed)

The body already has `bg-background` applied via `globals.css`, which provides:
- Dark mode: Pure black (`oklch(0 0 0)`)
- Light mode: Pure white (`oklch(1 0 0)`)

This serves as the fallback background for:
- All non-index routes
- Mobile devices (WebGL returns `null` on mobile)
- SSR/initial load (before WebGL hydrates)

### Z-Index Considerations for Index Route

After restructure, the index page z-index stack will be:

1. **Body** (`bg-background`) - Base layer, no z-index needed
2. **WebGL** (`fixed inset-0 z-0`) - Animated background layer
3. **Content** (`relative z-10`) - All visible content
4. **Contact button** (`fixed z-40`) - Floating above content
5. **Dialog** (`z-50`) - Modal overlay when open

The critical addition is `relative z-10` on the main content div to establish a stacking context above the WebGL canvas.

## Code References

- `apps/www/src/routes/__root.tsx:19-23` - WebGL lazy import (to remove)
- `apps/www/src/routes/__root.tsx:74-77` - WebGL render location (to remove)
- `apps/www/src/routes/__root.tsx:78` - Content wrapper z-index (to modify)
- `apps/www/src/routes/index.tsx:33` - Main container (to add z-10)
- `apps/www/src/components/webgl-background.tsx:190` - WebGL positioning
- `packages/ui/src/globals.css:226-228` - Body background styles

## Architecture Documentation

### TanStack Router File-Based Routing

The application uses TanStack Router with file-based routing:
- `__root.tsx` serves as the root layout wrapper for all routes
- `index.tsx` maps to the `/` path
- Route tree is auto-generated to `routeTree.gen.ts`

### Component Lazy Loading Pattern

The codebase consistently uses React's lazy loading for non-critical components:
```tsx
const Component = lazy(() =>
  import("~/path/to/component").then((m) => ({
    default: m.Component,
  })),
);
```

This pattern is used for:
- `Analytics` and `SpeedInsights` (root)
- `WebGLBackground` (root - to be moved)
- `ContactDialog` (index)

### Mobile-First Background Strategy

The WebGL background implements a mobile-first approach:
- Returns `null` on viewports < 768px
- Falls back to `body.bg-background` on mobile
- This behavior is preserved when moving to index route

## Open Questions

1. **Future routes with WebGL**: If other routes need the WebGL background in the future, should a shared layout route be created (e.g., `routes/_webgl/` layout group)?

2. **Tools routes**: The `tools/` directory exists with planned routes. Will these need different background treatment?

3. **SSR considerations**: The current lazy loading with `Suspense fallback={null}` handles SSR gracefully. This pattern should be preserved in the index route.
