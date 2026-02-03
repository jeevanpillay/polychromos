---
date: 2026-02-02T09:26:29+08:00
researcher: Claude
git_commit: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
branch: main
repository: jeevanpillaystudio/x
topic: "Polychromos TanStack Start Setup - App Structure and Convex Integration"
tags: [research, tanstack-start, convex, polychromos, setup, fonts, geist]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Polychromos TanStack Start Setup

**Date**: 2026-02-02T09:26:29+08:00
**Researcher**: Claude
**Git Commit**: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
**Branch**: main
**Repository**: jeevanpillaystudio/x

## Research Question

Document the setup requirements for a new TanStack Start application in `apps/polychromos` with Convex integration, using `apps/www` as a reference. Scope: single-user, no authentication initially, using Geist font only.

## Summary

This document provides a comprehensive blueprint for setting up `apps/polychromos` based on the existing `apps/www` TanStack Start application. Key findings:

1. **TanStack Start Architecture**: The app uses file-based routing with `@tanstack/react-start`, Vite 7, and Nitro for SSR
2. **Convex Integration**: Requires `convex`, `@convex-dev/react-query`, and `@tanstack/react-router-with-query` packages
3. **Font Strategy**: Use `@fontsource/geist-sans` and `@fontsource/geist-mono` for Geist font loading
4. **Environment Setup**: Uses `@t3-oss/env-core` with Zod validation and `VITE_` prefix for client variables
5. **Routing**: File-based routing in `src/routes/` with auto-generated `routeTree.gen.ts`

---

## Detailed Findings

### 1. Core Application Structure

#### Required Files from apps/www

```
apps/polychromos/
├── app.config.ts              # TanStack Start config (if needed)
├── vite.config.ts             # Vite configuration with plugins
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
├── .env                       # Development environment
├── .env.production            # Production environment
├── .env.example               # Environment template
├── convex/                    # Convex backend (NEW)
│   ├── _generated/            # Auto-generated types
│   ├── schema.ts              # Database schema
│   └── [functions].ts         # Query/mutation functions
├── convex.json                # Convex configuration (NEW)
└── src/
    ├── env.ts                 # Environment validation
    ├── router.tsx             # Router configuration
    ├── routeTree.gen.ts       # Auto-generated (don't edit)
    ├── vite-env.d.ts          # Vite type declarations
    ├── routes/
    │   ├── __root.tsx         # Root layout
    │   ├── index.tsx          # Home page (/)
    │   └── $.tsx              # Catch-all 404 route
    ├── components/
    │   ├── not-found-component.tsx
    │   ├── error-component.tsx
    │   └── loading-component.tsx
    ├── lib/
    │   ├── seo.ts             # SEO utilities
    │   └── sitemap.ts         # Sitemap generation
    ├── config/
    │   └── site.ts            # Site metadata
    └── styles/
        └── app.css            # Main stylesheet
```

---

### 2. Vite Configuration

**Reference**: `apps/www/vite.config.ts:1-28`

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
    port: 3001,  // Different port from www (3000)
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
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

**Key Points**:
- `tanstackStart()` handles SSR and file-based routing
- `nitro()` provides the server framework
- `viteTsConfigPaths()` enables `~/*` path aliases
- `tailwindcss()` is Tailwind v4's Vite plugin

---

### 3. TypeScript Configuration

**Reference**: `apps/www/tsconfig.json:1-18`

```json
{
  "extends": "@polychromos/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    },
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vite/client"],
    "checkJs": false
  },
  "include": ["src", "vite.config.ts"],
  "exclude": ["node_modules", "dist", ".output"]
}
```

**Path Alias**: `~/*` maps to `./src/*` for clean imports like `import { env } from "~/env"`.

---

### 4. Package Dependencies

**Reference**: `apps/www/package.json:15-59`

#### Core Dependencies (Required)
```json
{
  "dependencies": {
    "@tanstack/react-router": "catalog:",
    "@tanstack/react-start": "catalog:",
    "@polychromos/ui": "workspace:*",
    "@t3-oss/env-core": "^0.13.10",
    "nitro": "catalog:",
    "react": "catalog:react19",
    "react-dom": "catalog:react19",
    "zod": "^4.3.6"
  }
}
```

