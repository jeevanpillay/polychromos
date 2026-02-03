# GitHub OAuth Login Implementation Plan

## Overview

Add GitHub OAuth authentication to the sign-in and sign-up pages using Clerk's OAuth integration. Users will be able to sign in with their GitHub account as an alternative to email/password.

## Current State Analysis

**Sign-In Route** (`apps/polychromos-app/src/routes/sign-in.tsx`):
- Two-step email/password flow using `useSignIn()` hook
- Error handling extracts from `err.errors[0].message`
- Loading states disable UI and show loading text
- No OAuth functionality exists

**Sign-Up Route** (`apps/polychromos-app/src/routes/sign-up.tsx`):
- Email/password creation with email verification using `useSignUp()` hook
- Same error handling and loading patterns
- No OAuth functionality exists

**Routes Directory** (`apps/polychromos-app/src/routes/`):
- No SSO callback route exists yet
- TanStack Router uses file-based routing with auto-generated route tree

**UI Components** (`packages/ui/`):
- Button component with variants: `default`, `outline`, `secondary`, etc.
- lucide-react v0.563.0 available - provides `Github` icon
- No Separator or divider components needed for this phase

### Key Discoveries:
- Clerk's `@clerk/clerk-react` v5.60.0 already installed at `apps/polychromos-app/package.json:25`
- ClerkProvider configured at `apps/polychromos-app/src/router.tsx:49`
- Consistent error handling pattern: `(err as { errors?: { message?: string }[] }).errors?.[0]?.message`
- Loading states managed with local `loading` boolean state
- Button pattern: `<Button className="w-full" disabled={loading}>`

## Desired End State

After implementation, users can:
1. Click "Continue with GitHub" button on sign-in page
2. Click "Continue with GitHub" button on sign-up page
3. Be redirected to GitHub for authorization
4. Return to the app and be automatically signed in
5. Land on the home page (`/`) with active session

### Verification:
- GitHub OAuth button appears on both sign-in and sign-up pages
- Clicking button redirects to GitHub authorization
- After GitHub authorization, user returns to app with active session
- Error handling works for OAuth failures
- Loading states prevent duplicate submissions

## What We're NOT Doing

- Not adding OAuth dividers or separators (focus on logic only)
- Not implementing other OAuth providers (Google, etc.) in this phase
- Not adding OAuth to CLI auth route (`/cli-auth`)
- Not configuring production GitHub OAuth app (works with Clerk's dev credentials)
- Not adding custom styling beyond existing Button patterns
- Not modifying Convex backend (Clerk integration already handles OAuth)

## Implementation Approach

The implementation follows Clerk's OAuth custom flows pattern:
1. Use `signIn.authenticateWithRedirect()` on sign-in page
2. Use `signUp.authenticateWithRedirect()` on sign-up page
3. Create `/sso-callback` route with `AuthenticateWithRedirectCallback` component
4. Clerk handles token exchange, session creation, and redirect to home page

This approach integrates with existing Clerk/Convex auth without backend changes.

## Phase 1: Create SSO Callback Route

### Overview
Create the OAuth callback route that Clerk redirects to after GitHub authorization. This must exist before OAuth buttons are added.

### Changes Required:

#### 1. New SSO Callback Route
**File**: `apps/polychromos-app/src/routes/sso-callback.tsx` (new file)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export const Route = createFileRoute("/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
```

**Implementation Note**: The `AuthenticateWithRedirectCallback` component is intentionally not rendered in the JSX above because the example shows a loading spinner. The component should be added to the JSX:

```tsx
function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] File exists at correct path: `ls apps/polychromos-app/src/routes/sso-callback.tsx`
- [x] TypeScript compilation passes: `make typecheck`
- [x] No linting errors: `make lint`
- [x] Route tree regenerates: `pnpm --filter @repo/app dev` (starts and generates `routeTree.gen.ts`)

#### Manual Verification:
- [x] Navigate to `http://localhost:3001/sso-callback` - page loads with loading spinner
- [x] No console errors appear
- [x] Page matches styling of other auth pages (loading spinner)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add GitHub OAuth to Sign-In Page

### Overview
Add GitHub OAuth button below the email form on the sign-in page. The button will redirect to GitHub for authorization.

### Changes Required:

#### 1. Update Sign-In Route
**File**: `apps/polychromos-app/src/routes/sign-in.tsx`

**Add import for Github icon (after line 7):**
```tsx
import { Github } from "lucide-react";
```

**Add OAuth handler function (after line 76, before the loading check):**
```tsx
const handleGitHubSignIn = async () => {
  setError("");
  setLoading(true);

  try {
    await signIn?.authenticateWithRedirect({
      strategy: "oauth_github",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/",
    });
  } catch (err: unknown) {
    const message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message ?? "Failed to authenticate with GitHub";
    setError(message);
    setLoading(false);
  }
};
```

**Add GitHub button (after line 156, before the "Don't have an account?" text):**
```tsx
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <span className="w-full border-t" />
  </div>
  <div className="relative flex justify-center text-xs uppercase">
    <span className="bg-background px-2 text-muted-foreground">Or</span>
  </div>
</div>

<Button
  type="button"
  variant="outline"
  className="w-full"
  onClick={handleGitHubSignIn}
  disabled={loading}
>
  <Github className="mr-2 h-4 w-4" />
  Continue with GitHub
</Button>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `make typecheck`
- [x] No linting errors: `make lint`
- [x] File imports are valid: `pnpm --filter @repo/app dev` (no import errors)

#### Manual Verification:
- [x] GitHub button appears below the email form on `/sign-in`
- [x] Button shows GitHub icon and "Continue with GitHub" text
- [x] Clicking button initiates OAuth flow (redirects to GitHub or Clerk OAuth page)
- [x] During OAuth flow, button shows disabled state
- [x] If OAuth is cancelled, user returns to sign-in page without errors
- [x] After successful GitHub auth, user lands on home page (`/`) with active session
- [x] Error handling works if OAuth fails (displays error message)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Add GitHub OAuth to Sign-Up Page

### Overview
Add GitHub OAuth button below the registration form on the sign-up page. Implementation mirrors the sign-in page.

### Changes Required:

#### 1. Update Sign-Up Route
**File**: `apps/polychromos-app/src/routes/sign-up.tsx`

**Add import for Github icon (after line 7):**
```tsx
import { Github } from "lucide-react";
```

**Add OAuth handler function (after line 75, before the loading check):**
```tsx
const handleGitHubSignUp = async () => {
  setError("");
  setLoading(true);

  try {
    await signUp?.authenticateWithRedirect({
      strategy: "oauth_github",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/",
    });
  } catch (err: unknown) {
    const message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message ?? "Failed to authenticate with GitHub";
    setError(message);
    setLoading(false);
  }
};
```

**Add GitHub button (after line 158, before the "Already have an account?" text, only in the initial form):**

Note: The button should only appear in the initial sign-up form (`!pendingVerification`), not in the email verification step.

```tsx
{!pendingVerification && (
  <>
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">Or</span>
      </div>
    </div>

    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGitHubSignUp}
      disabled={loading}
    >
      <Github className="mr-2 h-4 w-4" />
      Continue with GitHub
    </Button>
  </>
)}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `make typecheck`
- [x] No linting errors: `make lint`
- [x] File imports are valid: `pnpm --filter @repo/app dev` (no import errors)

