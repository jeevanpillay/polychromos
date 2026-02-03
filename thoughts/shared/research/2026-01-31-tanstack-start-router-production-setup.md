---
date: 2026-01-31T12:00:00+08:00
researcher: Claude
git_commit: 061e8899fc89bc151ff3f3c3daa07e7da575619d
branch: main
repository: x
topic: "TanStack Start + Router Production-Ready Setup"
tags: [research, tanstack-start, tanstack-router, error-handling, 404, ssr, seo, production]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
last_updated_note: "Added production SEO implementation from apps/www codebase"
---

# Research: TanStack Start + Router Production-Ready Setup

**Date**: 2026-01-31T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 061e8899fc89bc151ff3f3c3daa07e7da575619d
**Branch**: main
**Repository**: x

## Research Question

End-to-end production-ready TanStack Start + Router setup from official docs, including error handling, 404s, SSR configuration, data loading patterns, and SEO/meta tag management.

## Summary

TanStack Start is a full-stack React framework built on TanStack Router and Vite, providing SSR by default with streaming support. For production-ready apps, you need to configure:

1. **Core Files**: `vite.config.ts`, `router.tsx`, `__root.tsx`, optional `client.tsx` and `server.ts`
2. **Error Handling**: Hierarchical `errorComponent` system that bubbles errors up the route tree
3. **404 Handling**: `notFoundComponent` with `notFoundMode` (fuzzy vs root) and `notFound()` function
4. **Data Loading**: `beforeLoad` (sequential) + `loader` (parallel) with built-in SWR caching
5. **SEO**: `head` property on routes with `<HeadContent />` component

---

## Detailed Findings

### 1. Core Configuration Files

#### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      srcDirectory: 'src',
      router: {
        routesDirectory: 'routes',
      },
    }),
    // IMPORTANT: React plugin must come AFTER tanstackStart()
    viteReact(),
  ],
})
```

#### router.tsx

```typescript
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,

    // Scroll & Navigation
    scrollRestoration: true,

    // Preloading (Performance)
    defaultPreload: 'intent',        // Preload on hover
    defaultPreloadDelay: 50,         // 50ms delay
    defaultPreloadStaleTime: 30000,  // 30 seconds

    // Caching
    defaultStaleTime: 0,             // Always reload unless cached externally
    defaultGcTime: 1800000,          // 30 minutes garbage collection

    // Loading States
    defaultPendingMs: 1000,          // Show pending after 1 second
    defaultPendingMinMs: 500,        // Keep pending visible for 500ms minimum

    // Error/NotFound Components (global defaults)
    defaultErrorComponent: ({ error }) => <div>Error: {error.message}</div>,
    defaultNotFoundComponent: () => <div>404 Not Found</div>,

    // Not Found Behavior
    notFoundMode: 'fuzzy',  // or 'root'
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

#### __root.tsx (Root Route)

```tsx
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  component: RootComponent,
  errorComponent: GlobalErrorComponent,
  notFoundComponent: GlobalNotFoundComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

#### client.tsx (Optional)

```tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
)
```

#### server.ts (Optional)

```typescript
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request)
  },
})
```

---

### 2. Error Handling

#### Error Propagation Hierarchy

```
route.errorComponent → parentRoute.errorComponent → router.defaultErrorComponent
```

Errors bubble up the route tree until caught.

#### Route-Level Error Component

```tsx
import { createFileRoute, ErrorComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params }) => fetchPost(params.postId),
  errorComponent: ({ error, reset }) => {
    const router = useRouter()
    return (
      <div>
        <h2>Error loading post</h2>
        <p>{error.message}</p>
        <button onClick={() => router.invalidate()}>
          Retry
        </button>
      </div>
    )
  },
})
```

#### Key Error Handling Callbacks

| Callback | When Called | Use Case |
|----------|-------------|----------|
| `onError` | Loader/beforeLoad errors | Logging, analytics |
| `onCatch` | Render errors (CatchBoundary) | Error tracking |
| `errorComponent` | Display errors | User-facing error UI |

#### Reset vs Invalidate

- **`reset()`**: Resets error boundary state only (use for render errors)
- **`router.invalidate()`**: Reloads loaders AND resets boundaries (use for loader errors)

---

### 3. 404 / Not Found Handling

#### Basic Not Found Setup

```tsx
// Root route with global 404
export const Route = createRootRoute({
  notFoundComponent: () => (
    <div>
      <h1>404 - Page Not Found</h1>
      <Link to="/">Go Home</Link>
    </div>
  ),
})
```

#### Throwing Not Found from Loaders

```tsx
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    if (!post) {
      throw notFound()
    }
    return post
  },
  notFoundComponent: () => <div>Post not found!</div>,
})
```

#### notFoundMode Options

| Mode | Behavior |
|------|----------|
| `fuzzy` (default) | Uses nearest parent with `notFoundComponent`, preserves layout |
| `root` | All 404s handled by root route's `notFoundComponent` |

#### Important Caveats

- `notFound()` in `beforeLoad` always triggers root `notFoundComponent`
- Known SSR issues with HTTP 404 status codes (may not always be set correctly)

---

### 4. Data Loading Patterns

#### beforeLoad vs loader

| Feature | beforeLoad | loader |
|---------|------------|--------|
| Execution | Sequential (parent → child) | Parallel (all at once) |
| Returns | Merges into route context | Route-specific data only |
| Blocks | All subsequent loaders | Nothing |
| Use Case | Auth checks, redirects | Data fetching |

#### Authentication Pattern

```tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  loader: () => fetchDashboardData(),
})
```

#### Built-in Caching (SWR-like)

```typescript
const router = createRouter({
  routeTree,
  defaultStaleTime: 10000,       // 10 seconds fresh
  defaultGcTime: 60000,          // 1 minute cache
  defaultPreloadStaleTime: 5000, // 5 seconds for preloads
})
```

#### TanStack Query Integration (Recommended)

```tsx
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'

