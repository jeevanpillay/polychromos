---
date: 2026-01-31T12:00:00+08:00
researcher: Claude
git_commit: 061e8899fc89bc151ff3f3c3daa07e7da575619d
branch: main
repository: x
topic: "Why apps/www shows different background color instead of full black"
tags: [research, codebase, styling, tailwind, oklch, css-variables]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Background Color Not Showing Full Black

**Date**: 2026-01-31T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 061e8899fc89bc151ff3f3c3daa07e7da575619d
**Branch**: main
**Repository**: x

## Research Question
Why is apps/www not showing the full black color as background and instead showing a different color?

## Summary

The background is **NOT actually using the pure black `oklch(0 0 0)` defined in the dark theme variables**. This is due to a **color format mismatch** between:

1. The dark mode CSS variables which use `oklch()` format
2. The Tailwind theme which wraps variables with `hsl()` function

The `--background` variable is set to `oklch(0 0 0)` in dark mode, but the Tailwind theme definition wraps it with `hsl(var(--background))`, creating an invalid CSS color.

## Detailed Findings

### How the Background Color is Applied

The background is applied in `apps/www/src/routes/__root.tsx:66-67`:

```tsx
<body className="min-h-screen bg-background font-sans antialiased">
  <div className="relative flex min-h-screen flex-col bg-background">
```

The `dark` class is set on the html element at line 62:
```tsx
<html lang="en" className="dark">
```

### CSS Variable Configuration

In `packages/ui/src/globals.css`:

**Tailwind Theme Definition (lines 5-10):**
```css
@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ... */
}
```

**Light Mode (lines 78-79):**
```css
:root {
  --background: 0 0% 98%;  /* HSL values without hsl() wrapper */
```

**Dark Mode (lines 115-116):**
```css
.dark {
  --background: oklch(0 0 0);  /* OKLCH color format */
```

### The Mismatch

| Mode | `--background` value | Tailwind wraps with | Result |
|------|---------------------|---------------------|--------|
| Light | `0 0% 98%` | `hsl(...)` | ✅ Valid: `hsl(0 0% 98%)` |
| Dark | `oklch(0 0 0)` | `hsl(...)` | ❌ Invalid: `hsl(oklch(0 0 0))` |

In dark mode, the Tailwind `--color-background` becomes `hsl(oklch(0 0 0))` which is **invalid CSS**. The browser falls back to a different color.

### Body Base Styles

The body styling in `packages/ui/src/globals.css:158-161`:
```css
body {
  @apply overscroll-none bg-background text-foreground;
  font-synthesis-weight: none;
  text-rendering: optimizeLegibility;
}
```

## Code References

- `packages/ui/src/globals.css:9` - Tailwind theme wraps background with `hsl()`
- `packages/ui/src/globals.css:79` - Light mode uses HSL values (works correctly)
- `packages/ui/src/globals.css:116` - Dark mode uses OKLCH (causes mismatch)
- `apps/www/src/routes/__root.tsx:62` - Sets `dark` class on html
- `apps/www/src/routes/__root.tsx:66-67` - Applies `bg-background` class

## Architecture Documentation

The project uses Tailwind v4 with CSS-based theme configuration:
- Theme tokens defined in `@theme {}` block
- CSS variables defined in `@layer base {}`
- Dark mode uses `.dark` class selector
- Colors use HSL format in light mode, OKLCH format in dark mode

The styling imports chain:
1. `apps/www/src/styles/app.css` imports `tailwindcss` and `@repo/ui/globals.css`
2. `packages/ui/src/globals.css` contains all theme definitions

## Open Questions

1. Should the dark mode variables use HSL values (without wrapper) like light mode does?
2. Should the `@theme` block use direct oklch values instead of hsl() wrapper?
3. Is there a Tailwind v4 pattern for mixed color formats in theme variables?
