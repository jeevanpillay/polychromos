---
date: 2026-02-01T12:00:00+10:00
researcher: Claude
git_commit: bf03fc6f3ab9d29985a32a900e0febc8b3897033
branch: main
repository: x
topic: "Not-Found Component and 404 Routing Investigation"
tags: [research, codebase, tanstack-router, 404, not-found, mobile-nav]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
---

# Research: Not-Found Component and 404 Routing Investigation

**Date**: 2026-02-01T12:00:00+10:00
**Researcher**: Claude
**Git Commit**: bf03fc6f3ab9d29985a32a900e0febc8b3897033
**Branch**: main
**Repository**: x

## Research Question

1. Why does visiting routes like `/123` show "Cannot GET /123" instead of the not-found component?
2. What is the mobile nav component pattern that should be used for the 404 page header?

## Summary

The investigation found that the 404 handling is configured correctly in TanStack Router with `notFoundMode: "fuzzy"` and a `CustomNotFoundComponent` registered on the root route. The "Cannot GET /123" message comes from the Nitro/Node.js HTTP server layer before TanStack Router can handle the request during SSR.

The mobile navigation pattern exists inline in the homepage (`index.tsx`), not as a separate component. It uses a flex layout with the "JEEVAN PILLAY" logo text (using Joyride fonts) on the left and a "Contact me" pill button on the right.

## Detailed Findings

### Issue 1: "Cannot GET /123" Error

#### Current 404 Configuration

| Configuration | Location | Value |
|---------------|----------|-------|
| Root notFoundComponent | `apps/www/src/routes/__root.tsx:46` | `CustomNotFoundComponent` |
| Router notFoundMode | `apps/www/src/router.tsx:26` | `"fuzzy"` |

**Root Route Configuration** (`apps/www/src/routes/__root.tsx:26, 46`):
```typescript
import { CustomNotFoundComponent } from "~/components/not-found-component";

export const Route = createRootRoute({
  notFoundComponent: () => <CustomNotFoundComponent />,
  // ...
});
```

**Router Configuration** (`apps/www/src/router.tsx:26`):
```typescript
export function getRouter() {
  const router = createRouter({
    routeTree,
    notFoundMode: "fuzzy",
    // ... other options
  });
  return router;
}
```

#### Why "Cannot GET /123" Appears

The "Cannot GET /123" message originates from the Nitro/Node.js HTTP server layer rather than TanStack Router. The SSR request handling flow:

1. Request comes to Nitro server for `/123`
2. Nitro processes the request through its handlers
3. TanStack Router attempts to match during SSR
4. If router's not-found handling doesn't properly return a response during SSR, Nitro's default HTTP error response is shown

The configuration appears correct, suggesting this may be a TanStack Start SSR-specific behavior where the not-found case needs explicit handling at the server level.

#### Route Tree Structure

Current routes defined in `apps/www/src/routeTree.gen.ts`:
- `/` (IndexRoute)
- `/sitemap.xml` (SitemapDotxmlRoute)
- `/tools/canvas-kit` (ToolsCanvasKitRoute)

### Issue 2: Mobile Navigation Pattern

The mobile navigation is **not** a separate component - it's embedded directly in the homepage route.

**Location**: `apps/www/src/routes/index.tsx:64-78`

```tsx
{/* Mobile Header - Name + Contact Button */}
<div className="flex lg:hidden items-center justify-between mb-8">
  <h1
    className="text-lg"
    style={{ fontFamily: "Joyride, sans-serif" }}
  >
    JEEVAN{" "}
    <span style={{ fontFamily: "JoyrideALT, sans-serif" }}>P</span>
    <span style={{ fontFamily: "JoyrideALT, sans-serif" }}>I</span>
    LLAY
  </h1>
  <Button size="pill" onClick={() => setContactOpen(true)}>
    Contact me
  </Button>
</div>
```

#### Header Layout Pattern

- **Container**: `flex items-center justify-between`
- **Left side**: Logo text using Joyride fonts
- **Right side**: Contact button with `size="pill"` variant
- **Responsive**: `flex lg:hidden` (mobile only)

#### Logo Typography Pattern

The "JEEVAN PILLAY" branding uses a specific font pattern:
- Most letters use `Joyride` font
- Letters "P" and "I" use `JoyrideALT` font
- All caps

#### Button Variants Available

From `packages/ui/src/components/ui/button.tsx`:
- `size="pill"`: `h-10 rounded-full px-8` - Used for contact buttons
- `variant="clean"`: `text-secondary hover:text-secondary/80` - Used for close buttons

#### Font Definitions

**Joyride Font** (`packages/ui/src/globals.css:7-33`):
- Custom font files in `/fonts/joyride/` directory
- Two variants: `Joyride` and `JoyrideALT`

### Current Not-Found Component

**Location**: `apps/www/src/components/not-found-component.tsx`

```tsx
export function CustomNotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-7xl font-bold text-primary">404</h1>
        <p className="mb-2 text-2xl font-semibold">Page Not Found</p>
        <p className="mb-8 text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Current structure:
- Centered content with flex column layout
- Large "404" text (7xl)
- "Page Not Found" heading
- Description text
- "Go Home" link button

## Code References

- `apps/www/src/components/not-found-component.tsx` - Current 404 component
- `apps/www/src/routes/__root.tsx:46` - notFoundComponent registration
- `apps/www/src/router.tsx:26` - notFoundMode configuration
- `apps/www/src/routes/index.tsx:64-78` - Mobile header pattern
- `packages/ui/src/components/ui/button.tsx` - Button component with pill size
- `packages/ui/src/globals.css:7-33` - Joyride font definitions
- `apps/www/src/components/contact-dialog.tsx:86-100` - Similar header pattern in dialog

## Architecture Documentation

### TanStack Start + Nitro SSR Stack

The application uses:
- TanStack Start (1.140.5) with TanStack Router
- Nitro as the server runtime
- Vite for bundling

The `tanstackStart()` and `nitro()` Vite plugins automatically generate SSR and client entry points. Router configuration is pulled from `src/router.tsx` and `src/routeTree.gen.ts`.

### Responsive Pattern

- Mobile: `flex lg:hidden`
- Desktop: `hidden lg:inline-flex`
- Breakpoint: `lg` (1024px)

## Open Questions

1. Does TanStack Start require explicit SSR handler configuration for 404 responses?
2. Is there a Nitro-specific configuration needed for catch-all routes?
3. Should a dedicated mobile header component be extracted for reuse?
