# Dynamic OG Images for polychromos-www Implementation Plan

## Overview

Implement dynamic OG image generation for polychromos-www using Takumi (Rust-powered image renderer) with TanStack Start's server handler architecture. The OG image will feature the Polychromos brand aesthetic: dark background, HW Animo font, with the tagline "DESIGN IS NO LONGER STATIC PIXELS. IT IS EXECUTABLE LOGIC." at bottom-left and the POLYCHROMOS logo at top-right.

## Current State Analysis

### What Exists
- Basic meta tags in `__root.tsx:21-28` (charset, viewport, title, description)
- Nitro configured with `serverDir: "server"` in `vite.config.ts:19-21`
- HW Animo fonts available in `public/fonts/hw-animo/`
- No API routes exist (only `/` and catch-all `/$`)

### What's Missing
- Open Graph meta tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
- Twitter Card meta tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- Takumi dependencies for image generation
- OG image API route
- Nitro externals configuration for Takumi binaries

### Key Discoveries
- TanStack Start uses `server.handlers.GET` pattern for API routes (`apps/www/src/routes/sitemap[.]xml.tsx:24-34`)
- Takumi requires dynamic import to avoid client bundle bloat
- Nitro externals needed for Vercel deployment to include platform-specific Rust binaries
- Font files are woff2 format in `public/fonts/hw-animo/`

## Desired End State

After implementation:
1. Visiting `https://polychromos.xyz/api/og` returns a 1200x630 PNG image
2. The image displays:
   - Dark background (#0a0a0a matching site theme)
   - "POLYCHROMOS" logo at top-right in HW Animo Semi Expanded
   - "DESIGN IS NO LONGER STATIC PIXELS. IT IS EXECUTABLE LOGIC." at bottom-left
3. All pages include proper OG and Twitter Card meta tags
4. Social sharing on Twitter/LinkedIn/Facebook shows the branded preview

### Verification
- `curl -I https://polychromos.xyz/api/og` returns `Content-Type: image/png`
- Meta tags validator (e.g., opengraph.xyz) shows correct preview
- Twitter Card validator shows correct preview

## What We're NOT Doing

- Dynamic per-page OG images (single static image for MVP)
- Custom fonts embedded as base64 (using system fonts initially, custom fonts as enhancement)
- robots.txt or sitemap.xml (separate task)
- Analytics integration (separate task)
- Security headers (separate task)

## Implementation Approach

1. Install Takumi dependencies
2. Configure Nitro externals for Vercel deployment
3. Create OG image API route with server handler
4. Add OG/Twitter meta tags to root route
5. Test locally and verify on deployment

---

## Phase 1: Install Dependencies and Configure Nitro

### Overview
Add Takumi packages and configure Vite/Nitro to include Rust binaries in the Vercel build.

### Changes Required

#### 1. Package Dependencies
**File**: `apps/polychromos-www/package.json`
**Changes**: Add Takumi dependencies

```json
{
  "dependencies": {
    "@takumi-rs/core": "^0.1.0",
    "@takumi-rs/helpers": "^0.1.0",
    "@takumi-rs/image-response": "^0.1.0"
  }
}
```

Run: `pnpm install` from workspace root

#### 2. Vite Configuration
**File**: `apps/polychromos-www/vite.config.ts`
**Changes**: Add Nitro externals for Takumi binaries

```typescript
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3002,
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      serverDir: "server",
      preset: "vercel",
      externals: {
        traceInclude: [
          "node_modules/@takumi-rs/core",
          "node_modules/@takumi-rs/image-response",
          "node_modules/@takumi-rs/helpers",
          "node_modules/@takumi-rs/core-linux-x64-gnu",
          "node_modules/@takumi-rs/core-linux-arm64-gnu",
          "node_modules/@takumi-rs/core-darwin-arm64",
          "node_modules/@takumi-rs/core-darwin-x64",
        ],
      },
    }),
    viteReact(),
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
});
```

### Success Criteria

#### Automated Verification
- [x] Dependencies install without errors: `pnpm install`
- [x] Build completes successfully: `pnpm build --filter=@repo/polychromos-www`
- [x] TypeScript compiles: `pnpm typecheck --filter=@repo/polychromos-www`

#### Manual Verification
- [x] Verify `node_modules/@takumi-rs/` directory exists with platform binaries

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create OG Image API Route

### Overview
Create the server-side API route that generates the OG image using Takumi's ImageResponse.

### Changes Required

#### 1. Create API Route Directory Structure
**Directory**: `apps/polychromos-www/src/routes/api/`

#### 2. Create OG Image Route
**File**: `apps/polychromos-www/src/routes/api/og.tsx`
**Changes**: New file

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async () => {
        const { ImageResponse } = await import("@takumi-rs/image-response");

        return new ImageResponse(<OgImage />, {
          width: 1200,
          height: 630,
        });
      },
    },
  },
});