#### Manual Verification:
- [ ] GitHub button appears below the registration form on `/sign-up`
- [ ] Button shows GitHub icon and "Continue with GitHub" text
- [ ] Button does NOT appear during email verification step
- [ ] Clicking button initiates OAuth flow (redirects to GitHub or Clerk OAuth page)
- [ ] During OAuth flow, button shows disabled state
- [ ] If OAuth is cancelled, user returns to sign-up page without errors
- [ ] After successful GitHub auth, user lands on home page (`/`) with active session
- [ ] Error handling works if OAuth fails (displays error message)
- [ ] User can sign up with GitHub even if they already have an account (Clerk handles account linking)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:
No unit tests required for this implementation - OAuth flow is integration-level and mocked tests would not provide value.

### Integration Tests:
Future work: Add E2E tests using `@clerk/testing/playwright` to test OAuth flow in CI. Pattern exists at `apps/polychromos-app/e2e/global.setup.ts`.

### Manual Testing Steps:

**Sign-In Flow:**
1. Navigate to `http://localhost:3001/sign-in`
2. Verify GitHub button appears below email form
3. Click "Continue with GitHub"
4. Authorize with GitHub (or Clerk's dev OAuth simulation)
5. Verify redirect to `/sso-callback` shows loading state
6. Verify redirect to `/` with active session
7. Verify user button shows authenticated state

**Sign-Up Flow:**
1. Navigate to `http://localhost:3001/sign-up`
2. Verify GitHub button appears below registration form
3. Click "Continue with GitHub"
4. Authorize with GitHub (or Clerk's dev OAuth simulation)
5. Verify redirect to `/sso-callback` shows loading state
6. Verify redirect to `/` with active session
7. Verify user button shows authenticated state

**Error Scenarios:**
1. Cancel OAuth flow - verify user returns to auth page without errors
2. Network error during OAuth - verify error message displays
3. Multiple clicks on GitHub button - verify loading state prevents duplicates

**Account Linking:**
1. Create account with email/password
2. Sign out
3. Sign in with GitHub using same email - verify Clerk links accounts
4. Sign in with both methods works

## Performance Considerations

- OAuth redirect happens client-side, no server-side rendering impact
- `AuthenticateWithRedirectCallback` component handles token exchange efficiently
- Loading states prevent duplicate OAuth initiation requests
- No additional bundle size impact (Clerk components already included, lucide-react icon is tree-shakeable)

## Migration Notes

No migration needed - this is additive functionality. Existing email/password authentication continues to work unchanged. Users can use either authentication method.

## References

- Original research: `thoughts/shared/research/2026-02-03-implement-github-login.md`
- Clerk OAuth documentation: https://clerk.com/docs/custom-flows/oauth-connections
- Sign-in implementation: `apps/polychromos-app/src/routes/sign-in.tsx:1-169`
- Sign-up implementation: `apps/polychromos-app/src/routes/sign-up.tsx:1-171`
- Button component: `packages/ui/src/components/ui/button.tsx:8-61`
- ClerkProvider setup: `apps/polychromos-app/src/router.tsx:48-54`