const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetch('/api/posts').then(r => r.json()),
})

export const Route = createFileRoute('/posts')({
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: PostsPage,
})

function PostsPage() {
  const { data } = useSuspenseQuery(postsQuery)
  return <div>{data.map(p => p.title).join(', ')}</div>
}
```

#### Server Functions

```typescript
import { createServerFn } from '@tanstack/react-start'

export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

export const saveData = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    return { success: true, name: data.name }
  })
```

---

### 5. Loading States (pendingComponent)

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  pendingComponent: () => <div>Loading posts...</div>,
  pendingMs: 1000,      // Show after 1 second
  pendingMinMs: 500,    // Keep visible for 500ms minimum
})
```

---

### 6. SEO & Meta Tags

#### Per-Route Meta Tags

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => fetchPost(params.postId),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.post.title },
      { name: 'description', content: loaderData.post.excerpt },

      // Open Graph
      { property: 'og:title', content: loaderData.post.title },
      { property: 'og:description', content: loaderData.post.excerpt },
      { property: 'og:image', content: loaderData.post.coverImage },
      { property: 'og:type', content: 'article' },

      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: loaderData.post.title },
    ],
    links: [
      { rel: 'canonical', href: `https://example.com/posts/${loaderData.post.id}` },
    ],
  }),
})
```

#### Structured Data (JSON-LD)

```tsx
head: ({ loaderData }) => ({
  scripts: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: loaderData.article.title,
        author: { '@type': 'Person', name: loaderData.article.author },
      })
    }
  ]
})
```

---

### 7. SSR Configuration

TanStack Start provides **full-document SSR by default**:

- `beforeLoad` and `loader` execute on server
- Route components render on server
- HTML streams to client for hydration

#### Selective SSR

```tsx
export const Route = createFileRoute('/dashboard')({
  ssr: false, // Client-only rendering for this route
})

// Or globally
const router = createRouter({
  routeTree,
  defaultSsr: false,
})
```

---

### 8. Production Deployment

#### Build Command

```bash
vite build
```

#### Preloading Strategy

Set `defaultPreload: 'intent'` for production - preloads on hover with 50ms delay.

#### Hosting Partners

- **Cloudflare Workers**: Use `wrangler.jsonc` with `"main": "@tanstack/react-start/server-entry"`
- **Netlify**: Install `@netlify/vite-plugin-tanstack-start`
- **Vercel**: Standard Vite deployment

---

### 9. SEO Implementation (Production Pattern from apps/www)

#### SEO Helper Functions

Centralize SEO meta tag generation in a utility file:

```typescript
// src/lib/seo.ts
import type { Organization, Person, WebSite, WithContext } from "schema-dts";

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
    ogImage = "https://yourdomain.com/og-image.png",
    ogType = "website",
    robots = "index, follow",
    twitterHandle = "@yourhandle",
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
      { property: "og:site_name", content: "Your Site Name" },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      { name: "twitter:creator", content: twitterHandle },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  };
}

export function getWebsiteSchema(siteUrl: string): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Your Site Name",
    url: siteUrl,
    description: "Your site description",
  };
}

export function getOrganizationSchema(
  siteUrl: string,
): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Your Organization",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    sameAs: [
      "https://twitter.com/yourhandle",
      "https://github.com/yourhandle",
    ],
  };
}
```

#### JSON-LD Component

Create a reusable component for structured data with proper escaping:

```tsx
// src/components/json-ld.tsx
import type { Thing, WithContext } from "schema-dts";

interface GraphContext {
  "@context": string | Record<string, unknown> | (string | Record<string, unknown>)[];
  "@graph": Thing[];
}

type JsonLdData = WithContext<Thing> | GraphContext;

interface JsonLdProps {
  code: JsonLdData;
}

