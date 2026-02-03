# Production Performance Optimization Implementation Plan

## Overview

Production deployment readiness for jeevanpillay.com covering font loading optimization, SEO configuration fixes, unused asset cleanup, and route deletion.

## Current State Analysis

The application is a TanStack Start site with SSR and prerendering enabled. The audit identified several optimization opportunities:

- **Font Loading**: Joyride fonts missing `font-display: swap`, no font preloading, 32 font files but only 4 used
- **SEO**: robots.txt has placeholder domain
- **Cleanup**: svg-converter route is no longer needed, unused font variants taking up space

### Key Discoveries:
- Joyride @font-face declarations lack `font-display` (`packages/ui/src/globals.css:8-34`)
- Only `Joyride` and `JoyrideALT` font families are used in code (`apps/www/src/routes/index.tsx:46-56`)
- robots.txt sitemap URL is `https://yourdomain.com/sitemap.xml` (`apps/www/public/robots.txt:8`)
- svg-converter route exists but is no longer needed (`apps/www/src/routes/svg-converter.tsx`)

## Desired End State

After implementation:
1. Lighthouse Performance score ≥ 90 on mobile
2. No font-related layout shifts (CLS < 0.1)
3. All SEO configurations point to jeevanpillay.com
4. Unused routes and assets removed
5. Reduced total asset size (~500KB+ savings from font cleanup)

### Verification:
- `pnpm build:www` completes without errors
- `pnpm typecheck` passes
- Lighthouse audit shows improved metrics
- Manual verification of font loading behavior

## What We're NOT Doing

- Adding TanStack Query (overkill for current app size)
- Implementing service workers or PWA features
- Adding image lazy loading (already handled by @unpic/react)
- Changing the router configuration (already optimized)
- Adding CSS-in-JS or changing styling approach
- Adding WOFF fallbacks (WOFF2 has 96%+ browser support)
- Supporting Safari < 14.1 or Firefox < 78

---

## Phase 1: Font Loading Optimization

### Overview
Fix font-display declarations, add preloading for critical fonts, and delete unused font files.

### Changes Required:

#### 1. Add font-display: swap to Joyride fonts
**File**: `packages/ui/src/globals.css`
**Changes**: Add `font-display: swap;` to all Joyride @font-face declarations

