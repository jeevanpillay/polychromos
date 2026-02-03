# Polychromos CLI

Code-driven design platform CLI tool.

## Installation

```bash
npm install -g polychromos
```

## Usage

```bash
# Initialize a new design project
polychromos init my-project

# Login to your account
polychromos login

# Check authentication status
polychromos whoami

# Start development mode
polychromos dev

# Export to different formats
polychromos export html
polychromos export tailwind

# Logout
polychromos logout
```

## Development

### Environment Variables

For local development and testing, set these environment variables:

```bash
# Point to local Convex backend
export POLYCHROMOS_CONVEX_URL=http://127.0.0.1:3210

# Point to local web app for authentication
export POLYCHROMOS_APP_URL=http://localhost:3001
```

For testing without browser authentication:

```bash
# Skip browser auth and use token directly
export POLYCHROMOS_TOKEN=your-convex-token
```

For E2E test configuration:

```bash
# Custom backend URL for tests
export CONVEX_BACKEND_URL=http://127.0.0.1:3210
export CONVEX_BACKEND_PORT=3210

# Custom web app URL for tests
export WEB_APP_URL=http://localhost:3001
export WEB_APP_PORT=3001
```

### Running E2E Tests

```bash
# From monorepo root
pnpm --filter @repo/app test:e2e:all

# Just CLI tests
pnpm --filter @repo/app test:e2e:cli

# Just browser tests
pnpm --filter @repo/app test:e2e:browser

# Cross-platform tests
pnpm --filter @repo/app test:e2e:cross-platform
```

### Building

```bash
# Build the CLI
pnpm build

# Run locally
node dist/index.js --version
```

## Production

By default, the CLI uses production URLs:
- **App**: https://app.polychromos.xyz
- **Convex**: https://dainty-toucan-799.convex.cloud

These can be overridden with environment variables for local development.

## License

MIT
