---
date: 2026-02-03T00:50:00+08:00
researcher: claude-opus-4-5
git_commit: db395fd571d8ded1fad5c0e4f1829f6f870f132a
branch: main
repository: polychromos
topic: "@takumi-rs native binding failure on Vercel serverless deployment"
tags: [research, codebase, vercel, native-bindings, og-images, takumi-rs, nitro]
status: complete
last_updated: 2026-02-03
last_updated_by: claude-opus-4-5
---

# Research: @takumi-rs Native Binding Failure on Vercel Serverless

**Date**: 2026-02-03T00:50:00+08:00
**Researcher**: claude-opus-4-5
**Git Commit**: db395fd571d8ded1fad5c0e4f1829f6f870f132a
**Branch**: main
**Repository**: polychromos

## Research Question

Why is the `og.png.tsx` route failing with "Cannot find native binding" / "Cannot find module '@takumi-rs/core-linux-x64-gnu'" on Vercel serverless despite having the optional dependency configured?

## Summary

The `og.png.tsx` route uses `@takumi-rs/image-response` (a Rust-based OG image generator) which requires platform-specific native bindings. The error occurs on Vercel's Linux x64 environment because the native binding (`@takumi-rs/core-linux-x64-gnu`) is not being properly bundled into the serverless function despite configuration attempts.

**Current State**:
- The optional dependency IS declared in `package.json`
- The nitro `traceInclude` configuration IS set to include the bindings
- The error STILL occurs, indicating the bundled function doesn't contain the native binary

**Root Cause**: The combination of pnpm's hoisting behavior, Nitro's bundling process, and Vercel's serverless function packaging is not successfully including the native Linux binary in the deployed function.

## Detailed Findings

### Current Implementation

#### OG Image Route (`apps/polychromos-www/src/routes/og[.]png.tsx:1-141`)

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og.png")({
  server: {
    handlers: {
      GET: async () => {
        // Dynamic import to keep out of client bundle
        const { ImageResponse } = await import("@takumi-rs/image-response");

        // Load custom WOFF2 fonts
        const [hwAnimoSemiExpanded, hwAnimoOutline] = await Promise.all([
          readFile(join(process.cwd(), "public/fonts/hw-animo/hw-animo-semi-expanded-regular.woff2")),
          readFile(join(process.cwd(), "public/fonts/hw-animo/hw-animo-semicondensed-regular-outline.woff2")),
        ]);

        return new ImageResponse(/* JSX */, {
          width: 1200,
          height: 630,
          fonts: [/* font configs */],
          headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
        });
      },
    },
  },
});
```

#### Package Configuration (`apps/polychromos-www/package.json:15-36`)

```json
{
  "dependencies": {
    "@takumi-rs/core": "^0.66.13",
    "@takumi-rs/helpers": "^0.66.13",
    "@takumi-rs/image-response": "^0.66.13"
  },
  "optionalDependencies": {
    "@takumi-rs/core-linux-x64-gnu": "^0.66.13"
  }
}
```

#### Vite/Nitro Configuration (`apps/polychromos-www/vite.config.ts:19-34`)

```typescript
nitro({
  config: {
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
  },
}),
```

#### pnpm Configuration (`.npmrc:1-4`)

```
auto-install-peers = true
enable-pre-post-scripts=true
node-linker=hoisted
link-workspace-packages=true
```

### Error Stack Analysis

The error originates from:
```
file:///var/task/chunks/build/node-DZ5EM3kH.mjs:551:11
```

The stack trace shows:
1. `@takumi-rs/core` attempts to require the platform-specific binding
2. It looks for `@takumi-rs/core-linux-x64-gnu` (Vercel's platform)
3. The module is not found in the serverless function's deployment

### Why The Current Fix Isn't Working

1. **pnpm Hoisting Behavior**: With `node-linker=hoisted`, pnpm hoists dependencies to the root `node_modules`. The `traceInclude` paths in Nitro config point to `node_modules/@takumi-rs/core-linux-x64-gnu` which may not exist in the expected location in a monorepo.

2. **Optional Dependencies on Different Platforms**: When `pnpm install` runs on macOS (developer machine), it installs the Darwin bindings. The Linux binding exists in the lockfile but may not be physically present in node_modules.

3. **Nitro's Bundle Process**: The `traceInclude` tells Nitro to include these paths, but if the files don't exist locally (because you're on macOS), there's nothing to include.

4. **Vercel's Install Phase**: Vercel runs `pnpm install` during build, which SHOULD install platform-specific bindings. However, the Nitro bundling happens after install, and the trace may not correctly find bindings in a pnpm-hoisted monorepo structure.

### Alternative Approaches from Research

#### Option A: Use @takumi-rs/wasm (Edge Runtime)

The WASM version doesn't require native bindings:

```typescript
import { ImageResponse } from "@takumi-rs/image-response/wasm";
import module from "@takumi-rs/wasm/next";

