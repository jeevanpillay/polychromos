---
date: 2026-01-31T23:25:00+11:00
researcher: Claude
git_commit: ee9630862629a597d45d36010ffc6a5e2b499649
branch: main
repository: x
topic: "Twitter Banner Generator - Extracting Layered I Effect"
tags: [research, codebase, image-generation, twitter-banner, typography]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Twitter Banner Generator - Extracting Layered I Effect

**Date**: 2026-01-31T23:25:00+11:00
**Researcher**: Claude
**Git Commit**: ee9630862629a597d45d36010ffc6a5e2b499649
**Branch**: main
**Repository**: x

## Research Question

How to extract the layered "I" effect from the homepage bottom section and create a Twitter banner generator tool that:
1. Uses `bg-background` from globals.css
2. Places the layered "I" blocks (40%/60%/100%) on the right side with padding
3. Generates high-resolution images programmatically

## Summary

The layered text effect at the bottom of the homepage uses a CSS height-clipping technique where three identical text elements are wrapped in containers of different heights (4.0vw, 4.8vw, and full height), creating a stacked reveal effect showing approximately 50%, 60%, and 100% of the text. The effect uses custom Joyride/JoyrideALT fonts with the "I" character rendered in brand-red (#e62200).

For generating Twitter banners (1500x500px), **`html-to-image`** is the recommended approach as it works with existing Tailwind CSS classes and browser-rendered fonts without server-side dependencies.

## Detailed Findings

### Current Implementation - Layered Text Effect

**Location**: `apps/www/src/routes/index.tsx:230-293`

The effect creates a "staircase" visual where each row shows progressively more of the text height:

#### Layer Structure

| Layer | Container Height | Text Size | Visible Portion |
|-------|-----------------|-----------|-----------------|
| 1st   | 4.0vw           | 8vw       | ~50% (top half) |
| 2nd   | 4.8vw           | 8vw       | ~60%            |
| 3rd   | No container    | 8vw       | 100% (full)     |

#### CSS Technique

```tsx
// Layer 1 - 50% clipping (index.tsx:232-253)
<div style={{ overflow: "hidden", height: "4.0vw" }}>
  <h2 className="text-[8vw] whitespace-nowrap leading-none"
      style={{ fontFamily: "Joyride, sans-serif" }}>
    JEEVAN <span style={{ fontFamily: "JoyrideALT, sans-serif" }}>P</span>
    <span className="text-brand-red" style={{ fontFamily: "JoyrideALT, sans-serif" }}>I</span>
    LLAY
  </h2>
</div>

// Layer 2 - 60% clipping (index.tsx:255-276)
<div style={{ overflow: "hidden", height: "4.8vw" }}>
  {/* Same content */}
</div>

// Layer 3 - Full (index.tsx:278-292)
<h2 className="text-[8vw] whitespace-nowrap leading-none" ...>
  {/* Same content, no wrapper */}
</h2>
```

#### Key Styling Details

- **Font families**:
  - `Joyride` for most characters
  - `JoyrideALT` for "P" and "I" (stylistic alternates)
- **Brand red**: `#e62200` applied via `text-brand-red` class
- **Line height**: `leading-none` (line-height: 1) ensures predictable clipping
- **Whitespace**: `whitespace-nowrap` prevents text wrapping
- **Visibility**: Desktop only (`hidden lg:block`)

### Font Definitions

**Location**: `packages/ui/src/globals.css:7-37`

```css
/* Joyride Standard */
@font-face {
  font-family: "Joyride";
  src: url("/fonts/joyride/JoyrideSTD.woff2") format("woff2"),
       url("/fonts/joyride/JoyrideSTD.woff") format("woff");
  font-weight: normal;
  font-display: swap;
}

/* Joyride Alt (for P and I) */
@font-face {
  font-family: "JoyrideALT";
  src: url("/fonts/joyride/JoyrideALT.woff2") format("woff2"),
       url("/fonts/joyride/JoyrideALT.woff") format("woff");
  font-weight: normal;
  font-display: swap;
}
```

### Background Color Definitions

**Location**: `packages/ui/src/globals.css:110-152`

```css
:root {
  --background: oklch(1 0 0);        /* White */
  --brand-red: #e62200;
}

.dark {
  --background: oklch(0 0 0);        /* Black */
}
```

The `bg-background` Tailwind class maps to `--color-background: var(--background)` (line 50).

### Existing Image Generation Utilities

**Location**: `packages/ui/src/lib/html-to-svg.ts`

The codebase has an existing HTML-to-SVG utility with these exports:
- `htmlToSvg()` - Convert text to SVG string
- `htmlToSvgDataUrl()` - Convert to data URL
- `htmlToSvgBlob()` - Convert to Blob
- `downloadSvg()` - Download as file
- `copySvgToClipboard()` - Copy to clipboard
- `createResponsiveSvgText()` - Responsive text SVG

**Limitation**: This utility handles simple text only, not the complex layered clipping effect.

### Image Generation Options Research

| Approach | Best For | Browser/Node | Bundle Size | Custom Fonts |
|----------|----------|--------------|-------------|--------------|
| **html-to-image** | Client-side, Tailwind CSS | Browser only | 20KB | Uses browser fonts |
| **Satori + resvg** | Build-time, SSR | Both | Small | Requires font files |
| **@vercel/og** | Vercel Edge Functions | Edge only | Small | Limited |
| **Puppeteer** | Complex rendering | Node.js | ~170MB | Full support |

#### Recommended: `html-to-image`

For this use case, `html-to-image` is optimal because:
1. Works with existing Tailwind CSS classes (`bg-background`, `text-brand-red`)
2. Renders using actual browser fonts (Joyride/JoyrideALT already loaded)
3. Supports high DPI export (`pixelRatio: 2` for 3000x1000 from 1500x500)
4. No server-side dependencies
5. Small bundle size (~20KB)

**Installation**: `pnpm add html-to-image`

**Usage Pattern**:
```typescript
import { toPng } from 'html-to-image';

const dataUrl = await toPng(elementRef.current, {
  width: 1500,
  height: 500,
  pixelRatio: 2,  // 2x resolution
  backgroundColor: '#ffffff'
});
```

### Proposed Banner Design

```
┌──────────────────────────────────────────────────────┐
│  bg-background                                       │
│                                        ┌───────────┐ │
│                                        │  I (50%)  │ │
│                                        │  I (60%)  │ │
│                                        │  I (100%) │ │
│                                        └───────────┘ │
│                                        (with padding)│
└──────────────────────────────────────────────────────┘
Twitter Banner: 1500x500px (exported at 2x = 3000x1000)
```

### Implementation Approach

1. **Create route**: `apps/www/src/routes/tools/twitter-banner.tsx`
2. **Extract component**: `<LayeredIEffect />` with just the "I" letters
3. **Render offscreen**: Hidden div at exact banner dimensions
4. **Export**: Use `html-to-image` to capture and download

#### Extracted I-Only Component Structure

```tsx
function LayeredIEffect({ fontSize = 120 }: { fontSize?: number }) {
  const heights = [0.5, 0.6, 1]; // 50%, 60%, 100%

  return (
    <div className="flex flex-col">
      {heights.map((ratio, i) => (
        <div
          key={i}
          style={{
            overflow: ratio < 1 ? "hidden" : undefined,
            height: ratio < 1 ? fontSize * ratio : undefined
          }}
        >
          <span
            className="text-brand-red leading-none"
            style={{
              fontFamily: "JoyrideALT, sans-serif",
              fontSize
            }}
          >
            I
          </span>
        </div>
      ))}
    </div>
  );
}
```

## Code References

- `apps/www/src/routes/index.tsx:230-293` - Layered text effect implementation
- `apps/www/src/routes/index.tsx:245-250` - Brand red "I" styling
- `packages/ui/src/globals.css:7-37` - Joyride font definitions
- `packages/ui/src/globals.css:83` - Brand red color mapping
- `packages/ui/src/globals.css:112` - Light mode background
- `packages/ui/src/globals.css:144` - Brand red value (#e62200)
- `packages/ui/src/globals.css:152` - Dark mode background
- `packages/ui/src/lib/html-to-svg.ts:1-150` - Existing SVG generation utilities

## Architecture Documentation

### Tailwind v4 Theme System

The project uses Tailwind v4's CSS-based configuration via `@theme inline` directives in `globals.css`. Color variables are defined in `:root` and `.dark` selectors using OKLCH color space, then mapped to Tailwind via `--color-*` custom properties.

### Monorepo Structure

```
x/
├── apps/www/           # TanStack Start app
│   └── src/routes/     # File-based routing
├── packages/ui/        # Shared UI library
│   ├── src/lib/        # Utilities (html-to-svg.ts)
│   └── src/globals.css # Theme definitions
```

### Font Loading

Custom fonts are loaded via `@font-face` in globals.css with WOFF2/WOFF formats and `font-display: swap` for progressive enhancement. Font files are served from `/fonts/joyride/`.

## Open Questions

1. **Light vs Dark mode**: Should the banner support both? Currently would inherit from system/site preference.
2. **Customization**: Should users be able to adjust the "I" position, size, or colors?
3. **Additional formats**: PNG only, or also SVG/JPEG options?
4. **Hosting location**: Route under `/tools/` or separate generator page?
