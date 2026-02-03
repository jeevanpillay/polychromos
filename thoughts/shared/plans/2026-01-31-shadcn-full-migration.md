# shadcn/ui Full Migration to Latest - End-to-End Implementation Plan

## Overview

Complete migration of all 34 shadcn/ui components to the latest version, including:
- Updating all components to latest with new-york style
- Migrating deprecated components (toast → sonner)
- Updating all dependencies (@radix-ui/*, cmdk, lucide-react, recharts, etc.)
- Fixing components.json to reflect actual Tailwind v4 setup
- Re-applying custom modifications (Input ghost variant, Form useForm wrapper, Toast limits)
- Full testing and validation

## Current State Analysis

### Component Status
- **34 components installed** in `packages/ui/src/components/ui/`
- **Style**: deprecated "default" (need to migrate to "new-york")
- **Config mismatch**: `components.json` references `tailwind.config.ts` which doesn't exist (using Tailwind v4 CSS-based config)
- **React 19 compatible** - components will need `forwardRef` removal
- **Custom modifications** in 5 files that will be lost during upgrade

### Custom Modifications (Must Preserve)

#### 1. Input Component (packages/ui/src/components/ui/input.tsx:7-22)
- Custom "ghost" variant with `hover:bg-accent/50 border-none bg-transparent px-3 py-2`
- CVA setup with default and ghost variants
- Must be re-applied after update

#### 2. Form Component (packages/ui/src/components/ui/form.tsx:25-41)
- Custom `useForm` wrapper with automatic Zod resolver
- Accepts `schema` prop of type `ZodType<TOut, TDef, TIn>`
- Re-exports `useFieldArray` at line 206
- Must be re-applied after update

#### 3. Toast Hook (packages/ui/src/hooks/use-toast.tsx:8-9)
- `TOAST_LIMIT = 1` (only one toast at a time)
- `TOAST_REMOVE_DELAY = 1000000` (1000 seconds)
- Custom reducer with ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST, REMOVE_TOAST
- Must be re-applied after update

#### 4. Global Styles (packages/ui/src/globals.css)
- Custom theme variables (OKLCH colors, custom chart colors, sidebar colors)
- Custom animations (accordion animations)
- Custom prose utility for typography
- Brand color variable `--color-brand-blue`
- Extensive customization - preserve during upgrade

#### 5. Custom Hooks & Components (Not shadcn, preserve as-is)
- `packages/ui/src/hooks/use-mobile.tsx`
- `packages/ui/src/hooks/use-mounted.ts`
- `packages/ui/src/hooks/use-theme.tsx`
- `packages/ui/src/components/icons.tsx`
- `packages/ui/src/lib/fonts.ts`

## Desired End State

After this migration:
- All 34 components updated to latest shadcn/ui version
- Style migrated from "default" to "new-york"
- Deprecated toast component replaced with sonner
- All dependencies updated to latest versions (@radix-ui/*, cmdk, lucide-react, recharts, tailwind-merge, class-variance-authority, zod, react-hook-form)
- Custom modifications re-applied and functional
- components.json corrected to match actual Tailwind v4 setup
- All custom utilities, hooks, and global styles preserved
- Project builds successfully with no type errors
- All tests pass (if any exist)

## What We're NOT Doing

- Migrating to Tailwind v4 class syntax (keeping current CSS-based config)
- Converting to React Server Components (already enabled, staying as-is)
- Adding new components beyond what's currently installed
- Refactoring component internals beyond necessary updates
- Migrating the entire color system away from OKLCH (keeping current color system)

## Implementation Approach

**Strategy**: Systematic, incremental upgrade with custom modification preservation

1. **Backup custom code** - Extract and document all customizations before updating
2. **Fix components.json** - Update tailwind.config reference
3. **Update all components** - Use loop to update all 34 components with `-o` flag
4. **Update dependencies** - Bump all @radix-ui/*, cmdk, lucide-react, recharts, and related packages
5. **Migrate toast system** - Replace toast with sonner component
6. **Re-apply customizations** - Restore Input ghost variant, Form wrapper, Toast limits
7. **Verify and test** - Build, typecheck, lint, and manual testing
8. **Commit changes** - Create clean commit with migration details

---

## Phase 1: Preparation & Backup

### Overview
Back up custom code, document the current state, and prepare for migration.

### Changes Required:

#### 1. Create Backup Directory
**Action**: Save current custom modifications before any changes

Create `/Users/jeevanpillay/Code/@jeevanpillaystudios/x/packages/ui/.backup` directory with:
- Copy `src/components/ui/input.tsx` → `.backup/input.tsx.backup`
- Copy `src/components/ui/form.tsx` → `.backup/form.tsx.backup`
- Copy `src/hooks/use-toast.tsx` → `.backup/use-toast.tsx.backup`
- Copy `src/globals.css` → `.backup/globals.css.backup`

#### 2. Document Custom Modifications
**Action**: Create a documentation file of all changes that need re-application

**File**: `packages/ui/.backup/CUSTOMIZATIONS.md`

```markdown
# Custom Modifications to Preserve

## Input Component
- Location: src/components/ui/input.tsx
- Custom variant: "ghost"
- Classes: hover:bg-accent/50 border-none bg-transparent px-3 py-2 focus:outline-none focus-visible:outline-none
- Line: 14-15

## Form Component
- Location: src/components/ui/form.tsx
- Custom useForm wrapper (lines 25-41): Auto-applies zodResolver
- Re-exports useFieldArray (line 206)

## Toast Hook
- Location: src/hooks/use-toast.tsx
- TOAST_LIMIT = 1
- TOAST_REMOVE_DELAY = 1000000

## Global Styles
- Location: src/globals.css
- Custom theme variables (OKLCH colors)
- Custom animations
- Custom prose utility
- Brand color variable: --color-brand-blue
```

### Success Criteria:

#### Automated Verification:
- [ ] Backup directory created: `.backup/` exists with 3 .tsx files
- [ ] Backup files match originals (can verify with `diff`)

#### Manual Verification:
- [ ] Customizations documented in `CLAUDE_CUSTOMIZATIONS.md`
- [ ] All 3 custom components backed up successfully

---

## Phase 2: Configuration Updates

### Overview
Fix components.json configuration to match actual Tailwind v4 setup and update version references.

### Changes Required:

#### 1. Update components.json
**File**: `packages/ui/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "src/globals.css",
    "css": "src/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@polychromos/ui/components",
    "ui": "@polychromos/ui/components/ui",
    "utils": "@polychromos/ui/lib/utils",
    "lib": "@polychromos/ui/lib",
    "hooks": "@polychromos/ui/hooks"
  }
}
```

**Changes**:
- Line 3: `"style": "default"` → `"style": "new-york"` (migrate to new style)
- Line 7: `"config": "tailwind.config.ts"` → `"config": "src/globals.css"` (reflect actual Tailwind v4 setup)

### Success Criteria:

#### Automated Verification:
- [ ] components.json parses as valid JSON: `cat components.json | jq . > /dev/null`
- [ ] Style changed to "new-york": `grep "new-york" components.json`

#### Manual Verification:
- [ ] Configuration no longer references non-existent `tailwind.config.ts`
- [ ] Style reflects new-york (components will have updated appearance after full migration)

---

## Phase 3: Component Updates

### Overview
Update all 34 shadcn/ui components to latest version with new-york style.

### Changes Required:

#### 1. Run Component Update Loop
**Action**: Navigate to packages/ui and run update commands for all components

```bash
cd packages/ui

# List components to update (verify against our 34)
echo "Components to update:"
ls src/components/ui/*.tsx | xargs -n1 basename | sed 's/.tsx$//' | sort

# Update each component with -o (overwrite) flag
# This will re-download and overwrite all component files
for file in src/components/ui/*.tsx; do
  component=$(basename "$file" .tsx)
  echo "Updating: $component"
  pnpm dlx shadcn@latest add -y -o "$component"
done
```

**Components being updated**:
accordion, alert, aspect-ratio, avatar, badge, breadcrumb, button, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, form, input, label, popover, resizable, scroll-area, separator, sheet, sidebar, skeleton, slider, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

**Note**: The `form.tsx` and `input.tsx` will be overwritten. Custom modifications will be re-applied in Phase 4.

### Success Criteria:

#### Automated Verification:
- [ ] All 34 components updated: `ls src/components/ui/*.tsx | wc -l` should return 34
- [ ] No syntax errors in components: `cd ../.. && pnpm typecheck`
- [ ] ESLint passes: `pnpm lint`

#### Manual Verification:
- [ ] All component files contain new-york style classes
- [ ] No compilation errors when building
- [ ] forwardRef syntax updated (React 19 compatible)

---

## Phase 4: Dependency Updates

### Overview
Update all @radix-ui/*, cmdk, lucide-react, recharts, and related packages to latest versions.

### Changes Required:

#### 1. Update Core Dependencies
**File**: `packages/ui/package.json` (via pnpm command)

```bash
cd packages/ui

# Update all @radix-ui packages
pnpm up "@radix-ui/*" --latest

# Update other core dependencies
pnpm up \
  "cmdk@latest" \
  "lucide-react@latest" \
  "recharts@latest" \
  "tailwind-merge@latest" \
  "class-variance-authority@latest" \
  "zod@latest" \
  "react-hook-form@latest" \
  "embla-carousel-react@latest" \
  "react-resizable-panels@latest" \
  "next-themes@latest" \
  "vaul@latest" \
  "@hookform/resolvers@latest"

# Update Radix dialog (required for some components)
pnpm up "@radix-ui/react-dialog@latest"
```

#### 2. Update Dev Dependencies
```bash
cd packages/ui

# Update Tailwind and TypeScript tooling
pnpm up -D "tailwindcss@latest" "typescript@latest"
```

### Success Criteria:

#### Automated Verification:
- [ ] All dependencies installed: `pnpm install`
- [ ] No peer dependency warnings: `pnpm install` completes without warnings
- [ ] Lockfile updated: `pnpm-lock.yaml` changes verified
- [ ] TypeScript compilation succeeds: `pnpm typecheck`

#### Manual Verification:
- [ ] All @radix-ui packages are at same version or compatible
- [ ] No breaking dependency conflicts
- [ ] Package.json reflects latest versions

---

## Phase 5: Toast System Migration

### Overview
Replace deprecated `toast` component with `sonner` package for notification system.

### Changes Required:

#### 1. Add Sonner Package
```bash
cd packages/ui
pnpm add sonner
```

#### 2. Add Sonner Component via shadcn
```bash
cd packages/ui
pnpm dlx shadcn@latest add sonner -o
```

This will create `src/components/ui/sonner.tsx` with the Sonner integration component.

#### 3. Update Global Styles (if needed)
**File**: `packages/ui/src/globals.css`

Add Sonner CSS import if not already present (shadcn will add it):
```css
@import "sonner/dist/styles.css";
```

#### 4. Keep Old Toast System
**Action**: Keep `src/components/ui/toast.tsx` and `src/components/ui/toaster.tsx` for backward compatibility if needed, or remove if fully migrating to sonner.

**Decision**: For this migration, we'll **keep both systems**:
- Old: `toast.tsx`, `toaster.tsx`, `use-toast.tsx` (existing code can continue using it)
- New: `sonner.tsx` (available for new code to use)

This allows gradual migration without breaking existing code.

### Success Criteria:

#### Automated Verification:
- [ ] Sonner installed: `grep "sonner" package.json`
- [ ] Sonner component created: `src/components/ui/sonner.tsx` exists
- [ ] Imports resolve: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Old toast system still works
- [ ] Sonner component available for import
- [ ] No type errors in sonner integration

---

## Phase 6: Re-Apply Custom Modifications

### Overview
Restore the custom modifications that were overwritten during component updates.

### Changes Required:

#### 1. Restore Input Ghost Variant
**File**: `packages/ui/src/components/ui/input.tsx`

After the `inputVariants` CVA definition (around line 7), the default variant should exist. Add the ghost variant:

```typescript
const inputVariants = cva(
  "ring-offset-background placeholder:text-muted-foreground flex h-10 w-full rounded-md text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input bg-background focus-visible:ring-ring border px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        ghost:
          "hover:bg-accent/50 border-none bg-transparent px-3 py-2 focus:outline-none focus-visible:outline-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
```

Update the `InputProps` interface to include variant:
```typescript
export interface InputProps
  extends
    React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}
```

Update the Input component to accept and use the variant:
```typescript
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
```

#### 2. Restore Form useForm Wrapper
**File**: `packages/ui/src/components/ui/form.tsx`

After the imports and before the Form component definition, add the custom useForm wrapper:

```typescript
const useForm = <
  TOut extends FieldValues,
  TDef extends ZodTypeDef,
  TIn extends FieldValues,
>(
  props: Omit<UseFormProps<TIn>, "resolver"> & {
    schema: ZodType<TOut, TDef, TIn>;
  },
) => {
  const form = __useForm<TIn, unknown, TOut>({
    ...props,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(props.schema as any, undefined),
  });

  return form;
};
```

Add to the exports at the bottom:
```typescript
export { useFieldArray } from "react-hook-form";
```

Update the main export to use the custom useForm:
```typescript
// Keep all other exports, but ensure useForm is the custom one
export { useForm, useFormField, /* ... rest of exports ... */ };
```

#### 3. Restore Toast Limits and Delays
**File**: `packages/ui/src/hooks/use-toast.tsx`

At the top of the file (around line 8-9), ensure these values are set:

```typescript
const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;
```

These control:
- `TOAST_LIMIT = 1`: Only one toast visible at a time
- `TOAST_REMOVE_DELAY = 1000000`: Very long delay (1000 seconds) before removing dismissed toast

### Success Criteria:

#### Automated Verification:
- [ ] Input component has ghost variant: `grep "ghost" src/components/ui/input.tsx`
- [ ] Form has useForm wrapper: `grep "useForm" src/components/ui/form.tsx` shows custom implementation
- [ ] useFieldArray exported: `grep "useFieldArray" src/components/ui/form.tsx`
- [ ] Toast limits set: `grep "TOAST_LIMIT = 1" src/hooks/use-toast.tsx`
- [ ] TypeScript compilation succeeds: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Input component can be imported with ghost variant
- [ ] Form component's useForm wrapper works with Zod schemas
- [ ] Toast system limits toasts to 1 at a time
- [ ] All custom functionality is preserved

---

## Phase 7: Global Styles Verification

### Overview
Verify that custom global styles (theme colors, animations, prose utilities) are preserved.

### Changes Required:

#### 1. Verify globals.css
**File**: `packages/ui/src/globals.css`

Verify the following custom elements are still present:
- Line 2: `@import "tw-animate-css"` (animation plugin)
- Line 7: `@plugin '@tailwindcss/typography'` (typography plugin)
- Lines 11-71: `@theme inline` with custom font, radius, color, and animation definitions
- Lines 92-93: Custom `--input-bg` variable
- Lines 143-177: Custom prose utility for typography
- Sidebar color variables (lines 42-49)
- Brand color: `--color-brand-blue` (line 50)

**If missing**: Check the backup file at `.backup/globals.css.backup` and restore from there.

### Success Criteria:

#### Automated Verification:
- [ ] globals.css contains all custom variables: `grep "color-brand-blue" src/globals.css`
- [ ] Typography plugin imported: `grep "@tailwindcss/typography" src/globals.css`
- [ ] No syntax errors: `pnpm build:www` (from root)

#### Manual Verification:
- [ ] Custom theme colors visible in component previews
- [ ] Sidebar colors correct
- [ ] Animations work properly
- [ ] Typography styling preserved

---

## Phase 8: Build & Type Check

### Overview
Verify entire build system works with updated components.

### Changes Required:

#### 1. Root Level Build
**Action**: Run from root directory

```bash
cd /Users/jeevanpillay/Code/@jeevanpillaystudios/x

