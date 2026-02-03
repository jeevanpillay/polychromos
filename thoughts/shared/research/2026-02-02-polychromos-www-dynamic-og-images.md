---
date: 2026-02-02T16:45:00+11:00
researcher: Claude
git_commit: abbd13a70efe2adae2ac4617a7c80bb18c15daee
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Dynamic OG Image Implementation for polychromos-www"
tags: [research, codebase, polychromos-www, og-images, takumi, tanstack-start]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Dynamic OG Image Implementation for polychromos-www

**Date**: 2026-02-02T16:45:00+11:00
**Researcher**: Claude
**Git Commit**: abbd13a70efe2adae2ac4617a7c80bb18c15daee
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

How to implement dynamic OG images for polychromos-www following the pattern from https://www.gvizo.so/posts/tanstack-start-dynamic-og-images

## Summary

This document describes the current state of polychromos-www and how dynamic OG image generation using Takumi (a Rust-powered image renderer) can be implemented using TanStack Start's server handler architecture.

## Reference Implementation (from gvizo.so article)

The article describes using **Takumi** (not Satori) for dynamic OG image generation in TanStack Start:

### Dependencies Required

```bash
bun add @takumi-rs/core @takumi-rs/helpers @takumi-rs/image-response
```

### Vite Configuration for Vercel Deployment

To ensure platform-specific Rust binaries are included in the build:

```typescript
// vite.config.ts
nitro: {
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
}
```

### API Route Pattern

```tsx
// src/routes/api/og.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { ImageResponse } = await import("@takumi-rs/image-response");

        const url = new URL(request.url);
        const title = url.searchParams.get("title");
        const author = url.searchParams.get("author");

        return new ImageResponse(
          <OgImage title={title} author={author} />,
          { width: 1200, height: 630 }
        );
      },
    },
  },
});

function OgImage({ title = "Your title", author = "Author" }) {
  return (
    <div style={{
      backgroundColor: "#ffffff",
      width: "100%",
      height: "100%",
      padding: "5% 10%",
      display: "flex",
      flexDirection: "column",
    }}>
      <p style={{ color: "#000000", fontSize: "60px" }}>{title}</p>
      <div style={{ marginTop: "auto" }}>
        <p style={{ color: "#000000", fontSize: "30px", fontWeight: "bold" }}>
          {author}
        </p>
      </div>
    </div>
  );
}
```

### Meta Tag Integration

```tsx
// In route head() function
head: () => ({
  meta: [
    {
      name: "og:image",
      content: "YOUR_URL/og?title=YOUR_TITLE&author=YOUR_AUTHOR",
    },
  ],
}),
```

## Current State: polychromos-www

### Root Route Configuration

**File**: `apps/polychromos-www/src/routes/__root.tsx:20-29`

```typescript
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Polychromos" },
      { name: "description", content: "Code-driven design platform" },
    ],
    links: [{ rel: "icon", href: "/favicon.svg" }],
  }),
  // ...
});
```

**Current gaps**:
- No Open Graph meta tags
- No Twitter Card meta tags
- No og:image defined

### Vite Configuration

**File**: `apps/polychromos-www/vite.config.ts`

```typescript
export default defineConfig({
  server: { port: 3002 },
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
});
```

**Note**: No Nitro preset or externals configuration currently defined.

### Current Dependencies

**File**: `apps/polychromos-www/package.json`

Key dependencies:
- `@tanstack/react-router`: catalog version
- `@tanstack/react-start`: catalog version
- `nitro`: 3.0.1-alpha.0
- `react`: React 19
- `zod`: ^4.3.6

**Not installed**:
- `@takumi-rs/core`
- `@takumi-rs/helpers`
- `@takumi-rs/image-response`

### Existing Server Function Pattern

**File**: `apps/polychromos-www/src/functions/waitlist.ts`

Shows the current pattern for server-side code using `createServerFn`:

```typescript
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: WaitlistFormData) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    // Server-side logic here
  });
```

