---
date: 2026-01-31T00:00:00Z
researcher: Claude Code
topic: "T3 OSS Environment Variables Setup for Vite with Vercel Deployment"
tags: [research, web-analysis, t3-oss, environment-variables, vite, vercel, security]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 15
---

# Web Research: T3 OSS Environment Variables for Vite + Vercel Deployment

**Date**: 2026-01-31
**Topic**: Complete environment variable setup using @t3-oss/env library for Vite applications deployed on Vercel
**Confidence**: High - Based on official documentation, authoritative guides, and security best practices

## Research Question

How do I properly configure type-safe environment variables using @t3-oss/env for a Vite application, what environment variables are needed for Vercel hosting, and what are the security best practices for production deployments?

## Executive Summary

For your Jeevan Pillay Studio portfolio site, you need a minimal environment variable setup with just one variable: `VITE_APP_URL` for SEO. The @t3-oss/env library with Zod validation ensures type-safe configuration. Set this variable in the Vercel dashboard (Production: your domain, Preview: auto-assigned Vercel URL) and Vite will expose it to your client code.

## Key Setup Requirements

### Installation & Core Package

**Package**: `@t3-oss/env-core` (v0.13.10+)
**Dependencies**: Zod v3+ for schema validation
**Requirements**: TypeScript 5.0+, ESM-only, Node.js 18+

```bash
pnpm add @t3-oss/env-core zod
```

### Core Implementation Pattern for Your Portfolio

Create a schema that validates environment variables:

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_APP_URL: z.string().url().default("https://yourdomain.com"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

## Vercel Environment Variables Configuration

### System Variables Automatically Provided

Vercel provides system environment variables automatically when you enable "Automatically expose System Environment Variables" in the Environment Variables settings:

**Core Variables**:
- `VERCEL` - Set to `1` (indicates running on Vercel)
- `CI` - Set to `1` (indicates CI environment)
- `VERCEL_ENV` - Environment type: `production`, `preview`, or `development`
- `VERCEL_URL` - Deployment URL (e.g., `my-app-abc123.vercel.app`)
- `VERCEL_PROJECT_PRODUCTION_URL` - Production domain
- `VERCEL_REGION` - Deployment region
- `VERCEL_DEPLOYMENT_ID` - Unique deployment identifier

**Git Integration**:
- `VERCEL_GIT_PROVIDER` - Git provider (github, gitlab, bitbucket)
- `VERCEL_GIT_REPO_SLUG` - Repository identifier
- `VERCEL_GIT_COMMIT_SHA` - Git commit hash
- `VERCEL_GIT_COMMIT_REF` - Branch or tag name
- `VERCEL_GIT_COMMIT_MESSAGE` - Commit message
- `VERCEL_GIT_PULL_REQUEST_ID` - PR number

### Dashboard Configuration

1. Go to Project Settings → Environment Variables
2. Enable "Automatically expose System Environment Variables"
3. Add custom variables for each environment:
   - **Production**: Live API keys, production database URLs
   - **Preview**: Staging/testing credentials
   - **Development**: Development credentials (optional, use .env.local)

### Vite Prefix Requirement

For variables to reach client-side code, they **must** be prefixed with `VITE_` in Vite projects:
- Server variables: No prefix needed (stored in `process.env`)
- Client variables: Must start with `VITE_` (exposed via `import.meta.env`)

## Environment Variables Needed for Your Portfolio

Your app is a static portfolio site with Vercel Analytics & Speed Insights already integrated. You only need one environment variable:

### Application Configuration
```typescript
client: {
  VITE_APP_URL: z.string().url().default("https://yourdomain.com"),
}
```

This variable is used in `src/routes/__root.tsx` for SEO canonical URLs and schema generation.

## Configuration for Your Setup

Your portfolio site only needs one variable that is already public (your app URL), so security patterns for secrets don't apply. However, here's the minimal setup:

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_APP_URL: z.string().url().default("https://yourdomain.com"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

Then import it in `vite.config.ts` to validate at build time:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import './src/env'; // Validates on build

export default defineConfig({
  // ... rest of config
});
```

## Using Your Environment Variable

In your React components or page routes, you can use the validated environment variable:

```typescript
// src/routes/__root.tsx
import { env } from '~/env';

const appUrl = env.VITE_APP_URL; // TypeScript knows this is a valid URL string

export const Route = createRootRoute({
  head: () => {
    const seo = generateSEO({
      title: "Jeevan Pillay Studio",
      description: "Jeevan Pillay Studio - Personal portfolio and projects",
      canonicalUrl: appUrl, // Automatically type-safe
    });
    // ... rest of head config
  },
});
```

The variable is validated at **build time** (when you import in `vite.config.ts`) and **runtime** (when accessed), so you get full type safety and runtime protection.

## TanStack Start Integration

### Environment File Loading
TanStack Start automatically loads environment files in this order:
1. `.env.local` (Git-ignored, for local overrides)
2. `.env.production` / `.env.development` (Environment-specific)
3. `.env` (Base defaults)

For your setup, you can keep a `.env` file with:
```bash
VITE_APP_URL=https://yourdomain.com
```

And override locally with `.env.local` for testing.

## Implementation Checklist for Your Portfolio

- [ ] Install `@t3-oss/env-core` and `zod`
- [ ] Create `src/env.ts` with the minimal schema (see above)
- [ ] Import env validation in `vite.config.ts`
- [ ] Create `.env.example` with `VITE_APP_URL=https://yourdomain.com`
- [ ] Add `.env` and `.env*.local` to `.gitignore`
- [ ] Set `VITE_APP_URL` in Vercel dashboard for Production environment
- [ ] Test deployment with preview environment

## Important Implementation Notes

### Vite Prefix Requirement
All client-side variables must be prefixed with `VITE_` to be accessible in your client code. This is a Vite requirement, not a T3 Env requirement.

### Build-Time Validation
Always import your `src/env.ts` in `vite.config.ts` so validation happens at build time, catching configuration errors early.

### Empty String Handling
Using `emptyStringAsUndefined: true` ensures that empty environment variables are treated as undefined, allowing your schema defaults to work properly.

## Sources

### Official Documentation
- [T3 Env Official Documentation](https://env.t3.gg/docs/core) - T3 OSS, 2025
- [T3 Env Customization Guide](https://env.t3.gg/docs/customization) - T3 OSS, 2025
- [T3 Env GitHub Repository](https://github.com/t3-oss/t3-env) - T3 OSS, 3.8k stars

### Framework Integration
- [Vite Environment Variables Guide](https://vite.dev/guide/env-and-mode) - Vite, 2025
- [TanStack Start Environment Variables](https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables) - TanStack, 2025

### Vercel Integration
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables) - Vercel, 2025
- [Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables) - Vercel, 2025
- [Vercel Speed Insights Package](https://vercel.com/docs/speed-insights/package) - Vercel, 2025

### Security Best Practices
- [OpenAI API Key Best Practices](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) - OpenAI, 2025
- [Netlify Guide to Storing API Keys](https://www.netlify.com/blog/a-guide-to-storing-api-keys-securely-with-environment-variables/) - Netlify, 2024

### NPM Registry
- [@t3-oss/env-core on NPM](https://www.npmjs.com/package/@t3-oss/env-core) - NPM, v0.13.10+

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Based on official documentation and authoritative sources
**Next Steps**:
1. Install @t3-oss/env-core and zod
2. Create src/env.ts with the minimal schema
3. Import in vite.config.ts for build-time validation
4. Create .env.example and .env files
5. Set VITE_APP_URL in Vercel dashboard (Production and Preview environments)
6. Deploy and verify SEO canonical URLs work correctly
