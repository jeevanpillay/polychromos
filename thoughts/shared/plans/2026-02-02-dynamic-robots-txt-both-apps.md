# Dynamic robots.txt Implementation Plan

## Overview

Create dynamic robots.txt routes for both `apps/www` and `apps/polychromos-www` using the established `loader()` pattern from sitemap.xml.tsx. This enables environment-aware sitemap URLs and consistent route handling across apps.

## Current State Analysis

### apps/www
- **Has**: Static `public/robots.txt` with hardcoded domain `jeevanpillay.com`
- **Problem**: Can't adapt to different environments (preview deployments, staging)

### apps/polychromos-www
- **Has**: No robots.txt at all
- **Problem**: Missing SEO foundation

### Existing Pattern (sitemap[.]xml.tsx)
Both apps use identical pattern at `src/routes/sitemap[.]xml.tsx`:
```typescript
export function loader() {
  const baseUrl = env.VITE_APP_URL;
  // ...generate content...
  return new Response(content, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

## Desired End State

Both apps serve dynamic robots.txt at `/robots.txt` that:
- Uses `env.VITE_APP_URL` for environment-aware sitemap URL
- Returns proper `Content-Type: text/plain` header
- Caches for 24 hours (`max-age=86400`) per Google's caching behavior
- Disallows only real paths that shouldn't be indexed

### Verification
- `curl -I http://localhost:3000/robots.txt` returns `Content-Type: text/plain`
- `curl http://localhost:3000/robots.txt` shows correct sitemap URL
- `curl http://localhost:3001/robots.txt` works for polychromos-www
- Static `apps/www/public/robots.txt` no longer exists

## What We're NOT Doing

- Not adding placeholder disallow rules for non-existent paths
- Not creating a shared robots.txt utility (each app's config is simple enough)
- Not changing sitemap.xml implementations

## Implementation Approach

Follow the exact pattern from `sitemap[.]xml.tsx` with minimal changes:
- Same file naming convention: `robots[.]txt.ts`
- Same `loader()` export pattern
- Same Response construction

---

## Phase 1: Create Dynamic robots.txt for apps/www

### Overview
Replace static robots.txt with dynamic route that uses environment URL.

### Changes Required:

#### 1. Create Route File
**File**: `apps/www/src/routes/robots[.]txt.ts`

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

Disallow: /og.png
Disallow: /test/

Sitemap: ${baseUrl}/sitemap.xml`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

#### 2. Delete Static File
**File**: `apps/www/public/robots.txt`
**Action**: Delete this file

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] `pnpm dev:www` then `curl http://localhost:3000/robots.txt` returns:
  ```
  User-agent: *
  Allow: /

  Disallow: /og.png
  Disallow: /test/

  Sitemap: http://localhost:3000/sitemap.xml
  ```
- [ ] Response header includes `Content-Type: text/plain`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create Dynamic robots.txt for apps/polychromos-www

### Overview
Add new dynamic robots.txt route for polychromos-www.

### Changes Required:

#### 1. Create Route File
**File**: `apps/polychromos-www/src/routes/robots[.]txt.ts`

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

Disallow: /og.png

Sitemap: ${baseUrl}/sitemap.xml`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`

#### Manual Verification:
- [ ] Start polychromos-www dev server, then `curl http://localhost:3001/robots.txt` returns:
  ```
  User-agent: *
  Allow: /

  Disallow: /og.png

  Sitemap: http://localhost:3001/sitemap.xml
  ```
- [ ] Response header includes `Content-Type: text/plain`

---

## Testing Strategy

### Manual Testing Steps
1. Start both dev servers
2. Verify robots.txt content for each app
3. Verify Content-Type headers using `curl -I`
4. Confirm sitemap URLs are correct for each environment

### Production Verification (after deployment)
1. `curl https://jeevanpillay.com/robots.txt` shows correct sitemap URL
2. `curl https://polychromos.xyz/robots.txt` shows correct sitemap URL

## References

- Research document: `thoughts/shared/research/2026-02-02-robots-txt-tanstack-start-setup.md`
- Existing pattern: `apps/www/src/routes/sitemap[.]xml.tsx`
- Environment config: `apps/www/src/env.ts`, `apps/polychromos-www/src/env.ts`
