---
date: 2026-02-03T19:30:00+08:00
researcher: Claude
git_commit: 8127c12f0717abf7041800df7a576a462c49e1b4
branch: main
repository: polychromos
topic: "Custom SSR Authentication with Clerk and TanStack Start"
tags: [research, authentication, clerk, convex, tanstack-start, ssr, cli-auth]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Custom SSR Authentication with Clerk and TanStack Start

**Date**: 2026-02-03T19:30:00+08:00
**Researcher**: Claude
**Git Commit**: 8127c12f0717abf7041800df7a576a462c49e1b4
**Branch**: main
**Repository**: polychromos

## Research Question

What exists today and what Clerk/TanStack APIs are available to inform: How can we build custom SSR auth forms that authenticate via Clerk backend APIs, integrate with Convex, and support the CLI auth polling flow?

## Summary

**Critical Finding**: Clerk does **NOT** provide a backend API to create sessions directly from email/password credentials. All authentication flows MUST be initiated client-side. This means replacing Clerk's `<SignIn>` component with truly server-side auth forms is not possible with Clerk alone.

**Viable Approaches for CLI Auth**:
1. **Keep browser-based auth** (current plan) - CLI opens browser → user authenticates via Clerk UI (custom or prebuilt) → CLI polls for token
2. **Sign-in tokens** - Backend generates one-time tokens via `createSignInToken()` → CLI opens browser to consume token → session created
3. **Custom flows with Clerk JS SDK** - Build custom forms that use `window.Clerk.signIn.create()` client-side (still requires browser)

**For the `/cli-auth` route**: The planned approach using Clerk's `<SignIn>` component is the correct pattern. Custom forms would still need to use Clerk's client-side JavaScript SDK, providing no SSR advantage.

---

## Detailed Findings

### 1. Current Clerk Integration in Polychromos

#### @clerk/clerk-react Components

| Component | File | Line |
|-----------|------|------|
| `ClerkProvider` | `apps/polychromos-app/src/router.tsx` | 49 |
| `useAuth` | `apps/polychromos-app/src/router.tsx` | 1, 50 |
| `SignInButton` | `apps/polychromos-app/src/routes/index.tsx` | 2, 43-47 |
| `UserButton` | `apps/polychromos-app/src/routes/index.tsx` | 2, 123 |

#### Clerk + Convex Integration

**Auth Config** (`apps/polychromos-app/convex/auth.config.ts:3-10`):
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

**Provider Setup** (`apps/polychromos-app/src/router.tsx:48-52`):
```typescript
<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

#### Required Environment Variables

| Variable | Purpose | Location |
|----------|---------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Client-side Clerk init | `apps/polychromos-app/src/router.tsx:15-16` |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex JWT validation | `apps/polychromos-app/convex/auth.config.ts:6` |
| `CLERK_SECRET_KEY` | Backend API calls | `apps/polychromos-www/src/env.ts:19` |
| `E2E_CLERK_USER_EMAIL` | E2E test credentials | `.github/workflows/ci.yml:76` |
| `E2E_CLERK_USER_PASSWORD` | E2E test credentials | `.github/workflows/ci.yml:77` |

---

### 2. TanStack Start Server Functions in Codebase

#### Current Usage (polychromos-www only)

The main app (`polychromos-app`) uses **Convex for all backend logic** - no TanStack Start server functions.

The marketing site (`polychromos-www`) demonstrates server function patterns:

**Server Function Definition** (`apps/polychromos-www/src/functions/waitlist.ts:12-34`):
```typescript
import { createServerFn } from "@tanstack/react-start";

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: WaitlistFormData) => waitlistSchema.parse(data))
  .handler(async ({ data }) => {
    const response = await fetch("https://api.clerk.com/v1/waitlist_entries", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: data.email, notify: true }),
    });
    return { success: true };
  });
```

**Middleware** (`apps/polychromos-www/src/lib/middleware.ts:11-59`):
```typescript
import { createMiddleware } from "@tanstack/react-start";
import { getResponseHeaders, setResponseHeaders } from "@tanstack/react-start/server";

