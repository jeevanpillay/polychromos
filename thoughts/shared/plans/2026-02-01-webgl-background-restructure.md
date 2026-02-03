# WebGL Background Restructure - Moving from Root to Index Route

## Overview

Move the WebGL animated background from the root layout (`__root.tsx`) to only the homepage (`index.tsx`). Other routes will use the standard `bg-background` fallback. This change scopes the WebGL effect to where it's needed while reducing unnecessary rendering overhead on other routes.

## Current State Analysis

### Root Layout (`__root.tsx:19-77`)
- WebGL component is lazy-loaded at root level
- Renders inside `<Suspense>` as a sibling before the content wrapper
- Content wrapper uses `relative z-10` to layer above WebGL

### Homepage (`index.tsx:33`)
- Main container has `min-h-screen text-foreground flex flex-col`
- No z-index stacking context established
- Relies entirely on root for background

### WebGL Component (`webgl-background.tsx:190`)
- Uses `fixed inset-0 z-0` positioning
- Returns `null` on mobile (< 768px)
- Falls back to body's `bg-background` on mobile/SSR

### Other Routes
- `tools/canvas-kit.tsx` - Uses its own `bg-background` styling, unaffected by this change
- `sitemap[.]xml.tsx` - API route, no visual UI

## Desired End State

After implementation:
1. WebGL background only renders on the homepage (`/`)
2. All other routes display `bg-background` (pure black in dark mode)
3. Z-index layering works correctly on homepage
4. No performance overhead on non-index routes

### Verification:
- Visit `/` → animated WebGL gradient visible
- Visit `/tools/canvas-kit` → solid `bg-background` visible
- Mobile viewport → solid `bg-background` everywhere (WebGL returns null)

## What We're NOT Doing

- Modifying the WebGL component itself
- Changing the global CSS or body styling
- Creating a shared layout route for WebGL routes
- Adding WebGL to any other routes

## Implementation Approach

Single-phase modification:
1. Remove WebGL-related code from `__root.tsx`
2. Add WebGL to `index.tsx` with proper z-index layering

## Phase 1: Move WebGL from Root to Homepage

### Overview
Remove the WebGL background from the root layout and add it to the homepage with proper z-index layering.

### Changes Required:

#### 1. Remove WebGL from Root Layout
**File**: `apps/www/src/routes/__root.tsx`

**Remove lazy import (lines 19-23)**:
```tsx
// DELETE THESE LINES:
const WebGLBackground = lazy(() =>
  import("~/components/webgl-background").then((m) => ({
    default: m.WebGLBackground,
  })),
);
```

**Remove WebGL render (lines 74-77)**:
```tsx
// DELETE THESE LINES:
{/* WebGL Background - renders at body level, below content */}
<Suspense fallback={null}>
  <WebGLBackground />
</Suspense>
```

**Simplify content wrapper (line 78)**:
```tsx
// CHANGE FROM:
<div className="relative z-10 flex min-h-screen flex-col">

// CHANGE TO:
<div className="flex min-h-screen flex-col">
```

#### 2. Add WebGL to Homepage
**File**: `apps/www/src/routes/index.tsx`

**Add lazy import after existing imports**:
```tsx
const WebGLBackground = lazy(() =>
  import("~/components/webgl-background").then((m) => ({
    default: m.WebGLBackground,
  })),
);
```

**Wrap HomePage return in fragment with WebGL sibling and add z-10 to content**:
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
        {/* existing content unchanged */}
      </div>
    </>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript passes: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`
- [x] Lint passes: `pnpm lint` (pre-existing warnings only, no new issues)

#### Manual Verification:
- [ ] Homepage (`/`) displays animated WebGL gradient on desktop
- [ ] Homepage content is clickable and interactive (z-index correct)
- [ ] Contact button opens dialog correctly
- [ ] `/tools/canvas-kit` shows solid background (no WebGL)
- [ ] Mobile viewport shows solid background on all routes
- [ ] Page transitions work smoothly

---

## Testing Strategy

### Automated Tests:
- TypeScript compilation validates imports and component structure
- Build process validates code bundling

### Manual Testing Steps:
1. Open homepage on desktop (> 768px width)
2. Verify animated gradient is visible behind content
3. Click "Contact me" button - dialog should open
4. Navigate to `/tools/canvas-kit`
5. Verify solid black background (no gradient)
6. Resize browser to mobile width (< 768px)
7. Verify solid black background on homepage (WebGL returns null)

## Performance Considerations

- WebGL canvas only initializes on homepage, reducing memory usage on other routes
- Lazy loading pattern preserved for code splitting
- No change to Three.js resource lifecycle

## References

- Research document: `thoughts/shared/research/2026-02-01-webgl-background-restructure.md`
- Root layout: `apps/www/src/routes/__root.tsx:19-78`
- Homepage: `apps/www/src/routes/index.tsx:33`
- WebGL component: `apps/www/src/components/webgl-background.tsx:190`
