---
date: 2026-02-03T09:58:50Z
researcher: Claude
git_commit: 3ed272a445bd4c5248ac4e62aaaa3e208602d713
branch: main
repository: polychromos
topic: "Vercel Microfrontends Setup Between apps/www and apps/app"
tags: [research, codebase, vercel, microfrontends, turborepo, tanstack-start, deployment]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Vercel Microfrontends Setup Between apps/www and apps/app

**Date**: 2026-02-03T09:58:50Z
**Researcher**: Claude
**Git Commit**: 3ed272a445bd4c5248ac4e62aaaa3e208602d713
**Branch**: main
**Repository**: polychromos

## Research Question

How to set up the latest Vercel microfrontends between `apps/polychromos-www` and `apps/polychromos-app` in the polychromos monorepo.

## Summary

Vercel's microfrontends platform reached **General Availability on October 31, 2025**, providing native support for splitting applications into independently deployable units that render as one cohesive application. The platform processes nearly 1 billion microfrontends routing requests per day with 250+ teams in production.

The polychromos monorepo is well-positioned to adopt Vercel microfrontends given its existing Turborepo + pnpm workspaces structure. Both apps (`polychromos-app` and `polychromos-www`) already deploy as separate Vercel projects, and the shared `@repo/ui` package follows Vercel's recommended pattern for component sharing.

**Key consideration**: Both apps currently use **TanStack Start** (not Next.js), so they would use the experimental Vite integration path (`@vercel/microfrontends/experimental/vite`).

## Detailed Findings

### Current Monorepo Architecture