export const securityHeadersMiddleware = createMiddleware().server(({ next }) => {
  const headers = getResponseHeaders();
  headers.set("X-Frame-Options", "DENY");
  // ... more headers
  setResponseHeaders(headers);
  return next();
});
```

**Key Pattern**: TanStack Start provides `createServerFn()` for server functions and `createMiddleware()` for request/response handling, but **does not provide cookie/session management utilities** - that's left to the auth provider (Clerk).

---

### 3. Clerk Backend/Headless APIs

#### Available Server-Side Methods

| Method | Package | Purpose |
|--------|---------|---------|
| `authenticateRequest()` | `@clerk/backend` | Verify session tokens |
| `verifyToken()` | `@clerk/backend` | Low-level JWT verification |
| `createUser()` | `@clerk/backend` | Create user accounts (no session) |
| `createSignInToken()` | `@clerk/backend` | Generate one-time auth tokens |
| `sessions.getToken()` | `@clerk/backend` | Get JWT for third-party services |

#### Critical Limitation: No Server-Side Session Creation

**From Clerk Documentation**: All email/password authentication flows require client-side JavaScript:

```javascript
// This ONLY works in browser, NOT server-side
const signIn = await window.Clerk.signIn.create({
  identifier: 'user@example.com',
  password: 'password123'
});
await window.Clerk.setActive({ session: signIn.createdSessionId });
```

**Available Workarounds**:

1. **Sign-In Tokens** (`createSignInToken()`):
```typescript
// Server-side: Generate token
const signInToken = await clerkClient.signInTokens.createSignInToken({
  userId: 'user_xxx',
  expiresInSeconds: 300
});

// Client-side: Consume token (still requires browser)
await signIn.create({
  strategy: 'ticket',
  ticket: signInToken.token
});
```

2. **Custom Flows with JS SDK** (headless but client-side):
```javascript
// Still runs in browser, just without Clerk UI
const signIn = await window.Clerk.client.signIn.create({
  identifier: email,
  password: password
});
// Handle MFA if needed...
await window.Clerk.setActive({ session: signIn.createdSessionId });
```

---

### 4. Convex + Custom Auth Integration

#### How Convex Authenticates Requests

1. **Browser**: `ConvexProviderWithClerk` automatically calls `useAuth().getToken({ template: 'convex' })` and sets it on the Convex client
2. **CLI/Server**: Manually call `client.setAuth(token)` with a valid JWT

**Convex Function Auth Check** (`apps/polychromos-app/convex/lib/auth.ts:4-10`):
```typescript
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return identity;
}
```

#### JWT Claims Required by Convex

From `convex/auth.config.ts` and JWT template requirements:

| Claim | Purpose | Source |
|-------|---------|--------|
| `sub` | User identifier | Clerk user ID |
| `iss` | Issuer domain | Must match `CLERK_JWT_ISSUER_DOMAIN` |
| `aud` | Audience | Must be `"convex"` |
| `exp` | Expiration | Token validity |
| `iat` | Issued at | For token refresh |

#### Getting Convex Tokens Server-Side

**With active Clerk session**:
```typescript
// Next.js style (not available in TanStack Start)
const { getToken } = await auth();
const convexToken = await getToken({ template: 'convex' });

