---
date: 2026-02-02T00:00:00+00:00
researcher: Claude
git_commit: f698e11cf1e6e188e6504f189b3b4b23c5151372
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Layout Shift Analysis in polychromos-www Index Page"
tags: [research, codebase, polychromos-www, layout-shift, css, flexbox]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Layout Shift Analysis in polychromos-www Index Page

**Date**: 2026-02-02
**Researcher**: Claude
**Git Commit**: f698e11cf1e6e188e6504f189b3b4b23c5151372
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question
Investigate why layout shift is happening in `apps/polychromos-www/src/routes/index.tsx`. Identify the code that causes the shift and which components are involved.

## Summary

The layout shift in the polychromos-www index page is caused by **three primary factors**:

1. **Conditional rendering of form elements** - The success message, error message, and form conditionally appear/disappear, changing the vertical height of the form section
2. **FormMessage component behavior** - Returns `null` when no validation error exists, causing ~22-24px layout shift when errors appear/disappear
3. **Font loading with `font-display: swap`** - Custom fonts (HW Animo, PP Neue Montreal) use swap strategy, which can cause text reflow when fonts load

## Detailed Findings

### 1. Conditional Rendering in Form Section

**Location**: `apps/polychromos-www/src/routes/index.tsx:97-161`

The form section has three mutually exclusive states that render different content with different heights:

#### State: Idle (Initial)
```tsx
// Line 121-161: Form is rendered
{submitStatus !== "success" && (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
      <FormField ... />
      <Button ... />
    </form>
  </Form>
)}
```
- Form renders with Input (36px height) + Button (36px height)
- FormItem has `space-y-1` creating 4px gap for potential error message

#### State: Success
```tsx
// Lines 97-106: Success message replaces form
{submitStatus === "success" && (
  <div className="border-border bg-muted text-foreground max-w-sm p-3">
    <p className="text-sm font-medium">You're on the list!</p>
    <p className="text-muted-foreground text-xs mt-1">
      We'll notify you when early access is available.
    </p>
  </div>
)}
```
- Success box has `p-3` (12px padding) + two lines of text
- **Different height than form** - causes layout shift

#### State: Error
```tsx
// Lines 109-118: Error message appears ABOVE form (form still visible)
{submitStatus === "error" && (
  <div className="border-destructive bg-destructive/10 text-destructive max-w-sm border p-3">
    <p className="text-sm font-medium">Something went wrong</p>
    <p className="text-xs mt-1">Please try again.</p>
  </div>
)}
```
- Error message renders AND form renders (form condition at line 121 allows this)
- **Adds additional height** to the form section

### 2. FormMessage Component Behavior

**Location**: `packages/ui/src/components/ui/form.tsx:170-192`

The FormMessage component conditionally renders based on validation state:

```tsx
// form.tsx:177-179
if (!body) {
  return null;  // Takes up 0px when no error
}
```

When rendered, the component:
- Adds `margin-top: 0.25rem` (4px) from parent's `space-y-1`
- Adds text height of `text-[0.8rem]` (~18-20px with line-height)
- **Total layout shift: ~22-24px**

**Usage in index.tsx:141**:
```tsx
<FormItem className="flex-1 max-w-xs space-y-1">
  <FormControl>
    <Input ... />
  </FormControl>
  <FormMessage />  // Appears/disappears based on validation
</FormItem>
```

### 3. Font Loading Strategy

**Location**: `apps/polychromos-www/src/styles/fonts.css`

All custom fonts use `font-display: swap`:

```css
@font-face {
  font-family: "HW Animo Semi Expanded";
  src: url("/fonts/hw-animo/hw-animo-semi-expanded-regular.woff2") format("woff2");
  font-display: swap;  // Line 18
}

@font-face {
  font-family: "HW Animo Semi Condensed Outline";
  src: url("/fonts/hw-animo/hw-animo-semicondensed-regular-outline.woff") format("woff");
  font-display: swap;  // Line 28
}

@font-face {
  font-family: "PP Neue Montreal";
  src: url("/fonts/pp-neue-montreal/PPNeueMontreal-Regular.woff2") format("woff2");
  font-display: swap;  // Multiple instances
}
```

These fonts are used in the large typography section:

**Location**: `apps/polychromos-www/src/routes/index.tsx:173-200`
```tsx
<h1 className="text-[10vw] leading-[0.95] tracking-tight lg:text-5xl">
  <span style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}>
    DESIGN IS NO LONGER STATIC PIXELS.
  </span>
</h1>
```

When fonts load and replace the fallback, text dimensions change causing layout reflow.