new ImageResponse(<OgImage />, {
  module,  // Required for WASM
  width: 1200,
  height: 630,
});
```

**Limitations**:
- WOFF2 fonts NOT supported in WASM version
- No bundled fonts - must provide fonts manually
- Current implementation uses WOFF2 fonts (`hw-animo-*.woff2`)

#### Option B: Switch to @vercel/og

Vercel's official OG image solution:

```typescript
import { ImageResponse } from "@vercel/og";

export async function GET() {
  return new ImageResponse(
    <div style={{ fontSize: 40 }}>Hello World</div>,
    { width: 1200, height: 630 }
  );
}
```

**Trade-offs**:
- No WOFF2 support (only TTF, OTF, WOFF)
- Would require converting `hw-animo-*.woff2` to `.woff` or `.ttf`
- Official Vercel support, no native binding issues
- Based on Satori, well-tested on Vercel

#### Option C: Use Satori Directly

For more control:

```typescript
import satori from "satori";
import sharp from "sharp";

const svg = await satori(<OgImage />, {
  width: 1200,
  height: 630,
  fonts: [/* fonts */],
});
const png = await sharp(Buffer.from(svg)).png().toBuffer();
```

**Limitations**:
- Requires `sharp` (also has native bindings, but better Vercel support)
- More manual setup

## Code References

- `apps/polychromos-www/src/routes/og[.]png.tsx:1-141` - OG image route implementation
- `apps/polychromos-www/package.json:20-22,34-36` - @takumi-rs dependencies and optional deps
- `apps/polychromos-www/vite.config.ts:19-34` - Nitro configuration with traceInclude
- `.npmrc:1-4` - pnpm configuration with hoisted node-linker
- `apps/polychromos-www/.vercel/output/functions/__fallback.func/.vc-config.json` - Vercel function config (nodejs22.x)

## Architecture Documentation

### Current Stack for OG Images
- **Framework**: TanStack Start with Nitro
- **Deployment**: Vercel serverless (Node.js 22.x)
- **OG Library**: @takumi-rs/image-response v0.66.13
- **Font Format**: WOFF2 (HW Animo variants)
- **Package Manager**: pnpm with hoisted node-linker

### Serverless Function Structure
```
.vercel/output/functions/__fallback.func/
├── .vc-config.json      (nodejs22.x runtime)
├── index.mjs            (handler)
├── package.json
└── chunks/build/
    ├── node-DZ5EM3kH.mjs  (where error originates)
    ├── router-wrfQwBi1.mjs
    └── server.mjs
```

## Historical Context

### Prior Research Documents
- `thoughts/shared/research/2026-02-02-takumi-rs-vercel-native-binding-fix.md` - Initial fix attempt
- `thoughts/shared/research/2026-02-02-polychromos-www-dynamic-og-images.md` - Original OG implementation research
- `thoughts/shared/plans/2026-02-02-polychromos-www-dynamic-og-images.md` - Implementation plan

### Previous Fix Attempt (2026-02-02)
Added `@takumi-rs/core-linux-x64-gnu` as optional dependency - this was deployed but is still failing.

## Possible Solutions

### Solution 1: Convert Fonts and Use @vercel/og (Most Reliable)

Convert WOFF2 fonts to TTF/OTF/WOFF format and switch to `@vercel/og`:

1. Convert fonts: `woff2_decompress hw-animo-*.woff2` or use online tools
2. Replace `@takumi-rs/image-response` with `@vercel/og`
3. Update import and remove WASM/native binding concerns

### Solution 2: Add public-hoist-pattern to .npmrc

Add to `.npmrc`:
```
public-hoist-pattern[]=@takumi-rs/core-*
```

This ensures all @takumi-rs bindings are hoisted to root node_modules.

### Solution 3: Use Standalone Function with Explicit Dependencies

Create a separate serverless function that explicitly bundles the native dependency, outside of Nitro's bundling.

### Solution 4: Move to Edge Runtime with WASM

If WOFF2 fonts can be converted to TTF/WOFF, the WASM version would work:

```typescript
import { ImageResponse } from "@takumi-rs/image-response/wasm";
```

But this has the same font limitation as @vercel/og.

## Open Questions

1. Why doesn't Nitro's `traceInclude` successfully bundle the native binding when it exists in pnpm's hoisted node_modules?
2. Does Vercel's install phase correctly install platform-specific optional dependencies in a pnpm monorepo?
3. Are there specific pnpm/Nitro configuration combinations that would make @takumi-rs work?

## Sources

- [npm optional dependencies bug #4828](https://github.com/npm/cli/issues/4828)
- [Bun + TanStack Start native binding issue #26251](https://github.com/oven-sh/bun/issues/26251)
- [Takumi GitHub](https://github.com/kane50613/takumi)
- [Takumi Documentation](https://takumi.kane.tw/docs/)
- [@vercel/og Documentation](https://vercel.com/docs/og-image-generation)
- [Vercel Native Dependencies Guide](https://vercel.com/kb/guide/why-does-my-serverless-function-work-locally-but-not-when-deployed)