// OR with clerkClient
const token = await clerkClient.sessions.getToken(sessionId, 'convex');
```

**For TanStack Start**: Would need to implement middleware that extracts the Clerk session token from cookies and calls Clerk's backend API.

---

### 5. CLI Auth Flow Implications

#### Current Plan (from `2026-02-03-polychromos-cli-browser-auth-flow.md`)

```
CLI generates code → Opens browser to /cli-auth?code=XXX →
User authenticates → Web app stores token in Convex →
CLI polls Convex for token
```

#### Why Custom Forms Don't Help

The plan shows `/cli-auth` route using `<SignIn>` component:

```tsx
// From plan Phase 2
if (!isSignedIn) {
  return (
    <SignIn routing="hash" afterSignInUrl={`/cli-auth?code=${code}`} />
  );
}
```

**Even with custom forms**, you would still need:
```tsx
// Custom form (client-side only)
const handleSubmit = async (email, password) => {
  const signIn = await window.Clerk.signIn.create({
    identifier: email,
    password: password
  });
  await window.Clerk.setActive({ session: signIn.createdSessionId });
  // Then proceed with token exchange
};
```

**No SSR advantage** - authentication must happen in browser regardless.

#### How `session.getToken({ template: 'convex' })` Works

After successful Clerk authentication:
```javascript
// Clerk makes API call to generate JWT with 'convex' template
const token = await session.getToken({ template: 'convex' });
// Token includes claims configured in Clerk Dashboard JWT template
// This token is what gets stored in cliAuthSessions and sent to CLI
```

This **requires an active Clerk session** established via browser authentication.

---

### 6. E2E Test Implications

#### Current Test Authentication

**Global Setup** (`apps/polychromos-app/e2e/global.setup.ts`):
1. `clerkSetup()` - initializes Clerk testing (line 12)
2. Manual UI authentication via Clerk modal (lines 28-51)
3. Save storage state to `playwright/.clerk/user.json` (line 66)

**Token Extraction** (`packages/polychromos/test/e2e/setup.ts:257-269`):
```typescript
const token = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 1000));
  return await window.Clerk.session.getToken({ template: 'convex' });
});
```

**Clerk Testing Utilities Used**:
- `clerkSetup()` - one-time test environment initialization
- `setupClerkTestingToken({ page })` - per-test token setup (bypasses bot detection)

#### Changes Needed for Custom Auth

If custom auth forms are implemented:

1. **Global Setup** would change from:
   - Finding and clicking Clerk UI elements (`.cl-modalContent`, etc.)
   - To: Filling custom form fields and submitting

2. **Test Selectors** would change from:
   - Clerk CSS classes (`.cl-userButtonTrigger`, `.cl-modalContent`)
   - To: Your custom form element selectors

3. **Clerk Testing Utilities** - Still needed:
   - `clerkSetup()` - still required for Clerk testing environment
   - `setupClerkTestingToken()` - still required if using any Clerk client-side features

4. **Token Extraction** - No change needed:
   - `window.Clerk.session.getToken({ template: 'convex' })` works regardless of UI used for auth

---

## Architecture Documentation

### Current Auth Flow (Browser)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Authentication                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ClerkProvider wraps app (router.tsx:49)                      │
│     └── Loads Clerk JS, manages session state                    │
│                                                                  │
│  2. User clicks SignInButton (index.tsx:43)                      │
│     └── Opens Clerk modal                                        │
│                                                                  │
│  3. User enters email/password in Clerk UI                       │
│     └── Clerk JS sends to Clerk Frontend API                     │
│     └── Session created, cookie set                              │
│                                                                  │
│  4. ConvexProviderWithClerk (router.tsx:50)                      │
│     └── Calls useAuth() to get session state                     │
│     └── Calls getToken({ template: 'convex' })                   │
│     └── Sets token on ConvexReactClient                          │
│                                                                  │
│  5. Convex queries/mutations include JWT                         │
│     └── Convex validates JWT (auth.config.ts)                    │
│     └── ctx.auth.getUserIdentity() returns user                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CLI Auth Flow (Planned)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Authentication (Planned)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CLI: polychromos login                                       │
│     └── Generate unique code (pol_xxx)                           │
│     └── Create pending session in Convex (cliAuth.createSession) │
│                                                                  │
│  2. CLI: Open browser to /cli-auth?code=pol_xxx                  │
│                                                                  │
│  3. Browser: /cli-auth route                                     │
│     └── If not signed in: Show Clerk SignIn (or custom form*)    │
│     └── After sign in: Get Convex token                          │
│     └── Call cliAuth.completeSession with token                  │
│                                                                  │
│  4. CLI: Poll Convex (cliAuth.getSession)                        │
│     └── Wait for status: "completed"                             │
│     └── Retrieve token from response                             │
│                                                                  │
│  5. CLI: Save token to ~/.polychromos/credentials.json           │
│     └── Use token for subsequent Convex calls                    │
│                                                                  │
│  * Custom form still requires Clerk JS client-side               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Custom Auth Form (If Implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│          Custom Auth Form (Still Client-Side Only)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  // Custom form component                                        │
│  function CustomSignIn({ onSuccess }) {                          │
│    const handleSubmit = async (email, password) => {             │
│                                                                  │
│      // Step 1: Create sign-in attempt (CLIENT-SIDE)             │
│      const signIn = await window.Clerk.signIn.create({           │
│        identifier: email,                                        │
│        password: password                                        │
│      });                                                         │
│                                                                  │
│      // Step 2: Handle MFA if required                           │
│      if (signIn.status === 'needs_second_factor') {              │
│        // Show MFA input...                                      │
│      }                                                           │
│                                                                  │
│      // Step 3: Activate session (CLIENT-SIDE)                   │
│      if (signIn.status === 'complete') {                         │
│        await window.Clerk.setActive({                            │
│          session: signIn.createdSessionId                        │
│        });                                                       │
│        onSuccess();                                              │
│      }                                                           │
│    };                                                            │
│                                                                  │
│    return <form onSubmit={...}>...</form>;                       │
│  }                                                               │
│                                                                  │
│  // Still requires ClerkProvider and client-side JS              │
│  // No SSR benefit - just custom UI                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code References

### Clerk Integration
- `apps/polychromos-app/src/router.tsx:1,49-50` - ClerkProvider and ConvexProviderWithClerk setup
- `apps/polychromos-app/src/routes/index.tsx:2,43-47,123` - SignInButton and UserButton usage
- `apps/polychromos-app/convex/auth.config.ts:3-10` - Convex auth configuration
- `apps/polychromos-app/convex/lib/auth.ts:4-28` - Auth helper functions

### TanStack Start Server Functions
- `apps/polychromos-www/src/functions/waitlist.ts:12-34` - createServerFn example
- `apps/polychromos-www/src/lib/middleware.ts:11-59` - createMiddleware example
- `apps/polychromos-www/src/start.ts:9-10` - Middleware registration

### Convex Client Usage
- `apps/polychromos-app/src/router.tsx:25` - ConvexReactClient creation
- `packages/polychromos/src/commands/whoami.ts:22-23` - ConvexHttpClient with setAuth
- `packages/polychromos/src/lib/credentials.ts:49-63` - Token loading (POLYCHROMOS_TOKEN priority)

### E2E Testing
- `apps/polychromos-app/e2e/global.setup.ts:12,28-66` - Clerk setup and manual auth
- `packages/polychromos/test/e2e/setup.ts:257-269` - Token extraction via window.Clerk
- `apps/polychromos-app/e2e/cross-platform/cli-to-web.spec.ts:32-42` - Cross-platform token extraction

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-02-03-polychromos-cli-browser-auth-flow.md` - CLI auth flow implementation plan
- `thoughts/shared/research/2026-02-03-e2e-testing-architecture-for-browser-auth-rework.md` - E2E testing documentation
- `thoughts/shared/research/2026-02-03-polychromos-cli-authentication-current-state.md` - Previous auth research

