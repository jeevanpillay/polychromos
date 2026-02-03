---
date: 2026-02-02T17:37:00+11:00
researcher: Claude
git_commit: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos App Restructure - Rename and Create WWW App"
tags: [research, codebase, polychromos, tanstack-start, restructure]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Polychromos App Restructure

**Date**: 2026-02-02T17:37:00+11:00
**Researcher**: Claude
**Git Commit**: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
**Branch**: feat/polychromos-mvp-implementation
**Repository**: x

## Research Question

Rename apps/polychromos to apps/polychromos-app and create new base TanStack app (modelled after apps/www) with clean index.ts landing page called apps/polychromos-www. Maintain all fonts and styling from apps/www.

## Summary

Successfully completed the restructure:

1. **Renamed** `apps/polychromos` → `apps/polychromos-app`
   - Updated package.json name from `@repo/polychromos` to `@repo/polychromos-app`
   - All existing functionality preserved

2. **Created** `apps/polychromos-www` - A new TanStack Start application
   - Modeled after `apps/www` structure
   - Includes all fonts (Geist, PP Neue Montreal, Joyride)
   - Clean landing page with "Polychromos" branding
   - Runs on port 3002

## Detailed Findings

### apps/polychromos-app (renamed from apps/polychromos)

The existing Polychromos application was renamed with the following change:

**File**: `apps/polychromos-app/package.json`
- Package name changed from `"@repo/polychromos"` to `"@repo/polychromos-app"`
- All other configuration remains unchanged
- Runs on port 3001
- Includes Convex backend integration

### apps/polychromos-www (new)

New TanStack Start application created with the following structure:

```
apps/polychromos-www/
├── package.json              # @repo/polychromos-www, port 3002
├── tsconfig.json             # TypeScript config with ~/* path alias
├── vite.config.ts            # Vite + TanStack Start plugins
├── turbo.json                # Turborepo task config
├── eslint.config.js          # ESLint setup
├── .gitignore                # Ignore .output, dist, etc.
├── .prettierignore           # Ignore generated files
├── public/
│   ├── favicon.svg           # "P" logo favicon
│   └── fonts/
│       ├── joyride/          # Joyride font files (8 files)
│       └── pp-neue-montreal/ # PP Neue Montreal fonts (6 files)
└── src/
    ├── router.tsx            # Router configuration
    ├── env.ts                # Environment validation
    ├── routeTree.gen.ts      # Auto-generated route tree
    ├── routes/
    │   ├── __root.tsx        # Root layout with fonts
    │   ├── index.tsx         # Clean landing page
    │   └── $.tsx             # 404 catch-all
    ├── styles/
    │   ├── app.css           # Tailwind + @repo/ui/globals.css
    │   └── fonts.css         # PP Neue Montreal font definitions
    └── components/
        ├── error-component.tsx
        ├── loading-component.tsx
        └── not-found-component.tsx
```

### Key Configuration Details

**package.json Dependencies:**
- `@fontsource/geist-mono` and `@fontsource/geist-sans` for Geist fonts
- `@repo/ui` for shared UI components
- `@tanstack/react-router` and `@tanstack/react-start` for routing/SSR
- `lucide-react` for icons
- React 19, Tailwind v4, TypeScript 5.9

**Vite Configuration:**
- Port 3002 (distinct from www:3000 and polychromos-app:3001)
- TanStack Start plugin for SSR
- Nitro for server
- Tailwind v4 CSS plugin
- Image optimizer

**Fonts Included:**
1. **Geist Sans/Mono** - NPM packages (system fonts)
2. **PP Neue Montreal** - Custom font with 6 weights (Thin, Book, Medium, Bold, Italic, SemiBold Italic)
3. **Joyride/JoyrideALT** - Custom display fonts (inherited from @repo/ui/globals.css)

### Landing Page Features

The index.tsx provides a clean starting point with:
- Header with "POLYCHROMOS" logo (Joyride font) and "Get Started" button
- Hero section with tagline "Code-Driven Design"
- Subtitle describing the platform
- Call-to-action buttons
- Footer with copyright

## Code References

- `apps/polychromos-app/package.json` - Renamed package name
- `apps/polychromos-www/package.json` - New app configuration
- `apps/polychromos-www/src/routes/__root.tsx` - Root layout with font imports
- `apps/polychromos-www/src/routes/index.tsx` - Clean landing page
- `apps/polychromos-www/src/styles/fonts.css` - PP Neue Montreal definitions
- `apps/polychromos-www/public/fonts/` - All font files

## Architecture Documentation

### Monorepo Integration

Both apps are now registered in the pnpm workspace:
- `apps/*` pattern in `pnpm-workspace.yaml` automatically includes both
- Turborepo recognizes both apps for parallel builds
- Shared dependencies via catalog in pnpm-workspace.yaml

### Port Allocation

| App | Port |
|-----|------|
| apps/www | 3000 |
| apps/polychromos-app | 3001 |
| apps/polychromos-www | 3002 |

### Shared Resources

Both polychromos apps share:
- `@repo/ui` - UI component library
- `packages/polychromos-types` - TypeScript types (polychromos-app only)
- Fonts via globals.css and local fonts.css

## Verification

- ✅ `pnpm install` - Dependencies resolved successfully
- ✅ `pnpm --filter=@repo/polychromos-app typecheck` - Passes
- ✅ `pnpm --filter=@repo/polychromos-www typecheck` - Passes
- ✅ `pnpm --filter=@repo/polychromos-www lint` - Passes
- ✅ `pnpm --filter=@repo/polychromos-www build` - Builds successfully

## Open Questions

None - implementation is complete.