### 4. Flexbox Layout with Multiple `flex-1` Elements

**Location**: `apps/polychromos-www/src/routes/index.tsx`

The page uses nested `flex-1` elements that distribute space:

```
Root Container (flex flex-col min-h-screen) - Line 53
├── Header - Line 55
└── Main (flex flex-1 flex-col) - Line 77
    ├── Hero Section (mt-16 flex-1) - Line 79  ← flex-1
    │   └── Value Prop + Form
    ├── Spacer (flex-1) - Line 167  ← flex-1
    └── Bottom Typography (mb-8) - Line 170
```

**Problem**: When the form section height changes (due to conditional rendering), both `flex-1` elements redistribute the remaining space, potentially causing the bottom typography to shift.

### 5. Button Loading State (Not a Layout Shift Source)

**Location**: `apps/polychromos-www/src/routes/index.tsx:145-158`

The button loading state does NOT cause layout shift because:
- Button has fixed height: `h-9` (36px) from `size="default"`
- Icon size matches text baseline: `h-4 w-4` (16px)
- Only content swaps, not container dimensions

## Components Involved

| Component | File | Role in Layout Shift |
|-----------|------|---------------------|
| HomePage | `apps/polychromos-www/src/routes/index.tsx` | Main container with conditional rendering |
| FormMessage | `packages/ui/src/components/ui/form.tsx` | Returns null vs rendered element |
| Input | `packages/ui/src/components/ui/input.tsx` | Fixed height (36px), no shift |
| Button | `packages/ui/src/components/ui/button.tsx` | Fixed height (36px), no shift |

## Layout Hierarchy Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Root Container (min-h-screen flex flex-col)                 │
├─────────────────────────────────────────────────────────────┤
│ Header (fixed height, no shift)                             │
├─────────────────────────────────────────────────────────────┤
│ Main (flex-1 flex-col)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Hero Section (flex-1)                                   │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Value Proposition (fixed content)                   │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Form Section (space-y-3)         ← SHIFT SOURCE    │ │ │
│ │ │ • Success Message (conditional)  ← HEIGHT VARIES   │ │ │
│ │ │ • Error Message (conditional)    ← HEIGHT VARIES   │ │ │
│ │ │ • Form (conditional)             ← HEIGHT VARIES   │ │ │
│ │ │   └── FormMessage (conditional)  ← HEIGHT VARIES   │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Spacer (flex-1)                    ← ABSORBS HEIGHT   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Bottom Typography (fixed margin)   ← SHIFTS POSITION  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Code References

- `apps/polychromos-www/src/routes/index.tsx:53` - Root container with flex layout
- `apps/polychromos-www/src/routes/index.tsx:77` - Main container with flex-1
- `apps/polychromos-www/src/routes/index.tsx:79` - Hero section with flex-1
- `apps/polychromos-www/src/routes/index.tsx:90-161` - Form section with conditional rendering
- `apps/polychromos-www/src/routes/index.tsx:97-106` - Success message (conditional)
- `apps/polychromos-www/src/routes/index.tsx:109-118` - Error message (conditional)
- `apps/polychromos-www/src/routes/index.tsx:121-161` - Form (conditional)
- `apps/polychromos-www/src/routes/index.tsx:131` - FormItem with space-y-1
- `apps/polychromos-www/src/routes/index.tsx:141` - FormMessage usage
- `apps/polychromos-www/src/routes/index.tsx:167` - Spacer div with flex-1
- `apps/polychromos-www/src/routes/index.tsx:170-203` - Bottom typography section
- `packages/ui/src/components/ui/form.tsx:170-192` - FormMessage component
- `packages/ui/src/components/ui/form.tsx:177-179` - FormMessage conditional return null
- `apps/polychromos-www/src/styles/fonts.css:18,28` - font-display: swap declarations

## Architecture Documentation

### CSS Import Chain
```
__root.tsx imports:
├── @fontsource/geist-mono
├── @fontsource/geist-sans
├── ~/styles/fonts.css (custom fonts)
└── ../styles/app.css
    ├── tailwindcss
    └── @polychromos/ui/globals.css
        ├── tailwindcss
        └── tw-animate-css
```

### Form State Machine
```
submitStatus: "idle" | "success" | "error"

"idle" → Form visible, no messages
"success" → Success message visible, form hidden
"error" → Error message visible, form visible
```

## Open Questions

1. What is the intended visual behavior when transitioning between states?
2. Should the bottom typography remain fixed, or is movement acceptable?
3. Is there a specific minimum height the form section should maintain?
