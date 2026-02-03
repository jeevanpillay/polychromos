---
date: 2026-02-03T00:00:00-08:00
researcher: claude
git_commit: 558dbe4
branch: main
repository: polychromos
topic: "Implement GitHub OAuth login in sign-in and sign-up routes"
tags: [research, codebase, clerk, oauth, github, authentication]
status: complete
last_updated: 2026-02-03
last_updated_by: claude
---

# Research: Implement GitHub OAuth Login in Sign-In and Sign-Up Routes

**Date**: 2026-02-03
**Researcher**: claude
**Git Commit**: 558dbe4
**Branch**: main
**Repository**: polychromos

## Research Question

How to implement GitHub login in `apps/polychromos-app/src/routes/sign-in.tsx` and `apps/polychromos-app/src/routes/sign-up.tsx`

## Summary

The codebase currently uses Clerk for authentication with email/password only. To add GitHub OAuth login, you need to:

1. Enable GitHub in the Clerk Dashboard (works automatically in development)
2. Create an SSO callback route to handle the OAuth redirect
3. Add GitHub sign-in buttons to both sign-in and sign-up pages using `signIn.authenticateWithRedirect()` and `signUp.authenticateWithRedirect()`

The UI package already has `lucide-react` which provides the `Github` icon component.

## Detailed Findings

### Current Authentication Implementation

**Sign-In Route** (`apps/polychromos-app/src/routes/sign-in.tsx`)
- Uses `useSignIn()` hook from `@clerk/clerk-react`
- Two-step email/password flow:
  1. Email submission via `signIn.create({ identifier: email })`
  2. Password submission via `signIn.attemptFirstFactor({ strategy: "password", password })`
- No OAuth/social login implemented

**Sign-Up Route** (`apps/polychromos-app/src/routes/sign-up.tsx`)
- Uses `useSignUp()` hook from `@clerk/clerk-react`
- Two-phase registration:
  1. Account creation via `signUp.create({ emailAddress, password })`
  2. Email verification via `signUp.prepareEmailAddressVerification()` and `signUp.attemptEmailAddressVerification()`
- No OAuth/social login implemented

**Provider Setup** (`apps/polychromos-app/src/router.tsx:48-54`)
```tsx
<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

### Clerk OAuth API for GitHub

**Strategy Name**: `oauth_github`

**Sign-In with OAuth** (using `useSignIn()` hook):
```tsx
import { OAuthStrategy } from '@clerk/types'
import { useSignIn } from '@clerk/clerk-react'

const { signIn } = useSignIn()

const signInWithGitHub = () => {
  return signIn?.authenticateWithRedirect({
    strategy: 'oauth_github',
    redirectUrl: '/sso-callback',
    redirectUrlComplete: '/',
  })
}
```

**Sign-Up with OAuth** (using `useSignUp()` hook):
```tsx
import { OAuthStrategy } from '@clerk/types'
import { useSignUp } from '@clerk/clerk-react'

const { signUp } = useSignUp()