**Structure** ([`package.json:1-44`](https://github.com/jeevanpillay/polychromos/blob/3ed272a445bd4c5248ac4e62aaaa3e208602d713/package.json#L1-L44)):
```
polychromos/
├── apps/
│   ├── polychromos-app/   # Design tool (port 3001) - TanStack Start + Convex + Clerk
│   └── polychromos-www/   # Marketing site (port 3002) - TanStack Start
├── packages/
│   ├── polychromos/       # CLI tool (npm published)
│   ├── polychromos-types/ # Shared types (npm published)
│   └── ui/                # Shared component library (@repo/ui)
└── internal/              # Shared configs (eslint, prettier, typescript)
```

**Current Deployment Configuration**:
- Both apps configured as separate Vercel projects via `.vercel/repo.json`
- `polychromos-app`: Project ID `prj_xQWQZf6I9W225egoEtis5Y2x6Xnt`, directory `apps/polychromos-app`
- `polychromos-www`: Project ID `prj_VNFQhXVvFuRS7gryqN3No2oVtgz9`, directory `apps/polychromos-www`
- Both use Node.js 24.x runtime with `tanstack-start` framework detection
- Both use Nitro for SSR output to `.output/` directory

### Vercel Microfrontends Platform (GA October 2025)

**Core Value Proposition**:
- Split large applications into smaller, independently deployable units
- Vercel handles routing and composition at the edge
- Maintains monorepo structure while enabling independent deployments
- Supports multiple frameworks: Next.js, SvelteKit, React Router, Vite, React

**Pricing (Pro/Enterprise)**:

| Included | Additional |
|----------|------------|
| 2 projects | $250/project/month |
| Unlimited routing requests | $2 per 1M requests |

**Hobby Tier**: 2 projects max, 50K routing requests/month

### Setup Steps for Polychromos

#### 1. Create Microfrontends Group in Vercel Dashboard

Navigate to **Vercel Dashboard → Settings → Microfrontends → Create Group**

Add both existing projects:
- `polychromos-www` (shell/default application)
- `polychromos-app` (routed application)

#### 2. Install Package in Both Apps

```bash
pnpm --filter @repo/www add @vercel/microfrontends
pnpm --filter @repo/app add @vercel/microfrontends
```

#### 3. Add Configuration File to Shell App

Create `apps/polychromos-www/microfrontends.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/microfrontends.json",
  "applications": {
    "polychromos-www": {
      "development": {
        "local": 3002
      }
    },
    "polychromos-app": {
      "routing": [
        {
          "paths": ["/app", "/app/:path*"]
        }
      ],
      "development": {
        "local": 3001
      }
    }
  }
}
```

#### 4. Configure Vite for Microfrontends

**For `apps/polychromos-www/vite.config.ts`**:

```typescript
import { microfrontends } from '@vercel/microfrontends/experimental/vite';

export default defineConfig({
  plugins: [
    // ... existing plugins
    microfrontends(),
  ],
});
```

**For `apps/polychromos-app/vite.config.ts`**:

```typescript
import { microfrontends } from '@vercel/microfrontends/experimental/vite';

export default defineConfig({
  plugins: [
    // ... existing plugins
    microfrontends(),
  ],
});
```

#### 5. Update Turborepo for Local Development Proxy

Add to root `turbo.json`:

```json
{
  "tasks": {
    "dev": {
      "dependsOn": ["^dev"],
      "cache": false,
      "persistent": true
    }
  }
}
```

The microfrontends proxy automatically starts on port **3024** when running `turbo dev`.

#### 6. Update Dev Scripts for Dynamic Ports (Optional)

Use `turbo get-mfe-port` for deterministic port assignment:

```json
// apps/polychromos-www/package.json
{
  "scripts": {
    "dev": "dotenv -e .vercel/.env.development.local -- vite dev --port $(turbo get-mfe-port)"
  }
}
```

### Navigation Between Microfrontends

**Cross-zone navigation requires hard reloads** (not soft client-side navigation).

Use standard `<a>` tags for cross-app navigation:

```tsx
// In polychromos-www
<a href="/app">Open App</a>

// In polychromos-app
<a href="/">Back to Marketing</a>
```

For better UX, enable prefetching by using Vercel's enhanced Link component (Next.js) or implementing prefetch strategies.

### Shared Components Best Practice

The current `@repo/ui` package structure follows Vercel's recommended pattern:

```
packages/ui/
├── src/
│   ├── components/
│   │   └── ui/        # shadcn/ui components
│   ├── lib/           # Utilities (cn, etc.)
│   ├── hooks/         # Shared React hooks
│   └── globals.css    # Tailwind styles
└── package.json
```

Both apps import via:
```typescript
import { Button } from "@repo/ui/components/ui/button";
```

**No changes needed** - this pattern prevents duplication and ensures consistency.

### Alternative: Multi-Zones Without Microfrontends Package

For a simpler setup without `@vercel/microfrontends`, use standard **rewrites**:

**In `apps/polychromos-www/vercel.json`**:

```json
{
  "rewrites": [
    {
      "source": "/app/:path*",
      "destination": "https://polychromos-app.vercel.app/app/:path*"
    }
  ]
}
```

**Tradeoffs**:
- Simpler configuration
- No local development proxy
- No enhanced routing features (prefetching, observability)
- Requires hardcoded production URLs

## Code References

### Current Vite Configurations

- `apps/polychromos-app/vite.config.ts:1-28` - App Vite config with port 3001
- `apps/polychromos-www/vite.config.ts:1-44` - WWW Vite config with port 3002, Nitro Vercel preset

### Current Vercel Project Configs

- `apps/polychromos-app/.vercel/project.json` - Framework: tanstack-start, rootDirectory: apps/polychromos-app
- `apps/polychromos-www/.vercel/project.json` - Framework: tanstack-start, rootDirectory: apps/polychromos-www

### Turborepo Configuration

- `turbo.json:1-91` - Current task definitions, dev task already configured for persistence

### Environment Configuration

- `apps/polychromos-app/src/env.ts:1-42` - T3 env with Vercel preset, VITE_APP_URL
- `apps/polychromos-www/src/env.ts:1-35` - T3 env with Vercel preset, VITE_APP_URL

## Architecture Documentation

### Current Deployment Pattern

```
                    ┌──────────────────┐
                    │  Vercel Edge     │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼─────────┐       ┌──────────▼──────────┐
    │  polychromos-www  │       │  polychromos-app    │
    │  (Marketing)      │       │  (Design Tool)      │
    │  Port 3002        │       │  Port 3001          │
    │  Static + SSR     │       │  SSR + Convex       │
    └───────────────────┘       └─────────────────────┘
```

### With Microfrontends

```
                    ┌──────────────────┐
                    │  Vercel Edge     │
                    │  Microfrontends  │
                    │  Router          │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │ /              │ /app/*         │
    ┌───────▼───────┐       ┌▼────────────────┐
    │  www (shell)  │       │  app (routed)   │
    └───────────────┘       └─────────────────┘
```

**Routing Rules**:
- `/` → `polychromos-www`
- `/docs/*` → `polychromos-www`
- `/app/*` → `polychromos-app`

## Historical Context (from thoughts/)

### Existing Research Documents

- `thoughts/shared/research/2026-02-03-vercel-json-convex-deployment-configuration.md` - Documents current Vercel project structure and `.vercel/repo.json` configuration
- `thoughts/shared/research/2026-01-31-vercel-tanstack-setup-analytics.md` - Vercel TanStack Start setup documentation
- `thoughts/shared/research/2026-02-02-polychromos-production-readiness-assessment.md` - Production readiness mentioning multi-app architecture

### Related Implementation Plans

- `thoughts/shared/plans/2026-02-03-vercel-json-convex-deployment.md` - Plan to add vercel.json for Convex auto-deployment
- `thoughts/shared/plans/2026-02-02-dynamic-robots-txt-both-apps.md` - Dynamic robots.txt for both apps

## Related Resources

### Official Documentation
- [Vercel Microfrontends Main Docs](https://vercel.com/docs/microfrontends)
- [Microfrontends Configuration Reference](https://vercel.com/docs/microfrontends/configuration)
- [Microfrontends Quickstart Guide](https://vercel.com/docs/microfrontends/quickstart)
- [Turborepo Microfrontends Guide](https://turborepo.dev/docs/guides/microfrontends)
- [Deploying Turborepo to Vercel](https://vercel.com/docs/monorepos/turborepo)

### Templates & Examples
- [Next.js Multi-Zones Starter](https://vercel.com/templates/next.js/microfrontends-multi-zones)
- [GitHub: Official Multi-Zone Example](https://github.com/vercel-labs/microfrontends-nextjs-app-multi-zone)
- [Turborepo Design System Template](https://vercel.com/templates/react/turborepo-design-system)

### Blog Posts
- [How Vercel Adopted Microfrontends](https://vercel.com/blog/how-vercel-adopted-microfrontends)
- [Microfrontends Now Generally Available](https://vercel.com/changelog/microfrontends-now-generally-available)

### NPM Package
- [@vercel/microfrontends on NPM](https://www.npmjs.com/package/@vercel/microfrontends)

## Open Questions

1. **TanStack Start Support**: The `@vercel/microfrontends/experimental/vite` path is marked experimental. Testing needed to verify compatibility with TanStack Start's SSR model.

2. **Convex Integration**: How does the microfrontends proxy interact with Convex's real-time WebSocket connections? May need to ensure proxy doesn't intercept `/api/convex/*` routes.

3. **Clerk Session Sharing**: Both apps use Clerk. Will sessions persist across microfrontend boundaries, or does each hard navigation require re-authentication?

4. **Asset Prefixes**: May need `assetPrefix` configuration in app to avoid asset path collisions when both apps serve from the same domain.

5. **Local Development**: The microfrontends proxy (port 3024) would be the main entry point. How does this interact with Convex local backend setup (`scripts/local-backend.sh`)?

6. **Pricing Impact**: Currently both apps deploy separately (2 projects). With microfrontends, they remain 2 projects, fitting within included limits. Verify no hidden costs.