# Install dependencies
pnpm install

# Type check entire project
pnpm typecheck

# Run linter
pnpm lint

# Build all apps
pnpm build:www

# Check for any remaining errors
pnpm build
```

#### 2. UI Package Specific Checks
```bash
cd packages/ui

# Check UI package specifically
pnpm typecheck
pnpm lint
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` completes without errors: `pnpm install --frozen-lockfile`
- [ ] `pnpm typecheck` returns no errors (exit code 0)
- [ ] `pnpm lint` returns no errors (exit code 0)
- [ ] `pnpm build:www` builds successfully (no errors in output)
- [ ] `pnpm build` completes without errors

#### Manual Verification:
- [ ] No console errors or warnings in build output
- [ ] Build artifacts generated correctly
- [ ] All imports resolve correctly
- [ ] Component types are correct

---

## Phase 9: Testing & Validation

### Overview
Manually test the updated components to ensure functionality is preserved.

### Changes Required:

#### 1. Dev Server Startup
```bash
cd /Users/jeevanpillay/Code/@jeevanpillaystudios/x

# Start dev server
pnpm dev
```

This will start all dev servers including `pnpm dev:www` for the main app.

#### 2. Manual Testing Checklist

Test these core functionalities:

**Form Components**:
- [ ] Form fields render correctly with new-york style
- [ ] Custom `useForm` hook works with Zod schemas
- [ ] Form validation displays errors properly
- [ ] Input ghost variant works (if used in app)

**Layout Components**:
- [ ] Sidebar renders with updated styles
- [ ] Tabs component works correctly
- [ ] Dialog/Modal opens and closes
- [ ] Drawer slides in/out smoothly

**Data Display**:
- [ ] Charts render correctly (Recharts)
- [ ] Tables display data properly
- [ ] Command palette (cmdk) works if implemented
- [ ] Breadcrumb navigation works

**Notifications**:
- [ ] Toast notifications appear and disappear
- [ ] Only one toast visible at a time (due to TOAST_LIMIT = 1)
- [ ] Toast dismiss works

**Visual**:
- [ ] new-york style applied throughout
- [ ] Dark/light mode toggle works (if implemented)
- [ ] Colors match design system
- [ ] Animations smooth (accordion, transitions, etc.)

**Edge Cases**:
- [ ] Mobile responsive design works (viewport < 768px)
- [ ] Touch interactions work on mobile
- [ ] Keyboard navigation works (tabs, modals, etc.)
- [ ] No console errors during interaction

### Success Criteria:

#### Automated Verification:
- [ ] Dev server starts without errors: `pnpm dev` runs
- [ ] No console errors when app loads
- [ ] All TypeScript types correct (no type errors in browser DevTools)

#### Manual Verification:
- [ ] All 10+ manual test items above pass
- [ ] App is responsive and performant
- [ ] No visual regressions
- [ ] All custom modifications work (Input ghost, Form useForm, Toast limits)
- [ ] Components look good with new-york style

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the manual testing was successful before proceeding to the final commit.

---

## Phase 10: Cleanup & Commit

### Overview
Clean up backup files and commit migration to git.

### Changes Required:

#### 1. Remove Backup Directory
```bash
cd packages/ui
rm -rf .backup
```

#### 2. Verify Git Status
```bash
cd /Users/jeevanpillay/Code/@jeevanpillaystudios/x
git status
```

Expected changes:
- Modified: `packages/ui/components.json` (style and tailwind config)
- Modified: `packages/ui/package.json` and `pnpm-lock.yaml` (dependency updates)
- Modified: `packages/ui/src/components/ui/*.tsx` (all 34 components)
- Modified: `packages/ui/src/hooks/use-toast.tsx` (custom limits)
- New: `packages/ui/src/components/ui/sonner.tsx` (sonner component)
- All other custom files unchanged

#### 3. Commit Changes
```bash
git add packages/ui/
git commit -m "chore: migrate shadcn/ui to latest (new-york style)

- Update all 34 components to latest version
- Migrate from deprecated 'default' style to 'new-york'
- Update all @radix-ui packages to latest
- Update cmdk, lucide-react, recharts, and dependencies
- Add sonner component (keep old toast system for backward compatibility)
- Fix components.json to reflect Tailwind v4 CSS-based config
- Preserve custom modifications (Input ghost variant, Form useForm wrapper, Toast limits)
- Preserve all custom hooks, utilities, and global styles"
```

### Success Criteria:

#### Automated Verification:
- [ ] `.backup` directory removed: `ls packages/ui/.backup` returns not found
- [ ] Git commit created: `git log --oneline -1` shows migration commit
- [ ] All changes staged and committed: `git status` shows clean working tree

#### Manual Verification:
- [ ] Commit message is clear and descriptive
- [ ] No sensitive files committed
- [ ] Migration can be rolled back if needed: `git revert [commit-hash]`

---

## Testing Strategy

### Unit Tests
- If project has component tests, verify they still pass
- Custom modifications (Input ghost, Form useForm, Toast limits) should pass their tests

### Integration Tests
- Form submission with validation
- Toast notifications in real workflows
- Component interactions (dialogs, modals, dropdowns)
- Responsive behavior on mobile viewport

### Manual Testing Steps
1. Start dev server: `pnpm dev`
2. Navigate through all pages/routes
3. Test forms with validation
4. Trigger toast notifications
5. Test responsive design (resize to mobile)
6. Check dark mode toggle
7. Verify no console errors

## Performance Considerations

- Component update may slightly change bundle size (new-york style may have different tailwind class output)
- Sonner package adds ~15KB to bundle (can be tree-shaken if not used)
- Old toast system preserved for backward compatibility (add to bundle size)
- Consider removing old toast system after migration if not needed

## Migration Notes

### Breaking Changes to Watch For

From February 2025 update:
- `forwardRef` syntax updated (React 19 compatible)
- Toast component deprecated (sonner as replacement)
- Default style deprecated (new-york is new standard)
- Color format potentially moving from HSL to OKLCH (check your globals.css)

### Custom Modifications Preserved

1. **Input ghost variant** - Preserved in Phase 6
2. **Form useForm wrapper** - Preserved in Phase 6
3. **Toast limits** - Preserved in Phase 6
4. **Global styles** - Already preserved (not overwritten)
5. **Custom hooks** - Not affected by shadcn update

### Backward Compatibility

- Old toast system kept alongside sonner (gradual migration possible)
- All existing component imports continue to work
- Custom exports preserved
- No breaking changes to public API

## References

- Research document: `thoughts/shared/research/2026-01-31-web-analysis-shadcn-upgrade-components.md`
- shadcn/ui CLI: `https://ui.shadcn.com/docs/cli`
- shadcn/ui new-york style: `https://ui.shadcn.com/docs/new-york`
- Sonner docs: `https://sonner.emilkowal.ski/`
- Custom modifications backup: `packages/ui/.backup/CUSTOMIZATIONS.md`

---

**Last Updated**: 2026-01-31
**Scope**: Full end-to-end migration to latest shadcn/ui with all dependencies updated
**Risk Level**: Medium (lots of changes, but well-tested components and clear rollback path with git)
**Estimated Components Affected**: 34 (all installed components)
**Custom Code Preserved**: Yes (5 custom modifications re-applied in Phase 6)