#### Convex Dependencies (NEW for Polychromos)
```json
{
  "dependencies": {
    "convex": "latest",
    "@convex-dev/react-query": "latest",
    "@tanstack/react-router-with-query": "latest",
    "@tanstack/react-query": "latest"
  }
}
```

#### Geist Font Dependencies
```json
{
  "dependencies": {
    "@fontsource/geist-mono": "^5.1.1",
    "@fontsource/geist-sans": "^5.1.1"
  }
}
```

#### Dev Dependencies
```json
{
  "devDependencies": {
    "@polychromos/eslint-config": "workspace:*",
    "@polychromos/prettier-config": "workspace:*",
    "@polychromos/typescript-config": "workspace:*",
    "@tailwindcss/vite": "catalog:",
    "@tanstack/router-devtools": "catalog:",
    "@tanstack/router-plugin": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "dotenv-cli": "^11.0.0",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plugin-image-optimizer": "^2.1.0",
    "vite-tsconfig-paths": "^5.1.4"
  }
}
```

#### Scripts
```json
{
  "scripts": {
    "build": "vite build",
    "clean": "rm -rf .cache .output dist node_modules",
    "dev": "dotenv -e .env -- vite",
    "format": "prettier --check .",
    "lint": "eslint .",
    "start": "node .output/server/index.mjs",
    "typecheck": "tsc --noEmit"
  }
}
```

---

### 5. Environment Configuration

#### Environment Files

**.env** (Development):
```bash
VITE_APP_URL=http://localhost:3001
VITE_CONVEX_URL=https://your-dev-deployment.convex.cloud
```

**.env.production**:
```bash
VITE_APP_URL=https://polychromos.yourdomain.com
VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

**.env.example**:
```bash
VITE_APP_URL=https://yourdomain.com
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

#### Environment Validation

**Reference**: `apps/www/src/env.ts:1-36`

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const appUrl =
  process.env.VITE_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3001";

export const env = createEnv({
  clientPrefix: "VITE_",
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    // Server-only variables (e.g., API keys)
  },
  client: {
    VITE_APP_URL: z.string().url(),
    VITE_CONVEX_URL: z.string().url(),
  },
  runtimeEnv: {
    ...process.env,
    VITE_APP_URL: appUrl,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "build",
  emptyStringAsUndefined: true,
});
```

---

### 6. Router Configuration

**Reference**: `apps/www/src/router.tsx:1-36`

```typescript
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30000,
    defaultStaleTime: 0,
    defaultGcTime: 1800000,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 500,
    notFoundMode: "fuzzy",
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

**For Convex Integration**, the router setup needs additional configuration:

```typescript
import { ConvexProvider } from 'convex/react';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create Convex client
const convexQueryClient = new ConvexQueryClient(
  import.meta.env.VITE_CONVEX_URL
);

// Create Query client with Convex configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});

convexQueryClient.connect(queryClient);

export function getRouter() {
  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      convexQueryClient,
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30000,
    defaultStaleTime: 0,
    defaultGcTime: 1800000,
    defaultPendingMs: 1000,
    defaultPendingMinMs: 500,
    notFoundMode: "fuzzy",
  });

  return router;
}
```

---

### 7. Root Layout with Convex Provider

**Reference**: `apps/www/src/routes/__root.tsx:39-82`

```typescript
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { ConvexProvider } from 'convex/react';
import "@fontsource/geist-mono";
import "@fontsource/geist-sans";
import "../styles/app.css";

import { generateSEO } from "~/lib/seo";
import { env } from "~/env";
import { CustomErrorComponent } from "~/components/error-component";
import { CustomNotFoundComponent } from "~/components/not-found-component";
import { LoadingComponent } from "~/components/loading-component";

export const Route = createRootRoute({
  head: () => {
    const seo = generateSEO({
      title: "Polychromos",
      description: "Code-driven design platform",
      canonicalUrl: env.VITE_APP_URL,
    });
    return seo;
  },
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

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <div className="flex min-h-screen flex-col">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
```

**Note**: The ConvexProvider should wrap the router in `router.tsx` or a client entry point, not in the root layout directly for SSR compatibility.

---

### 8. 404 Not Found Component

**Reference**: `apps/www/src/components/not-found-component.tsx:1-48`

