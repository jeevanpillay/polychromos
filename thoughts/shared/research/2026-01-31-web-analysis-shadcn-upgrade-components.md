---
date: 2026-01-31T12:00:00+08:00
researcher: claude-opus-4-5
topic: "How to upgrade all existing shadcn components to latest in codebase"
tags: [research, web-analysis, shadcn, ui-components, upgrade, maintenance]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 12
---

# Web Research: Upgrading shadcn/ui Components to Latest

**Date**: 2026-01-31
**Topic**: How to upgrade all existing shadcn components to latest in codebase
**Confidence**: High - Based on official documentation and verified community solutions

## Research Question
How to upgrade all existing shadcn/ui components to the latest version in a monorepo codebase?

## Executive Summary

shadcn/ui uses a **copy-paste architecture** where components are copied into your codebase rather than imported from npm. This means **there's no automatic update mechanism** like `npm update`. The primary methods for upgrading are:

1. **`npx shadcn@latest diff`** - Check which components have updates (experimental)
2. **`npx shadcn@latest add [component] -o`** - Re-add components with overwrite flag
3. **Loop through existing components** - Update only installed components without adding new ones

For your specific project (34 components in `packages/ui/`), the recommended approach is to use a loop script to update only your installed components while preserving your monorepo structure.

## Key Metrics & Findings

### CLI Commands Available

