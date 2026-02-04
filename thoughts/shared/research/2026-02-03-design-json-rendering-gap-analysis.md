---
date: 2026-02-03T21:45:00+08:00
researcher: jeevan
git_commit: 7a1946c81360fd74006b858528b92cdb26eaa02c
branch: main
repository: polychromos
topic: "Design JSON Rendering - Properties Not Applied"
tags: [research, codebase, rendering, box-renderer, text-renderer, style-processing]
status: complete
last_updated: 2026-02-03
last_updated_by: jeevan
---

# Research: Design JSON Rendering - Properties Not Applied

**Date**: 2026-02-03T21:45:00+08:00
**Researcher**: jeevan
**Git Commit**: 7a1946c81360fd74006b858528b92cdb26eaa02c
**Branch**: main
**Repository**: polychromos

## Research Question
The design.json file contains a complex OG image design with many CSS properties, but the rendered output in production is missing significant styling. What properties in the design.json are NOT being applied by the current renderer?

## Summary

The renderer currently supports only a subset of the CSS properties defined in the design.json. Many properties used in the OG image design (backgroundImage, gradients, position offsets, letterSpacing, textDecoration, zIndex, etc.) are not processed by the Box and Text renderers.

## Detailed Findings

### Properties in design.json vs. What Box Renderer Supports

**Box Renderer (`box.tsx:14-67`) processes:**
- `element.x` → `left`
- `element.y` → `top`
- `element.width` → `width`
- `element.height` → `height`
- `element.layout.display` → `display`
- `element.layout.flexDirection` → `flexDirection`
- `element.layout.justifyContent` → `justifyContent`
- `element.layout.alignItems` → `alignItems`
- `element.layout.gap` → `gap`
- `element.padding` → `padding`
- `element.margin` → `margin`
- `element.style.backgroundColor` → `backgroundColor`
- `element.style.borderRadius` → `borderRadius`
- `element.style.border` → `border`
- `element.style.opacity` → `opacity`

**Properties in design.json NOT processed by Box renderer:**
- `element.layout.position` (absolute/relative) - design.json uses this extensively
- `element.style.overflow` - design.json uses `overflow: hidden`
- `element.style.backgroundImage` - design.json uses gradients and grid patterns
- `element.style.backgroundSize` - design.json uses `60px 60px`
- `element.style.background` - design.json uses `radial-gradient(...)` and `linear-gradient(...)`
- `element.style.right` - design.json uses `right: -200px`
- `element.style.top` (in style object) - design.json uses `top: -200px`
- `element.style.bottom` - design.json uses `bottom: 64px`
- `element.style.padding` (in style object) - design.json uses `padding: 64px 72px`
- `element.style.zIndex` - design.json uses `zIndex: 1`
- `element.style.flex` - design.json uses `flex: 1`
- `element.style.marginLeft` - design.json uses `marginLeft: 28px`

### Properties in design.json vs. What Text Renderer Supports

**Text Renderer (`text.tsx:12-54`) processes:**
- `element.width` → `width`
- `element.height` → `height`
- `element.padding` → `padding`
- `element.margin` → `margin`
- `element.text.fontFamily` → `fontFamily`
- `element.text.fontSize` → `fontSize`
- `element.text.fontWeight` → `fontWeight`
- `element.text.color` → `color`
- `element.text.textAlign` → `textAlign`
- `element.text.lineHeight` → `lineHeight`
- `element.style.backgroundColor` → `backgroundColor`
- `element.style.opacity` → `opacity`

**Properties in design.json NOT processed by Text renderer:**
- `element.text.letterSpacing` - design.json uses extensively (e.g., `0.08em`, `0.05em`, `-0.02em`)
- `element.text.textDecoration` - design.json uses `line-through` on "STATIC PIXELS"

### Impact on Rendered Output

Looking at the screenshot, the rendering issues observed are:

1. **No Grid Background** - `backgroundImage: linear-gradient(#1a1a1a 1px, transparent 1px)...` not applied
2. **No Radial Glow** - `background: radial-gradient(circle, #06b6d433 0%, transparent 70%)` not applied
3. **Elements Not Positioned Absolutely** - `position: absolute` in layout not processed
4. **No Letter Spacing** - All text appears without the defined letter spacing
5. **No Strikethrough** - "STATIC PIXELS" missing `line-through`
6. **No Gradient on Arrow** - `background: linear-gradient(90deg, #06b6d4 0%, transparent 100%)` not applied
7. **No Gradient on Logo Mark** - `background: linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)` not applied
8. **Layout Collapse** - Without `position: absolute` and explicit positioning (`right`, `bottom`), elements stack instead of overlay

### Type Definitions vs. Renderer Implementation

The `LayoutConfig` interface (`types.ts:50-58`) defines:
- `display`, `flexDirection`, `justifyContent`, `alignItems`, `gap`
- `gridTemplateColumns`, `gridTemplateRows`

**Missing from LayoutConfig:**
- `position` (absolute/relative/fixed)
- `top`, `right`, `bottom`, `left` (positioning offsets)

The design.json uses `layout.position` extensively, but this property is not defined in the TypeScript types and not processed by the renderer.

### Style Object in design.json vs. Types

The `style` property in `PolychromosElement` (`types.ts:38-43`) supports:
- `backgroundColor`, `borderRadius`, `border`, `opacity`

**Not in types but used in design.json:**
- `overflow`
- `backgroundImage`
- `backgroundSize`
- `background` (shorthand)
- `zIndex`
- `flex`
- `padding` (in style vs. element.padding)
- `marginLeft` (specific margin)
- `right`, `top`, `bottom` (position offsets)

## Code References

- `apps/polychromos-app/src/components/element-renderers/box.tsx:36-43` - Layout property processing
- `apps/polychromos-app/src/components/element-renderers/box.tsx:49-55` - Style property processing
- `apps/polychromos-app/src/components/element-renderers/text.tsx:34-40` - Text typography processing
- `packages/polychromos-types/src/types.ts:50-58` - LayoutConfig interface
- `packages/polychromos-types/src/types.ts:38-43` - Style property definition
- `packages/polychromos-types/src/types.ts:60-68` - TextConfig interface

## Architecture Documentation

**Current Rendering Pipeline:**
1. `design.json` is loaded (contains rich CSS properties)
2. `CanvasContainer` wraps the component
3. `Renderer` dispatches to type-specific renderers (box/text/image/webgl)
4. Each renderer extracts a subset of properties and converts to React.CSSProperties
5. Properties not explicitly handled are silently ignored

**Property Flow:**
```
design.json → element.layout.* → box.tsx checks specific keys → React CSSProperties
design.json → element.style.* → box.tsx checks specific keys → React CSSProperties
design.json → element.text.* → text.tsx checks specific keys → React CSSProperties
```

Properties not in the explicit checks are dropped.

## Properties Comparison Table

| Property | In design.json | In Types | In Renderer | Rendered |
|----------|---------------|----------|-------------|----------|
| display | Yes | Yes | Yes | Yes |
| flexDirection | Yes | Yes | Yes | Yes |
| alignItems | Yes | Yes | Yes | Yes |
| gap | Yes | Yes | Yes | Yes |
| position (absolute) | Yes | No | No | No |
| backgroundColor | Yes | Yes | Yes | Yes |
| backgroundImage | Yes | No | No | No |
| background (gradient) | Yes | No | No | No |
| right/top/bottom | Yes | No | No | No |
| zIndex | Yes | No | No | No |
| overflow | Yes | No | No | No |
| letterSpacing | Yes | No | No | No |
| textDecoration | Yes | No | No | No |
| flex (shorthand) | Yes | No | No | No |

## Open Questions

1. Was the design.json created with a different renderer in mind (e.g., Satori which supports more CSS)?
2. Should the renderer be extended to support these properties, or should the types be updated first?
3. Is there a different rendering path for OG images vs. the web app preview?
