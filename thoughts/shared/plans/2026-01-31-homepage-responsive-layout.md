---
date: 2026-01-31
planner: Claude
branch: main
repository: x
topic: "Homepage Responsive Layout Implementation"
tags: [plan, responsive, tailwind, homepage]
status: ready
---

# Homepage Responsive Layout Implementation Plan

## Overview

Implement mobile-first responsive layout for the homepage (`apps/www/src/routes/index.tsx`). The main grid should collapse from 3 columns to a single stacked column on mobile devices, following the existing pattern used in `ContactDialog`.

## Current State Analysis

The homepage currently uses a **fixed 3-column grid** (`grid-cols-3`) that does not change across breakpoints. This causes the bio text and social links to be cramped on mobile screens.

**Current implementation** (`index.tsx:44`):
```tsx
<div className="grid grid-cols-3 gap-8 md:gap-12">
```

**Desired pattern** (from `contact-dialog.tsx:105`):
```tsx
<div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-12 pt-10">
```

### Key Discoveries:
- `index.tsx:44` - Fixed 3-column grid that needs responsive collapse
- `index.tsx:46-72` - Left column with bio text
- `index.tsx:75` - Middle empty spacer column (should be hidden on mobile)
- `index.tsx:78-110` - Right column with social links
- `contact-dialog.tsx:105` - Example of proper `grid-cols-1 md:grid-cols-3` pattern
- Decorative text at bottom uses `text-[8vw]` which scales naturally with viewport

## Desired End State

On mobile (`< 768px`):
- Bio text appears first (full width)
- Social links appear below bio (full width)
- Middle spacer is hidden
- Spacing and padding remain at mobile values (`gap-8`, `p-8`)

On desktop (`≥ 768px`):
- 3-column layout restored
- Bio on left, empty middle, social links on right
- Larger spacing (`gap-12`, `p-12`)

### Verification:
- Visual inspection at 375px width (mobile)
- Visual inspection at 768px width (tablet/desktop transition)
- Visual inspection at 1440px width (desktop)
- No horizontal scrolling on any viewport

## What We're NOT Doing

- **NOT** changing the decorative "JEEVAN PILLAY" text sizing (keeping 8vw)
- **NOT** modifying the ContactDialog component
- **NOT** adding new breakpoints beyond the existing `md:` pattern
- **NOT** changing footer layout
- **NOT** adding JavaScript-based responsive logic

## Implementation Approach

Single-phase implementation modifying only `apps/www/src/routes/index.tsx`. Changes are minimal and follow existing codebase patterns.

## Phase 1: Implement Responsive Grid Collapse

### Overview
Convert the fixed 3-column grid to a responsive layout that stacks on mobile and expands to 3 columns on desktop.

### Changes Required:

#### 1. Main Grid Container
**File**: `apps/www/src/routes/index.tsx`
**Line**: 44

**Current**:
```tsx
<div className="grid grid-cols-3 gap-8 md:gap-12">
```

**New**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
```

#### 2. Left Column (Bio) - Adjust Column Span
**File**: `apps/www/src/routes/index.tsx`
**Line**: 46

**Current**:
```tsx
<div className="col-span-1 space-y-6">
```

**New** (no change needed - `col-span-1` works for both layouts):
```tsx
<div className="col-span-1 space-y-6">
```

#### 3. Middle Spacer Column - Hide on Mobile
**File**: `apps/www/src/routes/index.tsx`
**Line**: 75

**Current**:
```tsx
<div className="col-span-1" />
```

**New**:
```tsx
<div className="hidden md:block col-span-1" />
```

#### 4. Right Column (Social Links) - Adjust Column Span
**File**: `apps/www/src/routes/index.tsx`
**Line**: 78

**Current**:
```tsx
<div className="col-span-1 space-y-6">
```

**New** (no change needed - `col-span-1` works for both layouts):
```tsx
<div className="col-span-1 space-y-6">
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript type checking passes: `pnpm typecheck`
- [ ] ESLint passes: `pnpm lint` (pre-existing errors in other files, not in index.tsx)
- [x] Build succeeds: `pnpm build:www`
- [ ] Dev server starts: `pnpm dev:www`

#### Manual Verification:
- [ ] At 375px width: Bio text appears first, social links stacked below, no horizontal scroll
- [ ] At 768px width: 3-column layout appears, bio on left, social links on right
- [ ] At 1440px width: Layout looks correct with proper spacing
- [ ] Contact button remains accessible and visible on all viewports
- [ ] Decorative "JEEVAN PILLAY" text displays correctly on all viewports

---

## Testing Strategy

### Visual Testing:
1. Open Chrome DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at these widths: 320px, 375px, 414px, 768px, 1024px, 1440px
4. Verify layout transitions correctly at 768px breakpoint

### Manual Testing Steps:
1. Load homepage at mobile width (375px)
2. Verify bio content is readable and full-width
3. Scroll down to verify social links appear below bio
4. Resize to 768px and verify 3-column layout appears
5. Resize to desktop and verify spacing increases appropriately
6. Click "Contact me" button to verify dialog still works

## Performance Considerations

No performance impact expected - only CSS class changes, no JavaScript logic added.

## References

- Research document: `thoughts/shared/research/2026-01-31-index-page-responsiveness.md`
- Pattern reference: `apps/www/src/components/contact-dialog.tsx:105`
- Mobile hook (for reference): `packages/ui/src/hooks/use-mobile.tsx:3`