---

## Related Research

- [Clerk Backend SDK Overview](https://clerk.com/docs/reference/backend/overview)
- [Clerk Custom Flows Documentation](https://clerk.com/docs/custom-flows/overview)
- [Convex & Clerk Integration](https://docs.convex.dev/auth/clerk)
- [TanStack Start with Clerk](https://docs.convex.dev/client/tanstack/tanstack-start/clerk)

---

## Recommendations

### For CLI Auth Flow

**Keep the planned approach** from `2026-02-03-polychromos-cli-browser-auth-flow.md`:
- Use browser-based authentication (Clerk `<SignIn>` or custom forms)
- Store Convex token in `cliAuthSessions` table
- CLI polls for token via `cliAuth.getSession`

**Rationale**: No SSR alternative exists for Clerk authentication. Custom forms provide UI flexibility but no architectural advantage.

### For Custom Auth UI (Optional)

If you want custom-styled forms instead of Clerk's prebuilt UI:

1. **Use Clerk Elements (Beta)** - Headless UI components with custom styling
2. **Use Clerk JS SDK** - Build completely custom forms that call `window.Clerk.signIn.create()`

Both still require `ClerkProvider` and client-side JavaScript.

### For E2E Tests

No major changes needed for CLI auth rework:
- `clerkSetup()` and `setupClerkTestingToken()` still required
- Token extraction pattern (`window.Clerk.session.getToken`) unchanged
- Update selectors if custom UI replaces Clerk components

---

## Open Questions

1. **Is custom UI actually needed?** - Clerk's `<SignIn>` component is customizable via CSS/theming
2. **MFA handling** - Custom flows need to handle `needs_second_factor` status
3. **Error states** - Custom forms need to display Clerk error messages (invalid password, etc.)
4. **Rate limiting** - Each `getToken({ template })` call counts toward Clerk rate limits
5. **Token refresh** - How will CLI handle token expiration during long-running sessions?
