---
date: 2026-01-31T17:45:00+11:00
researcher: Claude
git_commit: ebe626e4837fab799e84e81c94e68b1d6593f3eb
branch: main
repository: x
topic: "Responsiveness Patterns in Homepage (index.tsx)"
tags: [research, codebase, responsive, tailwind, homepage]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Responsiveness Patterns in Homepage (index.tsx)

**Date**: 2026-01-31T17:45:00+11:00
**Researcher**: Claude
**Git Commit**: ebe626e4837fab799e84e81c94e68b1d6593f3eb
**Branch**: main
**Repository**: x

## Research Question
Document the current responsive implementation in `apps/www/src/routes/index.tsx` and existing responsive patterns in the codebase.

## Summary

The homepage (`index.tsx`) uses mobile-first responsive design with Tailwind CSS breakpoint utilities. The primary breakpoint used is `md:` (768px). Key findings:

1. **Fixed 3-column grid** that does NOT change columns across breakpoints - only gap spacing adjusts
2. **Spacing scales up** at `md:` breakpoint (padding, margins, gaps)
3. **Text sizes scale up** at `md:` breakpoint
4. **No column collapse to mobile** - the grid remains 3 columns on all screen sizes

This is different from the `ContactDialog` component which properly collapses from 3 columns to 1 column on mobile.

## Detailed Findings

### Current index.tsx Responsive Implementation

#### Fixed Elements
**Line 29-34** - Contact button:
```tsx
className="fixed top-8 right-8 md:top-12 md:right-12 z-40 text-sm font-medium hover:opacity-60 transition-opacity"
```
- Mobile: `top-8 right-8` (2rem)
- Desktop: `md:top-12 md:right-12` (3rem)

#### Main Container
**Line 40**:
```tsx
className="flex-1 flex flex-col pt-8 px-8 md:pt-12 md:px-12"
```
- Mobile: `pt-8 px-8` (2rem padding)
- Desktop: `md:pt-12 md:px-12` (3rem padding)

#### Grid Layout
**Line 42**:
```tsx
className="grid grid-cols-3 gap-8 md:gap-12"
```
- **Always 3 columns** - `grid-cols-3` with no responsive change
- Gap: `gap-8` (2rem) → `md:gap-12` (3rem)

#### Column Structure
**Lines 44, 73, 76**:
```tsx
<div className="col-span-1 space-y-6">  // Left column
<div className="col-span-1" />           // Middle spacer
<div className="col-span-1 space-y-6">  // Right column
```
- All columns are `col-span-1` with no responsive changes
- Each column takes 1/3 of the grid width on ALL screen sizes

#### Text Sizing
**Line 47**:
```tsx
className="text-base md:text-2xl font-pp-neue space-y-4"
```
- Mobile: `text-base` (1rem)
- Desktop: `md:text-2xl` (1.5rem)

#### Footer Sections
**Lines 114, 125**:
```tsx
className="-mx-8 md:-mx-12 px-8 md:px-12 pb-2"
className="-mx-8 md:-mx-12 px-8 md:px-12"
```
- Negative margin pattern to create full-width sections
- Mobile: `-mx-8 px-8` (2rem)
- Desktop: `md:-mx-12 md:px-12` (3rem)

### Comparison: ContactDialog Responsive Pattern

**File**: `apps/www/src/components/contact-dialog.tsx:79`
```tsx
className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-12 pt-10"
```
- Mobile: `grid-cols-1` (single column, stacked)
- Desktop: `md:grid-cols-3` (three-column layout)

**Line 94**:
```tsx
className="flex flex-col col-span-1 md:col-span-2"
```
- Mobile: `col-span-1` (full width in single column)
- Desktop: `md:col-span-2` (spans 2 of 3 columns)

### Codebase Responsive Conventions

#### Breakpoints Used
- **Primary**: `md:` (768px) - Most layout changes
- **Secondary**: `sm:` (640px) - Minor adjustments (text alignment, flex direction)
- **JavaScript**: `useIsMobile()` hook uses 768px breakpoint (matches `md:`)

#### Common Patterns Found

1. **Grid Column Changes**:
   - `grid-cols-1 md:grid-cols-3` (contact-dialog.tsx)
   - Used for mobile stacking → desktop multi-column

2. **Flex Direction Changes**:
   - `flex-col sm:flex-row` (error-component.tsx:27)
   - Vertical on mobile, horizontal on desktop

3. **Spacing Scaling**:
   - `gap-8 md:gap-12` (index.tsx:42)
   - `p-6 md:p-10` (contact-dialog.tsx:60)
   - `top-8 md:top-12` (index.tsx:31)

4. **Text Size Scaling**:
   - `text-base md:text-2xl` (index.tsx:47)
   - `text-3xl md:text-4xl` (contact-dialog.tsx:95)

5. **Text Alignment**:
   - `text-center sm:text-left` (dialog.tsx:69, sheet.tsx:84)

6. **Footer Pattern**:
   - `flex-col-reverse sm:flex-row` (dialog.tsx:83, sheet.tsx:98)

## Code References

- `apps/www/src/routes/index.tsx:42` - Fixed 3-column grid
- `apps/www/src/routes/index.tsx:31` - Responsive button positioning
- `apps/www/src/routes/index.tsx:47` - Responsive text sizing
- `apps/www/src/components/contact-dialog.tsx:79` - Example of responsive column collapse
- `packages/ui/src/components/ui/dialog.tsx:69` - DialogHeader text alignment
- `packages/ui/src/components/ui/dialog.tsx:83` - DialogFooter flex direction
- `packages/ui/src/hooks/use-mobile.tsx:3` - Mobile breakpoint constant (768px)

## Architecture Documentation

### Current State
The homepage uses a **fixed 3-column grid** that maintains its structure across all breakpoints. Only spacing and text sizes adjust responsively. This differs from the `ContactDialog` which properly collapses to a single column on mobile.

### Established Patterns
- Mobile-first approach using Tailwind breakpoint prefixes
- Primary breakpoint at `md:` (768px) for major layout changes
- Spacing typically doubles: 2rem → 3rem, 1.5rem → 2.5rem
- Text sizes scale by 1-2 steps at desktop

### Components with Responsive Grid Collapse
- `ContactDialog` - 1 col → 3 col
- `DialogFooter`/`SheetFooter` - column-reverse → row

### Components without Responsive Grid Collapse
- Homepage `index.tsx` - always 3 columns

## Open Questions

1. Should the homepage grid collapse to a single column on mobile for better readability?
2. Should the social links section move below the bio content on mobile?
3. What is the intended behavior for the decorative "JEEVAN PILLAY" text on mobile viewports?
