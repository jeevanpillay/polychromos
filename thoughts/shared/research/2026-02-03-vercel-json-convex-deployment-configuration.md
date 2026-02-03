---
date: 2026-02-03T12:00:00+08:00
researcher: Claude
git_commit: 86578c39160e66dc6f72136716fa85a5cea8e7b1
branch: main
repository: polychromos
topic: "Vercel.json Override for Convex Deployment in polychromos-app"
tags: [research, codebase, vercel, convex, deployment, tanstack-start]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Vercel.json Override for Convex Deployment in polychromos-app

**Date**: 2026-02-03T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 86578c39160e66dc6f72136716fa85a5cea8e7b1
**Branch**: main
**Repository**: polychromos

## Research Question
What is the current Vercel configuration for polychromos-app and what vercel.json override is needed for proper Convex deployment according to https://docs.convex.dev/production/hosting/vercel?

## Summary

The polychromos-app currently has **no vercel.json file**. All Vercel configuration exists through:
1. `.vercel/project.json` - Framework detection and project settings
2. `.vercel/repo.json` - Multi-project monorepo configuration
3. Vite/Nitro configuration - Build output settings

According to Convex documentation, a `vercel.json` override is needed to wrap the build command with `npx convex deploy` to properly deploy Convex functions alongside the frontend.

## Detailed Findings

### Current Vercel Configuration

#### Project Configuration (`apps/polychromos-app/.vercel/project.json`)

```json
{
  "projectId": "prj_xQWQZf6I9W225egoEtis5Y2x6Xnt",
  "orgId": "team_VTJ8c2IpNa2pbQx9hiA2ZyP5",
  "framework": "tanstack-start",
  "devCommand": null,
  "installCommand": null,
  "buildCommand": null,
  "outputDirectory": null,
  "nodeVersion": "24.x",
  "rootDirectory": "apps/polychromos-app"
}
```

**Key observations:**
- Framework is set to `tanstack-start`
- All build commands are `null` (uses framework defaults)
- Node version is 24.x
- Root directory correctly points to `apps/polychromos-app`

#### Monorepo Configuration (`.vercel/repo.json`)

```json
{
  "orgId": "team_VTJ8c2IpNa2pbQx9hiA2ZyP5",
  "remoteName": "origin",
  "projects": {
    "polychromos-app": {
      "id": "prj_xQWQZf6I9W225egoEtis5Y2x6Xnt",
      "directory": "apps/polychromos-app"
    },
    "polychromos-www": {
      "id": "prj_VNFQhXVvFuRS7gryqN3No2oVtgz9",
      "directory": "apps/polychromos-www"
    }
  }
}
```

### Current Build Configuration

#### Package.json Build Script (`apps/polychromos-app/package.json:13`)

```json
"build": "vite build"
```

#### Vite Configuration (`apps/polychromos-app/vite.config.ts`)

```typescript
export default defineConfig({
  server: { port: 3001 },
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    nitro(),  // No explicit preset configuration
    viteReact(),
    ViteImageOptimizer({ /* ... */ }),
  ],
})
```

**Note:** Unlike `polychromos-www` which has `preset: "vercel"` in its Nitro config, `polychromos-app` relies on auto-detection.

#### Turborepo Build Outputs (`apps/polychromos-app/turbo.json:5`)

```json
"build": {
  "outputs": [".output/**", "dist/**"]
}
```

### Convex Configuration

#### Project Definition (`apps/polychromos-app/convex.json`)

```json
{
  "team": "polychromos",
  "project": "polychromos-mvp"
}
```

#### Environment Variables Used

From `apps/polychromos-app/src/env.ts`:
- **Server-side**: `CLERK_JWT_ISSUER_DOMAIN`
- **Client-side**: `VITE_APP_URL`, `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`

From local development scripts (managed by Convex):
- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

### Convex Documentation Requirements

According to https://docs.convex.dev/production/hosting/vercel:

#### Required Build Command Override