```css
/* Joyride Font - Standard */
@font-face {
  font-family: "Joyride";
  src:
    url("/fonts/joyride/JoyrideSTD.woff2") format("woff2"),
    url("/fonts/joyride/JoyrideSTD.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Joyride";
  src:
    url("/fonts/joyride/JoyrideSTDItalic.woff2") format("woff2"),
    url("/fonts/joyride/JoyrideSTDItalic.woff") format("woff");
  font-weight: normal;
  font-style: italic;
  font-display: swap;
}

/* Joyride Font - Alt */
@font-face {
  font-family: "JoyrideALT";
  src:
    url("/fonts/joyride/JoyrideALT.woff2") format("woff2"),
    url("/fonts/joyride/JoyrideALT.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

#### 2. Add font preloading to SEO helper
**File**: `apps/www/src/lib/seo.ts`
**Changes**: Add preload links for critical fonts in the `generateSEO` function

```typescript
links: [
  { rel: "canonical", href: canonicalUrl },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  // Critical font preloads
  {
    rel: "preload",
    href: "/fonts/joyride/JoyrideSTD.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/joyride/JoyrideALT.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
],
```

#### 3. Delete unused Joyride font files
**Location**: `apps/www/public/fonts/joyride/`
**Action**: Delete all font files except the ones actually used

**Files to KEEP** (8 files):
- `JoyrideSTD.woff2`, `JoyrideSTD.woff`
- `JoyrideSTDItalic.woff2`, `JoyrideSTDItalic.woff`
- `JoyrideALT.woff2`, `JoyrideALT.woff`
- `JoyrideALTItalic.woff2`, `JoyrideALTItalic.woff`

**Files to DELETE** (24 files, ~500KB+ savings):
- `JoyrideEXT.woff2`, `JoyrideEXT.woff`
- `JoyrideEXTItalic.woff2`, `JoyrideEXTItalic.woff`
- `JoyrideEXTOutline.woff2`, `JoyrideEXTOutline.woff`
- `JoyrideEXTOutlineItalic.woff2`, `JoyrideEXTOutlineItalic.woff`
- `JoyrideWIDE.woff2`, `JoyrideWIDE.woff`
- `JoyrideWIDEItalic.woff2`, `JoyrideWIDEItalic.woff`
- `JoyrideWIDEOutline.woff2`, `JoyrideWIDEOutline.woff`
- `JoyrideWIDEOutlineItalic.woff2`, `JoyrideWIDEOutlineItalic.woff`
- `JoyrideSTDOutline.woff2`, `JoyrideSTDOutline.woff`
- `JoyrideSTDOutlineItalic.woff2`, `JoyrideSTDOutlineItalic.woff`
- `JoyrideALTOutline.woff2`, `JoyrideALTOutline.woff`
- `JoyrideALTOutlineItalic.woff2`, `JoyrideALTOutlineItalic.woff`

### Success Criteria:

#### Automated Verification:
- [x] Build completes: `pnpm build:www`
- [x] Type checking passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint` (pre-existing lint errors in shadcn components)

#### Manual Verification:
- [ ] Homepage renders correctly with Joyride fonts
- [ ] No FOUT (Flash of Unstyled Text) visible on page load
- [ ] Contact dialog displays correctly with Joyride fonts
- [ ] DevTools Network tab shows fonts loading with preload priority

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: SEO & Configuration Fixes

### Overview
Fix robots.txt domain and add DNS prefetch for external domains.

### Changes Required:

#### 1. Fix robots.txt domain
**File**: `apps/www/public/robots.txt`
**Changes**: Update sitemap URL to production domain

```
User-agent: *
Allow: /

Disallow: /admin
Disallow: /api/
Disallow: /private/

Sitemap: https://jeevanpillay.com/sitemap.xml
```

#### 2. Add DNS prefetch for external domains
**File**: `apps/www/src/lib/seo.ts`
**Changes**: Add dns-prefetch links for external resources

```typescript
links: [
  // ... existing links ...
  // DNS prefetch for external domains
  { rel: "dns-prefetch", href: "https://x.com" },
  { rel: "dns-prefetch", href: "https://github.com" },
  { rel: "dns-prefetch", href: "https://linkedin.com" },
  { rel: "dns-prefetch", href: "https://lightfast.ai" },
],
```

### Success Criteria:

#### Automated Verification:
- [x] Build completes: `pnpm build:www`
- [x] robots.txt contains `jeevanpillay.com`: `grep "jeevanpillay.com" apps/www/public/robots.txt`

#### Manual Verification:
- [ ] View page source shows dns-prefetch links in `<head>`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Delete svg-converter Route

### Overview
Remove the unused svg-converter route and its dependencies.

### Changes Required:

#### 1. Delete the route file
**File**: `apps/www/src/routes/svg-converter.tsx`
**Action**: Delete this file completely

#### 2. Regenerate route tree
**Command**: Run `pnpm dev:www` briefly or `pnpm build:www` to regenerate `routeTree.gen.ts`

The route tree will automatically update to remove the svg-converter route.

### Success Criteria:

#### Automated Verification:
- [x] Build completes: `pnpm build:www`
- [x] Type checking passes: `pnpm typecheck`
- [x] Route file no longer exists: `! test -f apps/www/src/routes/svg-converter.tsx`

#### Manual Verification:
- [ ] Navigating to `/svg-converter` shows 404 page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Build Verification & Lighthouse Audit

### Overview
Final verification of all changes and performance benchmarking.

### Changes Required:

None - this phase is verification only.

### Success Criteria:

#### Automated Verification:
- [x] Full build passes: `pnpm build:www`
- [x] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint` (pre-existing errors in shadcn components)
- [ ] Preview build runs: `cd apps/www && pnpm preview`

#### Manual Verification:
- [ ] Run Lighthouse audit on homepage (target: Performance ≥ 90)
- [ ] Verify CLS < 0.1 (no layout shift from fonts)
- [ ] Verify LCP < 2.5s
- [ ] Test all routes: `/`, `/about`
- [ ] Test contact dialog opens and submits correctly
- [ ] Test on mobile viewport

#### Lighthouse Metrics Target:
| Metric | Target | Current (estimate) |
|--------|--------|-------------------|
| Performance | ≥ 90 | ~75-85 |
| Accessibility | ≥ 95 | ~90 |
| Best Practices | ≥ 95 | ~85 |
| SEO | 100 | ~90 |

---

## Testing Strategy

### Unit Tests:
- No new unit tests required (configuration changes only)

### Manual Testing Steps:
1. Clear browser cache and hard reload homepage
2. Observe font loading in DevTools Network tab
3. Check for any FOUT or layout shifts
4. Navigate between routes and verify transitions
5. Open contact dialog and submit test message
6. Run Lighthouse audit in incognito mode

## Performance Considerations

- Font preloading adds 3 additional early requests but eliminates render-blocking behavior
- Removing unused font files reduces total asset size by ~500KB
- DNS prefetch reduces connection time to external domains by ~100-200ms
- Deleting svg-converter route reduces bundle size slightly

## Migration Notes

- No database changes
- No API changes
- Changes are backwards compatible
- Can be deployed incrementally (phases are independent)

## References

- Original audit: `thoughts/shared/research/2026-01-31-performance-ssr-optimization-audit.md`
- Font loading best practices: https://web.dev/font-best-practices/
