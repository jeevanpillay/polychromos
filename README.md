# Polychromos

A modern design application built with TanStack Start, React 19, and Convex.

## Features

- **Real-time Collaboration** - Built on Convex for real-time data synchronization
- **Modern Stack** - TanStack Start, React 19, Tailwind v4, TypeScript 5.9
- **Authentication** - Integrated with Clerk for secure user management
- **Component Library** - Shared UI components built with shadcn/ui
- **Monorepo Architecture** - Turborepo + pnpm workspaces for efficient development

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm 10.5.2

### Installation

```bash
# Clone the repository
git clone https://github.com/jeevanpillaystudios/polychromos.git
cd polychromos

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### Development

```bash
# Start all apps in dev mode
pnpm dev

# Start specific apps
pnpm dev:app          # Main design app (http://localhost:3001)
pnpm dev:www          # Marketing website (http://localhost:3000)
```

## Project Structure

```
polychromos/
├── apps/
│   ├── polychromos-app/   # Main design app (TanStack Start + Convex + Clerk)
│   └── polychromos-www/   # Marketing website
├── packages/
│   ├── polychromos/       # CLI tool (published to npm)
│   ├── polychromos-types/ # Shared types (published to npm)
│   └── ui/                # Shared component library (@repo/ui)
└── internal/              # Shared configs (eslint, prettier, typescript)
```

## Technology Stack

- **Framework**: TanStack Start
- **Routing**: TanStack Router (file-based routes)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript 5.9
- **Build Tool**: Vite 7
- **Backend**: Convex (real-time database)
- **Authentication**: Clerk
- **Monorepo**: Turborepo + pnpm workspaces

## Available Scripts

### Development & Build

```bash
pnpm build            # Build all applications
pnpm build:app        # Build app only
pnpm build:www        # Build www only
pnpm typecheck        # TypeScript type checking
```

### Code Quality

```bash
pnpm lint             # ESLint (all packages)
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting
```

### Testing

```bash
pnpm test             # Run unit tests
pnpm test:coverage    # Run tests with coverage
pnpm test:watch       # Run tests in watch mode
```

### E2E Testing

```bash
# Run all E2E tests
pnpm --filter @repo/app test:e2e:all

# Run only browser tests
pnpm --filter @repo/app test:e2e:browser

# Run only CLI tests
pnpm --filter @repo/app test:e2e:cli
```

### UI Components

```bash
pnpm ui               # Add shadcn/ui components
```

## Packages

### Published to npm

- **`polychromos`** - CLI tool for Polychromos
- **`@polychromos/types`** - Shared TypeScript type definitions

### Internal Packages

- **`@repo/app`** - Main design application
- **`@repo/www`** - Marketing website
- **`@repo/ui`** - Shared UI component library
- **`@repo/eslint-config`** - Shared ESLint configuration
- **`@repo/prettier-config`** - Shared Prettier configuration
- **`@repo/typescript-config`** - Shared TypeScript configuration

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

```bash
# Create a changeset for version bump
pnpm changeset

# Check changeset status
pnpm changeset status
```

When you merge a PR to `main` with changesets, a "Version Packages" PR will be created automatically. Merging that PR will publish the packages to npm.

## Key Patterns

- **Routing**: TanStack Router with file-based routes. Route tree auto-generated to `routeTree.gen.ts`
- **Styling**: Tailwind v4 uses CSS-based theme directives in `globals.css`
- **Components**: shadcn/ui components in `packages/ui/src/components/ui/`. Import via `@repo/ui/components/ui/*`
- **Backend**: Convex for real-time database. Functions in `apps/polychromos-app/convex/`
- **Auth**: Clerk for authentication, integrated with Convex

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for more information.

Copyright 2025 Jeevan Pillay Studio Pty Ltd

## Support

For issues and questions, please open an issue on GitHub.
