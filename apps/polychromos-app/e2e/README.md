# E2E Testing Setup

## Required Secrets

Configure the following in your GitHub repository settings:

### Repository Secrets (Settings → Secrets → Actions)

| Secret | Description |
|--------|-------------|
| `CLERK_SECRET_KEY` | Clerk secret key (sk_test_...) |
| `E2E_CLERK_USER_USERNAME` | Test user email address |
| `E2E_CLERK_USER_PASSWORD` | Test user password |

### Repository Variables (Settings → Variables → Actions)

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (pk_test_...) |
| `VITE_CONVEX_URL` | Convex deployment URL |

## Creating a Test User in Clerk

1. Go to Clerk Dashboard → Users
2. Create a new user with email/password
3. Use a strong, unique password
4. Note the credentials for GitHub secrets

## Running E2E Tests Locally

1. Copy `.env.test.example` to `.env.test`
2. Fill in your test credentials
3. Run: `pnpm test:e2e:playwright`

## Debugging Failed Tests

- View test report: `pnpm test:e2e:playwright:ui`
- Run in debug mode: `pnpm test:e2e:playwright:debug`
- Check `playwright-report/` for HTML report
- Check `test-results/` for screenshots and traces

## Test Structure

```
e2e/
├── global.setup.ts          # Clerk authentication setup
└── browser/
    ├── workspace-flow.spec.ts   # Workspace creation and persistence
    ├── auth-ui.spec.ts          # Authentication UI tests
    └── access-control.spec.ts   # Authorization tests
```

## Authentication Flow

1. `global.setup.ts` authenticates once using Clerk credentials
2. Auth state is saved to `playwright/.clerk/user.json`
3. Subsequent tests reuse the cached auth state
4. This makes tests faster and more reliable
