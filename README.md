# Polychromos

**Code-driven design platform that bridges the gap between Figma and React.**

> *"Design is no longer static pixels. It is executable logic."*

Polychromos is a design tool where designs are fundamentally code - stored as JSON, version-controlled, and directly exportable to React. No more handoff friction between designers and developers.

## Why Polychromos?

Traditional design-to-code workflows have a critical problem:
1. Designers create mockups in Figma
2. Developers manually recreate designs in React code
3. Miscommunication and iteration cycles waste time

**Polychromos eliminates the handoff** by making designs executable from the start. Design with DOM elements, collaborate in real-time, version control your work, and export directly to production-ready code.

## Features

### For Designers
- **Visual Design Editor** - Create layouts with Box, Text, Image, and WebGL elements
- **Real-time Collaboration** - Multiple designers working together simultaneously
- **Version Control** - Full undo/redo history with named checkpoints
- **Design Tokens** - Reusable colors, spacing, and typography systems
- **Advanced Graphics** - WebGL shader support for procedural effects

### For Developers
- **CLI Tool** - Watch and sync local `design.json` files to the cloud
- **Export Options** - Generate HTML, Tailwind CSS, or React-ready code
- **Version History** - `polychromos history` and `polychromos undo/redo`
- **Offline Support** - CLI queues mutations when offline and syncs when reconnected
- **Type-Safe** - Full TypeScript support with published `@polychromos/types` package

### Technical
- **Event-Sourced Architecture** - Complete audit trail of all design changes
- **Real-time Database** - Built on Convex for instant synchronization
- **Modern Stack** - TanStack Start, React 19, Tailwind v4, TypeScript 5.9
- **Authentication** - Clerk-based user management and workspace ownership
- **Monorepo** - Turborepo + pnpm workspaces for efficient development

## Quick Start

### For Users (CLI)

```bash
# Install the CLI globally
npm install -g polychromos

# Initialize a new design project
polychromos init my-design

# Log in to sync with the cloud
polychromos login

# Watch and sync local design.json changes
polychromos dev

# Export to code
polychromos export html          # Standalone HTML with inline CSS
polychromos export tailwind      # Tailwind CSS-based HTML

# Version control
polychromos history              # Show version history
polychromos checkpoint "v1.0"    # Create named checkpoint
polychromos undo                 # Undo last change
polychromos redo                 # Redo last undone change
```

### For Contributors (Development)

#### Prerequisites

- Node.js >= 22.0.0
- pnpm 10.5.2

#### Installation

```bash
# Clone the repository
git clone https://github.com/jeevanpillaystudios/polychromos.git
cd polychromos

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

#### Development Commands

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

- **`polychromos`** - CLI tool with commands for init, dev, login, export, undo/redo, history, and checkpoints
- **`@polychromos/types`** - TypeScript type definitions for the design data model (`PolychromosWorkspace`, `PolychromosElement`, etc.)

### Applications

- **`@repo/app`** - Main design application with real-time collaborative editor
  - Built with TanStack Start + React 19
  - Convex backend for real-time sync
  - Clerk authentication
  - Design canvas with Box, Text, Image, and WebGL element support

- **`@repo/www`** - Marketing website
  - Promotes the code-driven design vision
  - Waitlist signup functionality
  - Built with TanStack Start

### Internal Packages

- **`@repo/ui`** - Shared UI component library (shadcn/ui components)
- **`@repo/eslint-config`** - Shared ESLint configuration
- **`@repo/prettier-config`** - Shared Prettier configuration
- **`@repo/typescript-config`** - Shared TypeScript configuration

## Design Data Model

Polychromos stores designs as structured JSON that's both human-readable and machine-executable:

```typescript
// design.json
{
  "version": "1.0",
  "name": "my-design",
  "tokens": {
    "colors": { "primary": "#3b82f6" },
    "spacing": { "md": "16px" },
    "fonts": { "body": "Inter" }
  },
  "components": {
    "main": {
      "id": "comp-1",
      "name": "main",
      "width": 1200,
      "height": 800,
      "root": {
        "type": "box",
        "layout": {
          "display": "flex",
          "flexDirection": "column",
          "gap": "16px"
        },
        "style": {
          "backgroundColor": "#ffffff",
          "padding": "24px"
        },
        "children": [
          {
            "type": "text",
            "text": {
              "content": "Hello, Polychromos",
              "fontSize": "24px",
              "fontWeight": "bold"
            }
          }
        ]
      }
    }
  }
}
```

### Element Types

- **Box** - Container elements with flexbox/grid layout support
- **Text** - Typography with full font styling options
- **Image** - Images with src, alt, and object-fit properties
- **WebGL** - Advanced shader-based graphics with custom uniforms

## Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

```bash
# Create a changeset for version bump
pnpm changeset