### Existing Route Handler Pattern (from apps/www)

**File**: `apps/www/src/routes/sitemap[.]xml.tsx:24-34`

Shows an alternative pattern using `loader()` export:

```typescript
export function loader() {
  const baseUrl = env.VITE_APP_URL;
  const sitemap = generateSitemapXML(defaultSitemapEntries, baseUrl);

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

## Existing OG Pattern in apps/www

**File**: `apps/www/src/lib/seo.ts:20-88`

The main www app has a `generateSEO()` helper that includes OG tags:

```typescript
export function generateSEO(config: SEOConfig) {
  const {
    ogImage = `${env.VITE_APP_URL}/og-image.png`,
    // ...
  } = config;

  return {
    meta: [
      // Open Graph
      { property: "og:type", content: ogType },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      { property: "og:url", content: canonicalUrl },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      // ...
    ],
  };
}
```

**Note**: This references static images that don't actually exist in the codebase.

## Fonts Available for OG Images

**Directory**: `apps/polychromos-www/public/fonts/`

Available fonts for embedding in OG images:
- **PP Neue Montreal**: `/fonts/pp-neue-montreal/` (6 woff2 files: Thin, Book, Medium, Bold, Italic, Semi Bold Italic)
- **HW Animo**: `/fonts/hw-animo/` (44 font files, various widths)
- **Joyride**: `/fonts/joyride/` (8 font files, STD and ALT variants)

## Code References

- Root route: `apps/polychromos-www/src/routes/__root.tsx:20-29`
- Vite config: `apps/polychromos-www/vite.config.ts:9-27`
- Package.json: `apps/polychromos-www/package.json:15-27`
- Server function example: `apps/polychromos-www/src/functions/waitlist.ts:12-34`
- SEO helper (www): `apps/www/src/lib/seo.ts:20-88`
- Sitemap route (www): `apps/www/src/routes/sitemap[.]xml.tsx:24-34`
- Font CSS: `apps/polychromos-www/src/styles/fonts.css`

## Implementation Requirements

To implement dynamic OG images for polychromos-www, the following would be needed:

### New Files to Create

1. **API Route**: `apps/polychromos-www/src/routes/api/og.tsx`
   - Server handler using TanStack Start's route `server.handlers.GET` pattern
   - Dynamically imports `@takumi-rs/image-response`
   - Accepts query parameters (title, etc.)
   - Returns `ImageResponse` with JSX component

2. **OG Component**: Can be inline in the API route or separate file
   - Uses inline styles (required for image renderers)
   - Standard dimensions: 1200x630 pixels
   - Can embed fonts via base64 or URL

### Files to Modify

1. **`apps/polychromos-www/package.json`**
   - Add Takumi dependencies

2. **`apps/polychromos-www/vite.config.ts`**
   - Add Nitro externals configuration for Takumi binaries

3. **`apps/polychromos-www/src/routes/__root.tsx`**
   - Add Open Graph meta tags
   - Add Twitter Card meta tags
   - Reference dynamic OG image URL

## Key Implementation Notes

1. **Dynamic imports**: `ImageResponse` should be dynamically imported server-side to avoid bloating client bundles

2. **Inline styles**: Image renderers like Takumi/Satori require inline `style` objects, not CSS classes

3. **Font embedding**: Custom fonts need to be loaded as base64 or fetched at render time

4. **Caching**: Consider adding cache headers to the OG image response for performance

5. **Query parameters**: Use URL search params to customize image content dynamically

## Related Research

- `thoughts/shared/research/2026-02-02-polychromos-www-production-readiness.md` - Documents missing OG tags
- `thoughts/shared/research/2026-01-31-twitter-banner-layered-i-effect.md` - Mentions Satori + resvg for image generation

## Open Questions

1. Should the OG image include dynamic content (e.g., page title) or be static for the landing page?
2. Which fonts from the available set should be used in the OG image?
3. What branding elements (logo, colors, imagery) should be included?
4. Should there be page-specific OG images or a single site-wide image?