const signUpWithGitHub = () => {
  return signUp?.authenticateWithRedirect({
    strategy: 'oauth_github',
    redirectUrl: '/sso-callback',
    redirectUrlComplete: '/',
  })
}
```

**Key Parameters**:
- `strategy`: The OAuth provider identifier (`'oauth_github'` for GitHub)
- `redirectUrl`: Route handling the OAuth callback (e.g., `/sso-callback`)
- `redirectUrlComplete`: Final destination after successful authentication (e.g., `/`)

### SSO Callback Route Required

A new route is needed to handle the OAuth redirect callback. This route should render Clerk's `AuthenticateWithRedirectCallback` component:

**New File Required**: `apps/polychromos-app/src/routes/sso-callback.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export const Route = createFileRoute("/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
```

### Current Route Structure

The existing routes in `apps/polychromos-app/src/routes/`:
- `__root.tsx` - Root layout
- `index.tsx` - Home page (/)
- `sign-in.tsx` - Sign-in page (/sign-in)
- `sign-up.tsx` - Sign-up page (/sign-up)
- `cli-auth.tsx` - CLI authentication (/cli-auth)
- `$.tsx` - Catch-all route

**No SSO callback route exists** - must be created at `routes/sso-callback.tsx`

### UI Components Available

The `@repo/ui` package includes:
- `Button` from `@repo/ui/components/ui/button` - Used in auth forms
- `lucide-react` (v0.563.0) - Provides `Github` icon

**GitHub Icon Usage**:
```tsx
import { Github } from "lucide-react"

<Button variant="outline" onClick={signInWithGitHub}>
  <Github className="mr-2 h-4 w-4" />
  Continue with GitHub
</Button>
```

### Clerk Dashboard Configuration

**For Development**:
- GitHub OAuth works out-of-the-box with Clerk's shared credentials
- No configuration required

**For Production**:
1. Navigate to Clerk Dashboard → User & Authentication → Social Connections
2. Enable GitHub
3. Toggle "Use custom credentials"
4. Create GitHub OAuth App at https://github.com/settings/developers
5. Set Authorization callback URL to the one provided by Clerk
6. Enter Client ID and Client Secret in Clerk Dashboard

### Error Handling Pattern

The existing error handling pattern in sign-in/sign-up routes:
```tsx
catch (err: unknown) {
  const message = (err as { errors?: { message?: string }[] }).errors?.[0]?.message ?? "Default error message";
  setError(message);
}
```

This same pattern can be used for OAuth errors.

### Integration Points

**Sign-In Page Changes**:
1. Import `Github` from `lucide-react`
2. Add `signInWithGitHub` function using `signIn.authenticateWithRedirect()`
3. Add GitHub button before or after the email form
4. Button should be disabled during loading state

**Sign-Up Page Changes**:
1. Import `Github` from `lucide-react`
2. Add `signUpWithGitHub` function using `signUp.authenticateWithRedirect()`
3. Add GitHub button before or after the registration form
4. Button should be disabled during loading state

**New Route**:
- Create `/sso-callback` route with `AuthenticateWithRedirectCallback`

## Code References

- `apps/polychromos-app/src/routes/sign-in.tsx:1-169` - Current sign-in implementation
- `apps/polychromos-app/src/routes/sign-up.tsx:1-171` - Current sign-up implementation
- `apps/polychromos-app/src/router.tsx:48-54` - ClerkProvider setup
- `apps/polychromos-app/src/routeTree.gen.ts:44-72` - Existing route definitions
- `packages/ui/package.json:66` - lucide-react dependency

## Architecture Documentation

### Authentication Flow with GitHub OAuth

```
User clicks "Continue with GitHub"
        ↓
signIn.authenticateWithRedirect({
  strategy: 'oauth_github',
  redirectUrl: '/sso-callback',
  redirectUrlComplete: '/'
})
        ↓
Redirect to GitHub OAuth
        ↓
User authorizes app
        ↓
GitHub redirects to /sso-callback
        ↓
AuthenticateWithRedirectCallback handles token exchange
        ↓
Clerk creates/updates session
        ↓
Redirect to redirectUrlComplete ('/')
        ↓
User is authenticated
```

### File Changes Required

1. **New file**: `apps/polychromos-app/src/routes/sso-callback.tsx`
2. **Modify**: `apps/polychromos-app/src/routes/sign-in.tsx`
3. **Modify**: `apps/polychromos-app/src/routes/sign-up.tsx`

### Type Import

```tsx
import type { OAuthStrategy } from '@clerk/types'
```

The `@clerk/types` package is already installed as a dependency of `@clerk/clerk-react`.

## Historical Context (from thoughts/)

No existing research documents found on OAuth/GitHub authentication.

## Related Research

- No related research documents found in `thoughts/shared/research/`

## Open Questions

1. **UI Placement**: Should the GitHub button appear above or below the email/password form?
2. **Divider**: Should there be an "or" divider between OAuth buttons and email form?
3. **CLI Auth**: Should CLI authentication (`/cli-auth`) also support GitHub OAuth?
4. **Multiple Providers**: Will other OAuth providers (Google, etc.) be added later? If so, consider extracting OAuth logic into a shared component.

## External References

- [Clerk OAuth Custom Flows Documentation](https://clerk.com/docs/custom-flows/oauth-connections)
- [Clerk GitHub Social Connection Guide](https://clerk.com/docs/authentication/social-connections/github)
- [Clerk Social Connections Overview](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/overview)