```
npx convex deploy --cmd 'npm run build'
```

The deployment process:
1. `npx convex deploy` reads `CONVEX_DEPLOY_KEY` environment variable
2. It sets `CONVEX_URL` environment variable pointing to deployment
3. Your build command reads this variable to configure the frontend client
4. Functions are pushed to the deployment

#### Required Environment Variables

**For Production:**
- Variable: `CONVEX_DEPLOY_KEY`
- Generate: Convex Dashboard → Project Settings → "Generate Production Deploy Key"
- Vercel Environment: Production only

**For Preview Deployments:**
- Variable: `CONVEX_DEPLOY_KEY`
- Generate: Convex Dashboard → "Generate Preview Deploy Key"
- Vercel Environment: Preview only

### What Exists vs What's Needed

| Component | Current State | Required for Convex |
|-----------|--------------|---------------------|
| `vercel.json` | Does not exist | Needs to be created |
| Build command | `vite build` (framework default) | `npx convex deploy --cmd 'pnpm run build'` |
| `CONVEX_DEPLOY_KEY` | Not configured | Required in Vercel env vars |
| Nitro preset | Auto-detected | Should work with vercel.json override |
| Framework | `tanstack-start` | Compatible |

### File Locations

**Existing Configuration:**
- `apps/polychromos-app/.vercel/project.json` - Project settings
- `apps/polychromos-app/convex.json` - Convex project config
- `apps/polychromos-app/vite.config.ts` - Build configuration
- `apps/polychromos-app/package.json:13` - Build script
- `apps/polychromos-app/turbo.json:5` - Build outputs

**To Be Created:**
- `apps/polychromos-app/vercel.json` - Build command override

## Code References

- `apps/polychromos-app/.vercel/project.json` - Framework and build settings
- `apps/polychromos-app/convex.json` - Convex team/project config
- `apps/polychromos-app/vite.config.ts:19` - Nitro plugin (no explicit preset)
- `apps/polychromos-app/package.json:13` - Build script definition
- `apps/polychromos-app/src/env.ts:23` - VITE_CONVEX_URL environment validation
- `apps/polychromos-app/src/router.tsx:13` - Convex URL client initialization
- `apps/polychromos-www/vite.config.ts:21-31` - Example of explicit Vercel preset in Nitro

## Architecture Documentation

### Current Deployment Flow

```
Vercel Build Trigger
    ↓
Framework Detection (tanstack-start)
    ↓
Default Build Command (vite build)
    ↓
Outputs: .output/**, dist/**
    ↓
Deploy to Vercel
```

**Problem:** Convex functions in `apps/polychromos-app/convex/` are NOT deployed because there's no `convex deploy` step.

### Required Deployment Flow

```
Vercel Build Trigger
    ↓
vercel.json Override
    ↓
npx convex deploy --cmd 'pnpm run build'
    ↓
  ├── Deploys Convex functions
  ├── Sets CONVEX_URL for build
  └── Runs vite build
    ↓
Outputs: .output/**, dist/**
    ↓
Deploy to Vercel
```

## Related Research

- `thoughts/shared/research/2026-01-31-vercel-tanstack-setup-analytics.md` - Vercel + TanStack Start configuration
- `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md` - Clerk/Convex authentication setup
- `thoughts/shared/research/2026-02-02-polychromos-production-readiness-assessment.md` - Production deployment considerations

## Open Questions

1. **pnpm vs npm**: The Convex docs use `npm run build`, but this monorepo uses pnpm. The vercel.json should use `pnpm run build` instead.

2. **Monorepo root directory**: Since polychromos-app is at `apps/polychromos-app/`, need to verify if `vercel.json` should be placed there or if install/build commands need path adjustments.

3. **Preview deploy keys**: Will preview deployments need a separate Convex deployment/project, or can they share the same backend?

4. **Clerk custom domain**: Convex docs note that Clerk requires custom domains (Vercel's default URL format isn't supported). This may need configuration if not already set up.
