# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm dev:app          # Start polychromos-app (http://localhost:3001)
pnpm dev:www          # Start polychromos-www (http://localhost:3000)

# Build & Quality
pnpm build            # Build all applications
pnpm build:app        # Build app only
pnpm build:www        # Build www only
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint (all packages)
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting

# Testing
pnpm test             # Run unit tests
pnpm test:coverage    # Run tests with coverage

# UI Components
pnpm ui               # Add shadcn/ui components (runs in packages/ui)
```

## Architecture

**Monorepo with Turborepo + pnpm workspaces**

```
polychromos/
├── apps/
│   ├── polychromos-app/   # Main design app (TanStack Start + Convex + Clerk)
│   └── polychromos-www/   # Marketing website
├── packages/
│   ├── polychromos/       # CLI tool (published to npm)
│   ├── polychromos-types/ # Shared types (published to npm)
│   └── ui/                # Shared component library (@polychromos/ui)
└── internal/              # Shared configs (eslint, prettier, typescript)
```

**Stack**: TanStack Start, TanStack Router, React 19, Tailwind v4, TypeScript 5.9, Vite 7, Convex, Clerk

### Key Patterns

- **Routing**: TanStack Router with file-based routes. Route tree auto-generated to `routeTree.gen.ts`.
- **Styling**: Tailwind v4 uses CSS-based theme directives in `globals.css`.
- **Components**: shadcn/ui components in `packages/ui/src/components/ui/`. Import via `@polychromos/ui/components/ui/*`.
- **Backend**: Convex for real-time database. Functions in `apps/polychromos-app/convex/`.
- **Auth**: Clerk for authentication, integrated with Convex.

### Package Namespaces

- `@polychromos/app` - Main design application
- `@polychromos/www` - Marketing website
- `@polychromos/ui` - Shared UI components
- `@polychromos/types` - Shared TypeScript types
- `polychromos` - CLI tool (npm package)

## E2E Testing

### Prerequisites

Ensure `.vercel/.env.development.local` in `apps/polychromos-app/` contains:
- `E2E_CLERK_USER_EMAIL` - Test user email
- `E2E_CLERK_USER_PASSWORD` - Test user password
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key

### Running E2E Tests

```bash
# Run all E2E tests
pnpm --filter @polychromos/app test:e2e:all

# Run only browser tests
pnpm --filter @polychromos/app test:e2e:browser

# Run only CLI tests
pnpm --filter @polychromos/app test:e2e:cli
```

## Release Commands

```bash
# Create a changeset for version bump
pnpm changeset

# Check changeset status
pnpm changeset status

# (CI only) Version packages
pnpm changeset:version

# (CI only) Publish to npm
pnpm changeset:publish
```

### Release Process

1. Make changes to `packages/polychromos` or `packages/polychromos-types`
2. Run `pnpm changeset` and describe your changes
3. Commit the changeset file with your PR
4. Merge PR to `main`
5. A "Version Packages" PR will be created automatically
6. Merge the "Version Packages" PR to publish to npm