```typescript
import { Link } from "@tanstack/react-router";
import { Button } from "@polychromos/ui/components/ui/button";

export function CustomNotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <Link to="/" className="text-lg font-bold">
          Polychromos
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center">
        <h1 className="text-[20vw] font-bold leading-none text-primary lg:text-[15vw]">
          404
        </h1>
        <Link to="/">
          <Button variant="default" size="lg" className="mt-8">
            Go Home
          </Button>
        </Link>
      </main>
    </div>
  );
}
```

---

### 9. Catch-All 404 Route

**Reference**: `apps/www/src/routes/$.tsx:1-7`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { CustomNotFoundComponent } from "~/components/not-found-component";

export const Route = createFileRoute("/$")({
  component: CustomNotFoundComponent,
});
```

The `$.tsx` filename creates a catch-all route that matches any unmatched path.

---

### 10. Error Component

**Reference**: `apps/www/src/components/error-component.tsx:1-44`

```typescript
import { ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { Button } from "@polychromos/ui/components/ui/button";
import { env } from "~/env";

export function CustomErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <h1 className="text-2xl font-bold text-destructive">Error</h1>
      <p className="mt-2 text-muted-foreground">Something went wrong</p>

      {env.NODE_ENV === "development" && (
        <pre className="mt-4 max-w-lg overflow-auto rounded bg-muted p-4 text-sm">
          {error.message}
        </pre>
      )}

      <div className="mt-6 flex gap-4">
        <Button onClick={() => router.invalidate()}>Try Again</Button>
        <Button variant="outline" onClick={() => router.navigate({ to: "/" })}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
```

---

### 11. Loading Component

**Reference**: `apps/www/src/components/loading-component.tsx:1-35`

```typescript
export function LoadingComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-3 w-3 rounded-full bg-primary"
            style={{
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
```

---

### 12. SEO Utilities

**Reference**: `apps/www/src/lib/seo.ts:1-126`

```typescript
import { env } from "~/env";

export interface SEOConfig {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
  twitterHandle?: string;
}

export function generateSEO(config: SEOConfig) {
  const {
    title,
    description,
    canonicalUrl,
    ogImage = `${env.VITE_APP_URL}/og-image.png`,
    ogType = "website",
    robots = "index, follow",
    twitterHandle = "@polychromos",
  } = config;

  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      // Open Graph
      { property: "og:type", content: ogType },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "Polychromos" },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      { name: "twitter:creator", content: twitterHandle },
      // Theme
      { name: "theme-color", content: "#000000" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  };
}
```

---

### 13. Geist Font Integration (Simplified)

For Polychromos using Geist only, the font setup is simpler:

**Root Layout Import** (`__root.tsx`):
```typescript
import "@fontsource/geist-mono";
import "@fontsource/geist-sans";
```

**Tailwind Theme** (`globals.css`):
```css
@theme inline {
  --font-sans: 'Geist Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
```

**Body Application** (`__root.tsx`):
```tsx
<body className="bg-background min-h-screen font-sans antialiased">
```

**Note**: Unlike `apps/www`, Polychromos does NOT need:
- Joyride font family
- PP Neue Montreal font family
- Custom `fonts.css` file
- Font preloading in SEO utilities

---

### 14. Convex Backend Setup

#### Initialize Convex
```bash
cd apps/polychromos
npx convex dev
```

This creates:
- `convex/` directory
- `convex.json` configuration
- `.env.local` with `CONVEX_DEPLOYMENT`

#### Convex Configuration (`convex.json`)
```json
{
  "$schema": "./node_modules/convex/schemas/convex.schema.json",
  "functions": "convex/",
  "node": {
    "nodeVersion": "20"
  }
}
```

#### Example Schema (`convex/schema.ts`)
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  designs: defineTable({
    name: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  }),
});
```

#### Example Query (`convex/designs.ts`)
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { id: v.id("designs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("designs").collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("designs"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      data: args.data,
      updatedAt: Date.now(),
    });
  },
});
```

#### Usage in Components
```typescript
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from '../convex/_generated/api';

export function DesignList() {
  const { data: designs } = useSuspenseQuery(
    convexQuery(api.designs.list, {})
  );

  return (
    <ul>
      {designs.map((design) => (
        <li key={design._id}>{design.name}</li>
      ))}
    </ul>
  );
}
```

---

### 15. Styles Configuration

#### Main Stylesheet (`src/styles/app.css`)
```css
@import "tailwindcss";
@import "@polychromos/ui/globals.css";

