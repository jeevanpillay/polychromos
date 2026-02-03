# Fix Background Color Mismatch Implementation Plan

## Overview

The dark mode background color is not displaying as pure black (`oklch(0 0 0)`) because of a format mismatch between the dark mode CSS variables (which use `oklch()` function syntax) and the Tailwind `@theme` block (which wraps variables with `hsl()`). This creates invalid CSS like `hsl(oklch(0 0 0))` that browsers cannot interpret.

## Current State Analysis

### The Problem

In `packages/ui/src/globals.css`:

1. **@theme block** (lines 6-41) wraps all color variables with `hsl()`:
   ```css
   --color-background: hsl(var(--background));
   ```

2. **Light mode** (lines 78-112) provides HSL triplets without wrapper - **works correctly**:
   ```css
   --background: 0 0% 98%;  /* Result: hsl(0 0% 98%) ✓ */
   ```

3. **Dark mode** (lines 115-149) provides complete `oklch()` functions - **breaks**:
   ```css
   --background: oklch(0 0 0);  /* Result: hsl(oklch(0 0 0)) ✗ */
   ```

### Additional Issue

`packages/ui/src/components/ui/sidebar.tsx:530` has an inline usage:
```tsx
shadow-[0_0_0_1px_hsl(var(--sidebar-border))]
```
This will also break in dark mode with the current setup.

### Key Discoveries

- All 24 color definitions in `@theme` use `hsl(var(--variable))` wrapper
- All 27 light mode variables use HSL triplets (works correctly)
- All 32 dark mode variables use complete `oklch()` function syntax (breaks)
- The `--workspace-grid-dot` and `--workspace-grid-line` are dark-mode-only variables

## Desired End State

All Tailwind color utilities (e.g., `bg-background`, `text-foreground`) render correctly in both light and dark modes with:
- Light mode: Current HSL-based colors preserved
- Dark mode: OKLCH colors applied correctly, including pure black `oklch(0 0 0)` for background

### Verification

- Visual: Dark mode background should be true black (#000000)
- DevTools: Computed style for `bg-background` should show `oklch(0 0 0)` or equivalent
- No CSS parse errors in browser console related to invalid color functions
- Build passes with no CSS warnings

## What We're NOT Doing

- Not changing the actual color values (keeping the same OKLCH colors in dark mode)
- Not converting dark mode colors back to HSL (OKLCH provides better perceptual uniformity)
- Not adding JavaScript color format conversion
- Not changing light mode colors
- Not adding a color format abstraction layer

## Implementation Approach

The fix is to remove the `hsl()` wrapper from the `@theme` block and instead:
1. Use `var(--variable)` directly in `@theme` (Tailwind v4 supports this)
2. Update light mode variables to include the `hsl()` wrapper in their values
3. Keep dark mode variables with `oklch()` as-is (they already have the function wrapper)

This approach:
- Maintains the same color values in both modes
- Requires minimal changes (only `@theme` block and light mode `:root`)
- Is forward-compatible with CSS Color Level 4 standards

## Phase 1: Update Theme Block and Light Mode Variables

### Overview
Remove the `hsl()` wrapper from the `@theme` block and add it to the light mode variable values instead.

### Changes Required

#### 1. Update `@theme` Block
**File**: `packages/ui/src/globals.css`
**Lines**: 6-41
**Changes**: Remove `hsl()` wrapper, use `var()` directly

```css
@theme {
  /* Colors - using CSS variables directly */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);

  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);

  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);

  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);

  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);

  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);

  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);

  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  /* Sidebar colors */
  --color-sidebar: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* ... rest unchanged ... */
}
```

#### 2. Update Light Mode Variables
**File**: `packages/ui/src/globals.css`
**Lines**: 78-111
**Changes**: Wrap HSL triplet values with `hsl()` function

```css
:root {
  --background: hsl(0 0% 98%);
  --foreground: hsl(240 10% 3.9%);
  --card: hsl(0 0% 98%);
  --card-foreground: hsl(240 10% 3.9%);
  --popover: hsl(0 0% 98%);
  --popover-foreground: hsl(240 10% 3.9%);
  --primary: hsl(240 5.9% 10%);
  --primary-foreground: hsl(0 0% 98%);
  --secondary: hsl(240 4.8% 95.9%);
  --secondary-foreground: hsl(240 5.9% 10%);
  --muted: hsl(240 4.8% 95.9%);
  --muted-foreground: hsl(240 3.8% 46.1%);
  --accent: hsl(240 4.8% 95.9%);
  --accent-foreground: hsl(240 5.9% 10%);
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(240 5.9% 90%);
  --input: hsl(240 5.9% 90%);
  --ring: hsl(240 5.9% 10%);
  --radius: 0.3rem;
  --chart-1: hsl(12 76% 61%);
  --chart-2: hsl(173 58% 39%);
  --chart-3: hsl(197 37% 24%);
  --chart-4: hsl(43 74% 66%);
  --chart-5: hsl(27 87% 67%);
  --sidebar-background: hsl(0 0% 98%);
  --sidebar-foreground: hsl(240 5.3% 26.1%);
  --sidebar-primary: hsl(240 5.9% 10%);
  --sidebar-primary-foreground: hsl(0 0% 98%);
  --sidebar-accent: hsl(240 4.8% 95.9%);
  --sidebar-accent-foreground: hsl(240 5.9% 10%);
  --sidebar-border: hsl(220 13% 91%);
  --sidebar-ring: hsl(217.2 91.2% 59.8%);
}
```

#### 3. Update Sidebar Component Inline Style
**File**: `packages/ui/src/components/ui/sidebar.tsx`
**Line**: 530
**Changes**: Remove `hsl()` wrapper from arbitrary shadow values

```tsx
// Before
"bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]"

// After
"bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]"
```

### Success Criteria

#### Automated Verification:
- [x] Build passes: `pnpm build:www`
- [x] Type checking passes: `pnpm typecheck` (pre-existing TypeScript issues unrelated to CSS changes)
- [x] Linting passes: `pnpm lint` (pre-existing ESLint issues unrelated to CSS changes)

#### Manual Verification:
- [ ] Dark mode background is true black (use browser DevTools color picker to verify #000000)
- [ ] Light mode colors remain unchanged (compare before/after screenshots)
- [ ] All semantic colors work in both modes (primary, secondary, destructive, muted, accent)
- [ ] Sidebar colors render correctly in both modes
- [ ] No console errors related to CSS parsing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the visual testing was successful.

---

## Testing Strategy

### Unit Tests
- N/A - CSS styling changes, no logic to test

### Integration Tests
- N/A - Visual verification required

### Manual Testing Steps
1. Start dev server: `pnpm dev:www`
2. Open http://localhost:3000 in browser
3. Open DevTools → Elements panel
4. Inspect `<body>` element
5. Verify computed `background-color` shows:
   - Dark mode: `oklch(0 0 0)` or `rgb(0, 0, 0)` or `#000000`
   - Light mode: `hsl(0 0% 98%)` or equivalent
6. Toggle between light/dark modes (if toggle exists, or toggle `.dark` class manually)
7. Verify all UI elements have correct colors in both modes

## Performance Considerations

None - this is a pure CSS fix with no runtime impact.

## Migration Notes

None - backwards compatible change, no data migration required.

## References

- Research document: `thoughts/shared/research/2026-01-31-background-color-mismatch.md`
- CSS file to modify: `packages/ui/src/globals.css`
- Component to update: `packages/ui/src/components/ui/sidebar.tsx:530`
