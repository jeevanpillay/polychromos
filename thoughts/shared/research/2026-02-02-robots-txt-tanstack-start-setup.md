---
date: 2026-02-02T12:26:03Z
researcher: Claude
git_commit: f698e11cf1e6e188e6504f189b3b4b23c5151372
branch: feat/polychromos-mvp-implementation
repository: x
topic: "robots.txt Setup for TanStack Start Applications"
tags: [research, codebase, robots-txt, seo, tanstack-start, static-files]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: robots.txt Setup for TanStack Start Applications

**Date**: 2026-02-02T12:26:03Z
**Researcher**: Claude
**Git Commit**: f698e11cf1e6e188e6504f189b3b4b23c5151372
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Full end-to-end setup of robots.txt for TanStack Start apps, specifically for both polychromos-www and www applications.

## Summary

The codebase has two approaches for serving robots.txt in TanStack Start applications:

1. **Static file in `public/` directory** - Currently used by `apps/www`
2. **Dynamic server route** - Pattern available but not used for robots.txt (used for sitemap.xml and og.png)

The `apps/www` app already has a working robots.txt at `apps/www/public/robots.txt`. The `apps/polychromos-www` app currently lacks a robots.txt file.

## Detailed Findings

### Current State: apps/www

**Existing robots.txt**: `apps/www/public/robots.txt`

```txt
User-agent: *
Allow: /

Disallow: /admin
Disallow: /api/
Disallow: /private/

Sitemap: https://jeevanpillay.com/sitemap.xml
```

This file is automatically served at `/robots.txt` via Vite's static file handling. Files in the `public/` directory are:
- Served at the root path during development
- Copied to `.output/public/` during production builds
- Handled by Nitro's built-in asset handler with automatic content-type detection, ETags, and caching

### Current State: apps/polychromos-www

**No robots.txt exists**. The public directory contains:
- `favicon.svg`
- `fonts/` directory (hw-animo, pp-neue-montreal)

### How Static Files Are Served

Both apps use identical Vite configurations at:
- `apps/www/vite.config.ts`
- `apps/polychromos-www/vite.config.ts`

The configuration includes:
- `tanstackStart()` plugin - Integrates TanStack Start framework
- `nitro()` plugin with `preset: "vercel"` - Server framework for handling requests
- No explicit `publicDir` configuration (Vite defaults to `public/`)

During build, static files are compiled into `.output/public/` with a manifest that includes MIME types, ETags, and mtimes for efficient serving.

### Approach 1: Static File (Recommended for Simple Use)

**Location**: `apps/{app-name}/public/robots.txt`

**How it works**:
- Place `robots.txt` directly in the `public/` directory
- Vite serves files from `public/` at root path `/` during development
- Files are copied as-is to build output during production
- No code changes needed

**Example for polychromos-www**: `apps/polychromos-www/public/robots.txt`

```txt
User-agent: *
Allow: /

Disallow: /api/
Disallow: /admin/

Sitemap: https://polychromos.design/sitemap.xml
```

### Approach 2: Dynamic Server Route (For Environment-Specific Content)

**Location**: `apps/{app-name}/src/routes/robots[.]txt.ts`

Uses the same pattern as the existing sitemap.xml routes. The bracket notation `[.]` escapes the dot to create a literal `.txt` extension in the URL.

**Pattern from sitemap.xml**: `apps/www/src/routes/sitemap[.]xml.tsx:24-34`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env";

export const Route = createFileRoute("/robots.txt")({
  component: () => null,
});

export function loader() {
  const baseUrl = env.VITE_APP_URL;
  const content = `User-agent: *
Allow: /

Disallow: /api/
Disallow: /admin/

Sitemap: ${baseUrl}/sitemap.xml`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

**Advantages**:
- Environment-aware (can use `VITE_APP_URL` for correct domain)
- Can generate content dynamically
- Different rules for staging vs production possible

### Environment Configuration

Both apps use `@t3-oss/env-core` for environment management:

**apps/www/src/env.ts**:
- Fallback: `http://localhost:3000`
- Production: Uses `VITE_APP_URL` or `VERCEL_URL`

**apps/polychromos-www/src/env.ts**:
- Fallback: `http://localhost:3001`
- Production: Uses `VITE_APP_URL` or `VERCEL_URL`

### Existing Dynamic Route Patterns

The codebase already uses dynamic routes for:

1. **Sitemap.xml**: `apps/*/src/routes/sitemap[.]xml.tsx`
   - Uses `loader()` export returning `Response` with XML content
   - Sets `Content-Type: application/xml`

2. **OG Images**: `apps/*/src/routes/og[.]png.tsx`
   - Uses `server.handlers.GET` for server-only code
   - Returns `ImageResponse` with PNG content

### Build Output Structure

Static files end up in these locations after build:

```
apps/www/.output/public/robots.txt     # Served by Nitro
apps/www/.vercel/output/static/robots.txt  # Vercel deployment
apps/www/dist/client/robots.txt        # Client dist
```

## Code References

- `apps/www/public/robots.txt` - Existing static robots.txt
- `apps/www/src/routes/sitemap[.]xml.tsx:24-34` - Dynamic route pattern for text/XML responses
- `apps/www/vite.config.ts` - Vite configuration with Nitro
- `apps/www/src/env.ts:5-8` - Environment URL configuration
- `apps/polychromos-www/src/env.ts:5-8` - Polychromos environment URL configuration
- `apps/polychromos-www/public/` - Public directory (no robots.txt)

## Architecture Documentation

### Static File Flow

```
public/robots.txt
    ↓ (Vite dev server)
http://localhost:3000/robots.txt
    ↓ (Build)
.output/public/robots.txt
    ↓ (Nitro asset handler)
https://domain.com/robots.txt
```

### Dynamic Route Flow

```
src/routes/robots[.]txt.ts
    ↓ (TanStack Router)
Route definition with loader()
    ↓ (Server request)
loader() returns Response
    ↓
https://domain.com/robots.txt
```

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2026-01-31-tanstack-start-router-production-setup.md` - Production setup patterns
- `thoughts/shared/research/2026-02-02-polychromos-tanstack-start-setup.md` - Polychromos app setup
- `thoughts/shared/research/2026-02-02-polychromos-www-production-readiness.md` - Production readiness

## Implementation Checklist

### For apps/polychromos-www (Static Approach)

1. Create `apps/polychromos-www/public/robots.txt`:
   ```txt
   User-agent: *
   Allow: /

   Disallow: /api/
   Disallow: /admin/

   Sitemap: https://polychromos.design/sitemap.xml
   ```

### For Dynamic Approach (Either App)

1. Create `apps/{app-name}/src/routes/robots[.]txt.ts`
2. Export `loader()` function returning `Response` with `Content-Type: text/plain`
3. Use `env.VITE_APP_URL` for dynamic sitemap URL

## Open Questions

1. What is the production domain for polychromos-www? (Assumed `polychromos.design` based on naming)
2. Are there specific paths in polychromos-www that should be disallowed (e.g., authenticated routes)?
3. Should robots.txt be different for preview/staging deployments vs production?