function OgImage() {
  return (
    <div
      style={{
        backgroundColor: "#0a0a0a",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "60px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top Right: Logo */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        <span
          style={{
            color: "#fafafa",
            fontSize: "32px",
            fontWeight: "600",
            letterSpacing: "0.05em",
          }}
        >
          POLYCHROMOS
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom Left: Tagline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "900px",
        }}
      >
        <span
          style={{
            color: "#fafafa",
            fontSize: "48px",
            fontWeight: "600",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          DESIGN IS NO LONGER
        </span>
        <span
          style={{
            color: "#fafafa",
            fontSize: "48px",
            fontWeight: "600",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          STATIC PIXELS.
        </span>
        <span
          style={{
            color: "#a1a1aa",
            fontSize: "48px",
            fontWeight: "400",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginTop: "8px",
          }}
        >
          IT IS EXECUTABLE LOGIC.
        </span>
      </div>
    </div>
  );
}
```

### Success Criteria

#### Automated Verification
- [x] Build completes: `pnpm build --filter=@repo/polychromos-www`
- [x] TypeScript compiles: `pnpm typecheck --filter=@repo/polychromos-www`
- [x] Linting passes: `pnpm lint --filter=@repo/polychromos-www` (og.tsx passes, pre-existing env.ts issues)

#### Manual Verification
- [ ] Start dev server: `pnpm dev --filter=@repo/polychromos-www`
- [ ] Navigate to `http://localhost:3002/api/og` returns an image
- [ ] Image displays correctly: dark background, logo top-right, tagline bottom-left
- [ ] Image dimensions are 1200x630 pixels

**Implementation Note**: After completing this phase and verifying the image renders correctly, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Add Meta Tags to Root Route

### Overview
Update the root route to include Open Graph and Twitter Card meta tags referencing the OG image endpoint.

### Changes Required

#### 1. Update Root Route Head
**File**: `apps/polychromos-www/src/routes/__root.tsx`
**Changes**: Add OG and Twitter meta tags

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

import "../styles/app.css";

const siteUrl = "https://polychromos.xyz";
const title = "Polychromos";
const description = "Code-driven design platform. Bridge the gap between Figma and React.";
const ogImage = `${siteUrl}/api/og`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      // Basic
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },

      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Polychromos" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: siteUrl },

      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg" },
      { rel: "canonical", href: siteUrl },
    ],
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

### Success Criteria

#### Automated Verification
- [x] Build completes: `pnpm build --filter=@repo/polychromos-www`
- [x] TypeScript compiles: `pnpm typecheck --filter=@repo/polychromos-www`
- [x] Linting passes: `pnpm lint --filter=@repo/polychromos-www` (seo.ts passes, pre-existing env.ts issues)

#### Manual Verification
- [ ] View page source at `http://localhost:3002/` - verify OG meta tags present
- [ ] All meta tags have correct values (title, description, image URL)
- [ ] `og:image` points to `/api/og` with full URL

**Implementation Note**: After completing this phase, proceed to Phase 4 for production verification.

---

## Phase 4: Production Verification

### Overview
Deploy and verify OG images work correctly in production on Vercel.

### Changes Required

No code changes. Deploy and test.

### Success Criteria

#### Automated Verification
- [ ] Vercel build completes successfully
- [ ] `curl -I https://polychromos.xyz/api/og` returns 200 with `Content-Type: image/png`

#### Manual Verification
- [ ] Visit https://polychromos.xyz/api/og directly - image renders
- [ ] Test with https://www.opengraph.xyz/url/https://polychromos.xyz/ - shows correct preview
- [ ] Test with https://cards-dev.twitter.com/validator - shows correct Twitter Card
- [ ] Share link on Twitter/LinkedIn/Slack - preview image appears correctly

**Implementation Note**: If the OG image doesn't render on Vercel, check:
1. Nitro externals configuration includes all platform binaries
2. Vercel function logs for errors
3. Try adding more traceInclude paths for missing binaries

---

## Testing Strategy

### Unit Tests
- None required for MVP (OG image is visual output)

### Integration Tests
- Verify `/api/og` route returns 200 status
- Verify Content-Type header is `image/png`
- Verify response body is non-empty

### Manual Testing Steps
1. Start dev server and visit `/api/og`
2. Verify image renders with correct layout
3. View page source and verify all meta tags present
4. Use browser dev tools Network tab to verify og:image URL resolves
5. Test with social media debugger tools

---

## Performance Considerations

1. **Caching**: Consider adding cache headers to the OG image response:
   ```typescript
   return new ImageResponse(<OgImage />, {
     width: 1200,
     height: 630,
     headers: {
       "Cache-Control": "public, max-age=86400, s-maxage=86400",
     },
   });
   ```

2. **Cold Start**: First request may be slower due to Rust binary initialization. Subsequent requests will be faster.

3. **Bundle Size**: Dynamic import of `@takumi-rs/image-response` keeps it out of the client bundle.

---

## Future Enhancements (Out of Scope)

1. **Custom Fonts**: Embed HW Animo font for exact brand match (requires base64 encoding)
2. **Dynamic Content**: Accept query params for page-specific titles
3. **Multiple Sizes**: Generate different sizes for different platforms
4. **Image Caching**: Use Vercel Edge Config or KV for generated image caching

---

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-www-dynamic-og-images.md`
- Production readiness: `thoughts/shared/research/2026-02-02-polychromos-www-production-readiness.md`
- Reference implementation: https://www.gvizo.so/posts/tanstack-start-dynamic-og-images
- Root route: `apps/polychromos-www/src/routes/__root.tsx`
- Vite config: `apps/polychromos-www/vite.config.ts`
- Fonts CSS: `apps/polychromos-www/src/styles/fonts.css`
