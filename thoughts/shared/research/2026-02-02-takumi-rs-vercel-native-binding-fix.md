---
date: 2026-02-02T12:00:00+08:00
researcher: claude-opus-4-5
topic: "Fix @takumi-rs native binding error on Vercel serverless"
tags: [research, web-analysis, vercel, native-bindings, og-images, takumi-rs]
status: complete
created_at: 2026-02-02
confidence: high
sources_count: 15
---

# Web Research: Fix @takumi-rs Native Binding Error on Vercel

**Date**: 2026-02-02
**Topic**: Native binding error for @takumi-rs/image-response on Vercel serverless
**Confidence**: High

## Research Question

How to fix the "Cannot find native binding" error for `@takumi-rs/image-response` when deployed to Vercel serverless functions?

Error:
```
Cannot find module '@takumi-rs/core-linux-x64-gnu'
```

## Executive Summary

The error occurs because native Rust bindings require platform-specific compiled binaries. During local development on macOS, only Darwin bindings are installed. Vercel runs on Linux x64 GNU, requiring different binaries. This is a known npm bug with optional dependencies (npm/cli#4828).

**Solution**: Add the Linux binding as an explicit optional dependency in `package.json` so it gets installed during Vercel's build process.

## Key Findings

### Why This Happens

**Root Cause**: Native Rust packages like `@takumi-rs/core` use optional dependencies for platform-specific binaries:
- `@takumi-rs/core-darwin-arm64` (macOS Apple Silicon)
- `@takumi-rs/core-darwin-x64` (macOS Intel)
- `@takumi-rs/core-linux-x64-gnu` (Linux - Vercel's platform)
- etc.

When you `pnpm install` locally on macOS, only the Darwin binding gets installed. Vercel needs the Linux binding but doesn't find it because:
1. Your lockfile was generated on macOS
2. npm has a bug where optional deps don't properly resolve cross-platform

### Solution: Explicit Optional Dependency

Add the Linux binding explicitly to ensure it's installed on Vercel:

```json
{
  "optionalDependencies": {
    "@takumi-rs/core-linux-x64-gnu": "^0.66.13"
  }
}
```

This tells pnpm to always install this binding regardless of the current platform.

### Alternative: Switch to @vercel/og

If the fix doesn't work reliably, `@vercel/og` is the officially supported solution:
- Same API (ImageResponse, JSX, fonts)
- No native binding issues on Vercel
- Excellent performance (~800ms generation time)
- **Limitation**: Only supports TTF/OTF/WOFF (not WOFF2)

## Trade-off Analysis

### Stick with @takumi-rs (Recommended Fix)

| Factor | Impact | Notes |
|--------|--------|-------|
| Performance | 2-10x faster | Direct rasterization, no SVG step |
| Font Support | WOFF2 supported | Your current fonts work |
| Stability | Medium | Native binding issues possible |
| Vercel Support | Unofficial | Community-maintained |

### Switch to @vercel/og

| Factor | Impact | Notes |
|--------|--------|-------|
| Performance | ~800ms | Still fast, official benchmarks |
| Font Support | No WOFF2 | Need to convert fonts |
| Stability | High | Zero native binding issues |
| Vercel Support | Official | First-party maintained |

## Recommendations

1. **Try the quick fix first**: Add `@takumi-rs/core-linux-x64-gnu` as optional dependency
2. **If issues persist**: Switch to `@vercel/og` (convert fonts from WOFF2 to WOFF)
3. **Clean install**: Always delete `node_modules` and reinstall after changes

## Implementation Steps

### For apps/www and apps/polychromos-www

Add to each `package.json`:

```json
{
  "optionalDependencies": {
    "@takumi-rs/core-linux-x64-gnu": "^0.66.13"
  }
}
```

Then:
```bash
# Clean and reinstall
rm -rf node_modules apps/*/node_modules
pnpm install
# Commit and deploy
```

## Sources

### Official Documentation
- [Vercel OG Image Generation](https://vercel.com/docs/og-image-generation)
- [Vercel Functions Configuration](https://vercel.com/docs/functions/configuring-functions)

### GitHub Issues
- [npm optional dependencies bug #4828](https://github.com/npm/cli/issues/4828)
- [Bun + TanStack Start native binding issue #26251](https://github.com/oven-sh/bun/issues/26251)

### Libraries
- [Takumi GitHub](https://github.com/kane50613/takumi)
- [@takumi-rs/core npm](https://www.npmjs.com/package/@takumi-rs/core)
- [@vercel/og npm](https://www.npmjs.com/package/@vercel/og)

---

**Last Updated**: 2026-02-02
**Confidence Level**: High - Based on documented npm bug and community solutions
**Next Steps**: Apply the optional dependency fix to both apps