/* Polychromos-specific overrides if needed */
```

The `@polychromos/ui/globals.css` provides:
- Tailwind v4 configuration
- Design tokens (colors, radii, fonts)
- Dark mode support
- Base styles

---

### 16. Public Assets

Required files in `apps/polychromos/public/`:
```
public/
├── favicon.svg
├── apple-touch-icon.png
├── og-image.png
└── robots.txt
```

**robots.txt**:
```
User-agent: *
Allow: /

Sitemap: https://polychromos.yourdomain.com/sitemap.xml
```

---

## Code References

### TanStack Start Setup
- `apps/www/vite.config.ts:1-28` - Vite configuration with plugins
- `apps/www/tsconfig.json:1-18` - TypeScript configuration
- `apps/www/package.json:6-59` - Dependencies and scripts
- `apps/www/src/router.tsx:1-36` - Router configuration

### Routing and Not-Found
- `apps/www/src/routes/__root.tsx:39-82` - Root layout structure
- `apps/www/src/routes/$.tsx:1-7` - Catch-all 404 route
- `apps/www/src/components/not-found-component.tsx:1-48` - Custom 404 page
- `apps/www/src/components/error-component.tsx:1-44` - Error boundary

### Environment Configuration
- `apps/www/src/env.ts:1-36` - Environment validation with Zod
- `apps/www/.env` - Development variables
- `apps/www/.env.production` - Production variables

### SEO
- `apps/www/src/lib/seo.ts:20-88` - SEO generation utility
- `apps/www/src/routes/__root.tsx:40-47` - Root-level SEO defaults

### UI Package
- `packages/ui/package.json:6-14` - Export configuration
- `packages/ui/src/globals.css:43-108` - Theme tokens
- `packages/ui/src/lib/utils.ts:5-7` - `cn()` utility

---

## Historical Context

### Related Research
- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - CLI-to-web sync architecture using Convex

The prior research validates the Convex approach with:
- <20ms median mutation latency
- Sub-50ms sustained latency at 5k connections
- Automatic WebSocket subscriptions
- Exactly-once execution semantics

---

## Implementation Checklist

### Phase 1: Basic App Setup
- [ ] Create `apps/polychromos/` directory
- [ ] Add `package.json` with dependencies
- [ ] Add `vite.config.ts`
- [ ] Add `tsconfig.json`
- [ ] Create `src/` directory structure
- [ ] Set up `__root.tsx` with Geist fonts
- [ ] Create `index.tsx` home route
- [ ] Create `$.tsx` catch-all route
- [ ] Add error/loading/not-found components
- [ ] Configure environment validation (`env.ts`)
- [ ] Add `.env` files
- [ ] Set up `app.css` with Tailwind

### Phase 2: Convex Integration
- [ ] Install Convex dependencies
- [ ] Run `npx convex dev` to initialize
- [ ] Define schema in `convex/schema.ts`
- [ ] Create query/mutation functions
- [ ] Configure ConvexProvider in router
- [ ] Test real-time sync functionality

### Phase 3: Polish
- [ ] Add SEO utilities
- [ ] Configure favicon and OG images
- [ ] Add robots.txt
- [ ] Set up sitemap (optional)

---

## Sources

### Official Documentation
- [TanStack Start Quickstart | Convex Developer Hub](https://docs.convex.dev/quickstart/tanstack-start)
- [TanStack Start | Convex Developer Hub](https://docs.convex.dev/client/tanstack/tanstack-start/)
- [Convex with TanStack Query | Convex Developer Hub](https://docs.convex.dev/client/tanstack/tanstack-query/)
- [Schemas | Convex Developer Hub](https://docs.convex.dev/database/schemas)
- [Environment Variables | Convex Developer Hub](https://docs.convex.dev/production/environment-variables)

### Examples
- [GitHub - get-convex/convex-tanstack-start](https://github.com/get-convex/convex-tanstack-start)
- [Convex with TanStack Start Demo](https://convex-tanstack-start.vercel.app/)

### Codebase References
- Existing `apps/www/` implementation
- `@polychromos/ui` package exports and structure