**Finding**: There is no dedicated `update` command - the `add` command with `--overwrite` flag is the official method.
**Sources**: [shadcn/ui CLI Documentation](https://ui.shadcn.com/docs/cli)

| Command | Purpose | Notes |
|---------|---------|-------|
| `npx shadcn@latest diff` | Preview changes | Experimental, may have false positives |
| `npx shadcn@latest add [component] -o` | Update single component | Overwrites existing file |
| `npx shadcn@latest add -a -y -o` | Add ALL components | ⚠️ Adds ALL, not just existing ones |

### Your Current Setup

**Finding**: You have 34 shadcn components installed using the `default` style with Tailwind v3 configuration.
**Analysis**: The `default` style is deprecated in favor of `new-york`. Consider migrating during the upgrade.

| Aspect | Current Value | Latest Recommendation |
|--------|---------------|----------------------|
| Style | `default` | `new-york` (recommended) |
| Tailwind Config | `tailwind.config.ts` | CSS-based (Tailwind v4) |
| Color Format | CSS Variables (HSL) | OKLCH (better color accuracy) |
| React Version | React 18 | React 19 compatible |

### Installed Components (34 total)

Your components: accordion, alert, aspect-ratio, avatar, badge, breadcrumb, button, card, carousel, chart, checkbox, collapsible, command, dialog, drawer, dropdown-menu, form, input, label, popover, resizable, scroll-area, separator, sheet, sidebar, skeleton, slider, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

## Trade-off Analysis

### Option 1: Bulk Update All (Fastest, Riskiest)
```bash
cd packages/ui
pnpm dlx shadcn@latest add -a -y -o
```

| Factor | Impact | Notes |
|--------|--------|-------|
| Speed | ⚡ Very Fast | Single command |
| Risk | ⚠️ High | Adds ALL available components (60+), not just your 34 |
| Customizations | ❌ Lost | Completely overwrites all files |
| New Components | ✅ Added | Gets new components you didn't have |

### Option 2: Loop Update Existing Only (Recommended)
```bash
cd packages/ui
for file in src/components/ui/*.tsx; do
  pnpm dlx shadcn@latest add -y -o $(basename "$file" .tsx)
done
```

| Factor | Impact | Notes |
|--------|--------|-------|
| Speed | ⏱️ Moderate | ~34 individual add commands |
| Risk | 🟡 Medium | Only updates existing components |
| Customizations | ❌ Lost | Still overwrites customizations |
| New Components | ❌ Not Added | Only updates what you have |

### Option 3: Selective Manual Update (Safest)
```bash
cd packages/ui
pnpm dlx shadcn@latest diff  # Review changes first
pnpm dlx shadcn@latest add button -o  # Update one at a time
```

| Factor | Impact | Notes |
|--------|--------|-------|
| Speed | 🐌 Slow | Manual review per component |
| Risk | ✅ Low | Full control over each update |
| Customizations | ✅ Preserved | Can manually merge changes |
| New Components | ⚙️ Optional | Add only what you want |

## Recommendations

Based on your monorepo setup with `packages/ui/`:

### 1. **Backup First** (Critical)
```bash
git add -A
git commit -m "chore: backup before shadcn component update"
```

### 2. **Check What Changed** (Experimental)
```bash
cd packages/ui
pnpm dlx shadcn@latest diff
```

### 3. **Update All Existing Components** (Recommended Command)
```bash
cd packages/ui
for file in src/components/ui/*.tsx; do
  pnpm dlx shadcn@latest add -y -o $(basename "$file" .tsx)
done
```

### 4. **Update Dependencies**
```bash
pnpm up "@radix-ui/*" cmdk lucide-react recharts tailwind-merge clsx class-variance-authority --latest
```

### 5. **Test Build**
```bash
cd ../..
pnpm build:www
pnpm typecheck
```

### 6. **Review and Commit**
```bash
git diff  # Review all changes
git add -p  # Stage selectively if needed
git commit -m "chore: update shadcn components to latest"
```

## Breaking Changes to Watch For

### February 2025 - Major Update

| Change | Impact | Migration |
|--------|--------|-----------|
| `forwardRef` removed | React 19 | Components become standard functions |
| `toast` deprecated | Medium | Migrate to `sonner` component |
| `default` style deprecated | Low | `new-york` is new default |
| HSL → OKLCH colors | Low | Better color accuracy |
| `tailwindcss-animate` deprecated | Medium | Use `tw-animate-css` instead |
| `data-slot` attributes added | Low | No action needed |

### January 2026 - RTL Support

| Change | Impact | Migration |
|--------|--------|-----------|
| Physical → Logical CSS | Optional | Run `npx shadcn@latest migrate rtl` |

## Component-Specific Notes

### Toast Component (Deprecated)
The `toast` component you have is deprecated. Consider migrating to `sonner`:
```bash
cd packages/ui
pnpm dlx shadcn@latest add sonner -o
# Then update imports from toast to sonner
```

### Toaster Component
The `toaster` component wraps toast functionality. After migrating to sonner, you may want to remove the old toaster.

## Risk Assessment

### High Priority
- **Customization Loss**: All custom modifications will be overwritten - backup critical customizations first
- **Breaking Import Paths**: Verify `@repo/ui/components/ui/*` exports still work after update

### Medium Priority
- **Style Deprecation**: `default` style is deprecated; consider migrating to `new-york`
- **Toast Deprecation**: `toast` component deprecated in favor of `sonner`

### Low Priority
- **Color Format Change**: HSL to OKLCH is mostly transparent but check custom colors
- **Animation Plugin**: May need to update from `tailwindcss-animate` to `tw-animate-css`

## Open Questions

- **Tailwind v4 Migration**: Are you planning to migrate to Tailwind v4? This would require additional steps.
- **React 19 Migration**: If upgrading to React 19, components will use standard functions instead of forwardRef.
- **Custom Modifications**: Do you have custom modifications to any components that need preserving?

## Complete Upgrade Script

Here's a complete script for your project:

```bash
#!/bin/bash

# Navigate to UI package
cd packages/ui

# List current components
echo "Current components:"
ls src/components/ui/*.tsx | xargs -n1 basename | sed 's/.tsx$//'

# Run diff to see what changed (experimental)
echo -e "\nChecking for updates..."
pnpm dlx shadcn@latest diff

# Update all existing components
echo -e "\nUpdating components..."
for file in src/components/ui/*.tsx; do
  component=$(basename "$file" .tsx)
  echo "Updating: $component"
  pnpm dlx shadcn@latest add -y -o "$component"
done

# Update related dependencies
echo -e "\nUpdating dependencies..."
pnpm up "@radix-ui/*" cmdk lucide-react recharts tailwind-merge clsx class-variance-authority --latest

# Return to root
cd ../..

# Build and type check
echo -e "\nBuilding..."
pnpm build:www
pnpm typecheck

echo -e "\nUpdate complete! Review changes with: git diff"
```

## Sources

### Official Documentation
- [shadcn/ui CLI Documentation](https://ui.shadcn.com/docs/cli) - Anthropic/shadcn, 2026
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog) - Anthropic/shadcn, 2026
- [Tailwind v4 Migration Guide](https://ui.shadcn.com/docs/tailwind-v4) - Anthropic/shadcn, 2025

### Best Practices
- [Vercel Academy - Updating and Maintaining Components](https://vercel.com/academy/shadcn-ui/updating-and-maintaining-components) - Vercel, 2025

### Community Solutions
- [GitHub Discussion #790 - Need easy way to update components](https://github.com/shadcn-ui/ui/discussions/790) - Community, 2024-2026
- [Cordobo - TIL: Update all shadcn UI components](https://cordobo.com/2760-til-update-all-shadcn-ui-components/) - Cordobo, 2025

### Technical Issues
- [GitHub Issue #2619 - diff command discussion](https://github.com/shadcn-ui/ui/issues/2619) - Community, 2024
- [GitHub Issue #1202 - diff command false positives](https://github.com/shadcn-ui/ui/issues/1202) - Community, 2024
- [GitHub Issue #5427 - diff command bugs](https://github.com/shadcn-ui/ui/issues/5427) - Community, 2025
- [GitHub Issue #6585 - Tailwind v4 and React 19](https://github.com/shadcn-ui/ui/issues/6585) - Community, 2025

### Source Code
- [GitHub - diff command source code](https://github.com/shadcn-ui/ui/blob/main/packages/cli/src/commands/diff.ts) - shadcn-ui, 2025
- [GitHub Releases - shadcn-ui/ui](https://github.com/shadcn-ui/ui/releases) - shadcn-ui, 2026

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Based on official documentation and verified community patterns
**Next Steps**: Run the upgrade commands from `packages/ui/` directory, then test build and typecheck