const escapeJsonForHtml = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const JsonLd = ({ code }: JsonLdProps) => (
  <script
    dangerouslySetInnerHTML={{
      __html: escapeJsonForHtml(JSON.stringify(code)),
    }}
    type="application/ld+json"
  />
);
```

#### Root Route with SEO

Configure the root route with global SEO:

```tsx
// src/routes/__root.tsx
import {
  createRootRoute,
  ErrorComponent,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { JsonLd } from "~/components/json-ld";
import {
  generateSEO,
  getOrganizationSchema,
  getWebsiteSchema,
} from "~/lib/seo";

const appUrl = import.meta.env.VITE_APP_URL ?? "https://yourdomain.com";

export const Route = createRootRoute({
  head: () => {
    const seo = generateSEO({
      title: "Your Site",
      description: "Your site description",
      canonicalUrl: appUrl,
    });
    return seo;
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <JsonLd code={getWebsiteSchema(appUrl)} />
        <JsonLd code={getOrganizationSchema(appUrl)} />
      </head>
      <body>
        <div>{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
```

#### Per-Route Meta Tags

Override SEO on specific routes using their own `head` property:

```tsx
export const Route = createFileRoute('/about')({
  head: () => {
    const seo = generateSEO({
      title: "About Us - Your Site",
      description: "Learn more about our company and team",
      canonicalUrl: `${import.meta.env.VITE_APP_URL}/about`,
    });
    return seo;
  },
  component: AboutPage,
})
```

#### Dynamic Meta from Loaders

For data-driven pages, use `loaderData` in the `head` callback:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    const seo = generateSEO({
      title: loaderData.title,
      description: loaderData.excerpt,
      canonicalUrl: `https://yourdomain.com/posts/${loaderData.id}`,
      ogImage: loaderData.coverImage,
      ogType: "article",
    });
    return seo;
  },
  component: PostDetail,
})
```

---

## Code References

Key files in a TanStack Start app:

- `vite.config.ts` - Build configuration
- `src/router.tsx` - Router configuration
- `src/routes/__root.tsx` - Root route (HTML shell, global error/404, SEO)
- `src/routes/*.tsx` - File-based routes
- `src/routeTree.gen.ts` - Auto-generated route tree (don't edit)
- `src/client.tsx` - Optional client entry
- `src/server.ts` - Optional server entry
- `src/lib/seo.ts` - SEO helper functions (production pattern from apps/www)
- `src/components/json-ld.tsx` - JSON-LD structured data component

---

## Production Checklist

- [ ] Configure `defaultPreload: 'intent'` for performance
- [ ] Set up global `errorComponent` on root route
- [ ] Set up global `notFoundComponent` on root route
- [ ] Configure `scrollRestoration: true`
- [ ] Create SEO helper functions (`generateSEO()`, schema generators)
- [ ] Create `<JsonLd />` component for structured data
- [ ] Add `head` property to root route with global SEO
- [ ] Add `head` property to key routes (homepage, about, etc.)
- [ ] Add `<HeadContent />` in head and `<Scripts />` in body
- [ ] Configure per-route `head` with `loaderData` for dynamic pages
- [ ] Consider TanStack Query integration for advanced caching
- [ ] Set appropriate `staleTime` and `gcTime` values
- [ ] Configure SSR/client-only rendering per route as needed

---

## Known Issues & Limitations

1. **SSR 404 Status Codes**: HTTP 404 status may not always be set correctly during SSR
2. **beforeLoad notFound**: `notFound()` in `beforeLoad` always triggers root `notFoundComponent`
3. **Initial Render**: `notFound()` behavior differs between initial load and navigation

---

## Sources

### Official Documentation
- [TanStack Start Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Build from Scratch](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch)
- [Server Entry Point](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point)
- [Client Entry Point](https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point)
- [Routing Guide](https://tanstack.com/start/latest/docs/framework/react/guide/routing)
- [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [SEO Guide](https://tanstack.com/start/latest/docs/framework/react/guide/seo)
- [Selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr)
- [Hosting Guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)

### TanStack Router Documentation
- [Data Loading](https://tanstack.com/router/v1/docs/framework/react/guide/data-loading)
- [Not Found Errors](https://tanstack.com/router/latest/docs/framework/react/guide/not-found-errors)
- [Document Head Management](https://tanstack.com/router/v1/docs/framework/react/guide/document-head-management)
- [Preloading](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)
- [Authenticated Routes](https://tanstack.com/router/v1/docs/framework/react/guide/authenticated-routes)
- [RouterOptions API](https://tanstack.com/router/v1/docs/framework/react/api/router/RouterOptionsType)
- [ErrorComponent API](https://tanstack.com/router/latest/docs/framework/react/api/router/errorComponentComponent)
- [notFound Function](https://tanstack.com/router/v1/docs/framework/react/api/router/notFoundFunction)

### Community Resources
- [Frontend Masters - TanStack Router Data Loading](https://frontendmasters.com/blog/tanstack-router-data-loading-1/)
- [Using Server Functions and TanStack Query](https://www.brenelz.com/posts/using-server-functions-and-tanstack-query/)
- [Cloudflare Workers Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Netlify Deployment Guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/)