# Check changeset status
pnpm changeset status
```

When you merge a PR to `main` with changesets, a "Version Packages" PR will be created automatically. Merging that PR will publish the packages to npm.

## Example Workflow

### Designer + Developer Collaboration

```bash
# Designer creates initial design in the web app
# - Opens the Polychromos web app
# - Creates a new workspace
# - Designs the UI visually
# - Downloads design.json file

# Developer starts with design file
polychromos login
polychromos init landing-page    # Creates new design.json
# (or copy the design.json from designer)

# Developer iterates locally
polychromos dev                  # Watch and sync changes
# - Edit design.json in IDE
# - Changes sync automatically to cloud
# - Designer sees updates in real-time in web app

# Both can undo/redo
polychromos undo                 # Developer undoes local change
# Designer hits Ctrl+Z           # Undoes in web app

# Create checkpoint when ready
polychromos checkpoint "ready-for-review"

# Export to production code
polychromos export html          # Generates HTML with inline CSS
polychromos export tailwind      # Generates Tailwind-based HTML
```

### Version Control Integration

```bash
# Commit design.json to git
git add design.json
git commit -m "feat: add hero section"

# Create feature branch for design iteration
git checkout -b feature/new-hero
# Edit design
polychromos dev
git commit -am "update: hero layout"

# Merge back to main
git checkout main
git merge feature/new-hero
```

## Architecture & Key Patterns

### Event-Sourced Design History

Polychromos uses event sourcing to track all design changes:
- Every mutation creates an immutable event (RFC 6902 JSON patch)
- Full version history can be reconstructed from the event log
- Undo/redo by replaying events up to a specific point
- Named checkpoints for important milestones
- Automatic cleanup of "future" events when branching after undo

### Real-Time Synchronization

- **Convex Backend** - Real-time database with automatic synchronization
- **Optimistic Concurrency Control** - Version numbers prevent conflicting updates
- **CLI Sync** - `polychromos dev` watches local files and syncs to cloud
- **Offline Support** - Mutations queue when offline and sync when reconnected

### Frontend Architecture

- **Routing**: TanStack Router with file-based routes (auto-generated `routeTree.gen.ts`)
- **Styling**: Tailwind v4 with CSS-based theme directives in `globals.css`
- **Components**: shadcn/ui components in `packages/ui/src/components/ui/` (import via `@repo/ui/components/ui/*`)
- **State Management**: Convex queries/mutations for reactive data
- **Auth**: Clerk authentication integrated with Convex for user-aware workspaces

### Backend (Convex)

Database tables:
- **`workspaces`** - Current workspace state with design JSON
- **`events`** - Immutable event log (JSON patches)
- **`cliAuthSessions`** - CLI authentication tokens with refresh support

## Project Status

Polychromos is in **early development** (v0.1.x):

- ✅ Core design data model implemented
- ✅ Event-sourced architecture with full version history
- ✅ CLI tool with sync, export, undo/redo, checkpoints
- ✅ Real-time collaborative editor
- ✅ Convex backend with authentication
- ✅ Published packages to npm (`polychromos`, `@polychromos/types`)
- 🚧 E2E test infrastructure (in progress)
- 📋 Advanced layout features (planned)
- 📋 Design system templates (planned)
- 📋 React component export (planned)
- 📋 Figma import tool (planned)

## Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start the dev server: `pnpm dev`
4. Make your changes
5. Run tests: `pnpm test`
6. Run E2E tests: `pnpm --filter @repo/app test:e2e:all`

### Creating a Changeset

For changes to published packages (`polychromos` or `@polychromos/types`):

```bash
pnpm changeset
# Follow prompts to describe your changes
git add .changeset/
git commit -m "feat: your feature description"
```

### Pull Request Process

1. Create your feature branch (`git checkout -b feature/amazing-feature`)
2. Make your changes with tests
3. Ensure all tests pass: `pnpm test && pnpm typecheck && pnpm lint`
4. Create a changeset if needed (see above)
5. Commit with conventional commit format (`feat:`, `fix:`, `docs:`, etc.)
6. Push to your fork and open a Pull Request

### Areas for Contribution

- **Design Elements** - Add new element types (e.g., video, SVG path)
- **Export Formats** - React components, Vue, Svelte exporters
- **CLI Features** - Improve developer experience
- **Documentation** - Tutorials, examples, API docs
- **Tests** - Increase coverage, add E2E scenarios

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for more information.

Copyright 2025 Jeevan Pillay Studio Pty Ltd

## Support

For issues and questions, please open an issue on GitHub.
