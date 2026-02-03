---
date: 2026-02-03T01:40:34+00:00
researcher: Claude
git_commit: b441a7d528e29d1b88fb51696a90399f9ad0d67a
branch: main
repository: polychromos
topic: "Polychromos CLI Authentication - Current State Documentation"
tags: [research, polychromos, cli, authentication, clerk, browser-auth, token-handling]
status: complete
last_updated: 2026-02-03
last_updated_by: Claude
---

# Research: Polychromos CLI Authentication - Current State Documentation

**Date**: 2026-02-03T01:40:34+00:00
**Researcher**: Claude
**Git Commit**: b441a7d528e29d1b88fb51696a90399f9ad0d67a
**Branch**: main
**Repository**: polychromos

## Research Question

Document the current CLI authentication implementation in polychromos, specifically the "copy token from cookies" flow, and document what exists for potential upgrade to a browser-based auth flow with terminal interaction (similar to Claude Code's implementation).

## Summary

The Polychromos CLI currently uses a **manual token copy-paste authentication flow**:

| Aspect | Current State |
|--------|--------------|
| **Login method** | User manually copies `__session` cookie from browser DevTools |
| **Token storage** | `~/.polychromos/credentials.json` with chmod 0o600 (Unix) or icacls (Windows) |
| **Token format** | Clerk session token (JWT) |
| **Token refresh** | No automatic refresh; user must re-login when expired |
| **Expiry handling** | 5-minute buffer check before declared expiry |
| **Environment override** | `POLYCHROMOS_TOKEN` env var supported |

This flow is functional but requires manual browser interaction and copying tokens, which is not ideal for production use.

---

## Detailed Findings

### 1. Current Authentication Flow

#### Login Command Implementation

**File**: `packages/polychromos/src/commands/login.ts:1-47`

```typescript
export async function loginCommand(): Promise<void> {
  console.log("Polychromos CLI Login");
  console.log("");
  console.log("To authenticate, you need a Clerk session token from the web app.");
  console.log("");
  console.log("Steps:");
  console.log("1. Open the Polychromos web app and sign in");
  console.log("2. Open browser DevTools (F12) → Application → Cookies");
  console.log("3. Find the '__session' cookie and copy its value");
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your session token: ", (token) => {
      rl.close();
      const trimmedToken = token.trim();
      if (!trimmedToken) {
        console.error("No token provided. Login cancelled.");
        process.exit(1);
      }
      // ... saves credentials
    });
  });
}
```

**User Experience**:
1. User runs `polychromos login`
2. CLI displays instructions to obtain token from browser
3. User opens web app, signs in via Clerk
4. User opens browser DevTools → Application → Cookies
5. User finds `__session` cookie and copies its value
6. User pastes token into CLI prompt
7. CLI saves token to credentials file

#### Token Storage

**File**: `packages/polychromos/src/lib/credentials.ts:1-85`

**Data Structure**:
```typescript
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
```

**Storage Location**: `~/.polychromos/credentials.json`

**Security Measures**:
- Unix: `chmod 0o600` (owner read/write only)
- Windows: `icacls` to set owner-only permissions

```typescript
if (process.platform === "win32") {
  // Windows: Use icacls to set owner-only permissions
  try {
    await execAsync(
      `icacls "${CREDENTIALS_FILE}" /inheritance:r /grant:r "%USERNAME%:F"`,
    );
  } catch {
    console.warn("⚠ Could not set Windows file permissions...");
  }
} else {
  // Unix: Use chmod (owner read/write only)
  await chmod(CREDENTIALS_FILE, 0o600);
}
```

**Environment Variable Override**:
```typescript
export async function loadCredentials(): Promise<TokenData | null> {
  // Check environment variable first (for CI/headless)
  const envToken = process.env.POLYCHROMOS_TOKEN;
  if (envToken) {
    return { accessToken: envToken };
  }
  // ... file-based loading
}
```

### 2. Token Validation and Expiry

**File**: `packages/polychromos/src/lib/credentials.ts:73-85`

```typescript
export async function getValidToken(): Promise<string> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run `polychromos login` first.");
  }

  // Check expiry if available
  if (creds.expiresAt && Date.now() > creds.expiresAt - 5 * 60 * 1000) {
    throw new Error("Token expired. Run `polychromos login` to refresh.");
  }

  return creds.accessToken;
}
```

**Behavior**:
- 5-minute buffer before actual expiry
- No automatic token refresh
- Clear error message directing user to re-login

### 3. Token Usage with Convex

**File**: `packages/polychromos/src/commands/whoami.ts:1-50`

```typescript
export async function whoamiCommand(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log("Not logged in. Run `polychromos login` to authenticate.");
    return;
  }

  const config = await loadConfig();
  // ...

  // Verify token by making an authenticated request
  const client = new ConvexHttpClient(config.convexUrl);
  client.setAuth(creds.accessToken);

  const workspaces = await client.query("workspaces:list", {});
  // ...
}
```

The token is passed directly to `ConvexHttpClient.setAuth()` for all authenticated API calls.

### 4. Logout Command

**File**: `packages/polychromos/src/commands/logout.ts:1-13`

```typescript
export async function logoutCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not currently logged in.");
    return;
  }

  await clearCredentials();
  console.log("✓ Logged out successfully.");
}
```

Simply deletes the credentials file.

### 5. Long-Running Session Token Refresh

**File**: `packages/polychromos/src/commands/dev.ts:61-70` (referenced in previous research)

The `dev` command has a periodic token refresh interval (every 45 minutes), but this only re-reads credentials from disk - it does not perform OAuth refresh.

---

## Architecture Documentation

### Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        polychromos CLI                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌───────────────┐     ┌───────────────┐  │
│  │ login.ts     │     │ credentials.ts│     │ whoami.ts     │  │
│  │              │────▶│               │◀────│               │  │
│  │ Prompts user │     │ Saves/loads   │     │ Verifies token│  │
│  │ for token    │     │ tokens to     │     │ via Convex    │  │
│  │              │     │ ~/.polychromos│     │               │  │
│  └──────────────┘     └───────────────┘     └───────────────┘  │
│                              │                      │           │
│                              │                      │           │
│                              ▼                      ▼           │
│                   ~/.polychromos/           ConvexHttpClient    │
│                   credentials.json          .setAuth(token)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        Web App                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ClerkProvider ──▶ ConvexProviderWithClerk ──▶ Convex Backend  │
│        │                                             │          │
│        │                                             │          │
│        ▼                                             ▼          │
│  __session cookie                            ctx.auth.getUserIdentity()
│  (Clerk JWT)                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/polychromos/
├── src/
│   ├── commands/
│   │   ├── login.ts      # Manual token paste flow
│   │   ├── logout.ts     # Clears credentials
│   │   ├── whoami.ts     # Verifies auth via Convex
│   │   └── dev.ts        # Uses auth for sync
│   └── lib/
│       ├── credentials.ts # Token storage/retrieval
│       └── config.ts      # Project config (convexUrl, workspaceId)
```

### Token Flow

1. **Web App Authentication**:
   - User signs in via Clerk UI
   - Clerk sets `__session` cookie (JWT)
   - ConvexProviderWithClerk passes token to Convex

2. **CLI Authentication (Current)**:
   - User manually extracts `__session` cookie value
   - Pastes into `polychromos login` prompt
   - Token stored in `~/.polychromos/credentials.json`
   - Used with `ConvexHttpClient.setAuth()` for API calls

---

## Code References

### Core Authentication Files
- `packages/polychromos/src/commands/login.ts:1-47` - Login command with manual token paste
- `packages/polychromos/src/commands/logout.ts:1-13` - Logout command
- `packages/polychromos/src/commands/whoami.ts:1-50` - Token verification via Convex
- `packages/polychromos/src/lib/credentials.ts:1-85` - Token storage and retrieval

### Token Data Interface
- `packages/polychromos/src/lib/credentials.ts:12-16` - TokenData interface definition

### Security Implementation
- `packages/polychromos/src/lib/credentials.ts:27-42` - Platform-specific file permissions

### Convex Integration
- `packages/polychromos/src/commands/whoami.ts:22-23` - ConvexHttpClient.setAuth() usage

### Test Files
- `packages/polychromos/src/lib/__tests__/credentials.test.ts` - Credentials library tests
- `packages/polychromos/src/__tests__/commands/login.test.ts` - Login command tests

---

## Historical Context (from thoughts/)

### Previous Research on Browser Auth Flow

- `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md` - Comprehensive research on CLI auth patterns:
  - Documents browser OAuth redirect flow pattern
  - Notes that Clerk does not support OAuth Device Flow (RFC 8628)
  - Proposes local callback server on port 9876
  - Includes code examples for token exchange

- `thoughts/shared/research/2026-02-03-polychromos-cli-user-experience-upgrade-path.md` - Documents current manual token flow:
  - Notes user must obtain token via `window.Clerk.session.getToken({ template: "convex" })`
  - Documents 5-minute expiry buffer check
  - Identifies lack of automatic token refresh

### Browser Auth Flow Research

The previous research (`2026-02-02-polychromos-clerk-convex-auth-integration.md`) documents a proposed browser redirect flow:

```typescript
// Proposed flow (not yet implemented)
const CALLBACK_PORT = 9876;

export async function loginCommand(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code!);
        await saveCredentials(tokens);
        // ...
      }
    });
    server.listen(CALLBACK_PORT, () => {
      open(authUrl); // Opens browser
    });
  });
}
```

This pattern is similar to what Claude Code uses:
1. CLI starts local HTTP server
2. Opens browser to auth URL with callback redirect
3. User authenticates in browser
4. Browser redirects to localhost with auth code
5. CLI exchanges code for tokens
6. CLI saves tokens and closes server

---

## Related Research

- `thoughts/shared/research/2026-02-02-polychromos-clerk-convex-auth-integration.md` - Clerk + Convex integration patterns
- `thoughts/shared/research/2026-02-03-polychromos-cli-user-experience-upgrade-path.md` - CLI UX documentation
- `thoughts/shared/research/2026-02-02-polychromos-auth-testing-strategy.md` - Authentication testing strategies
- `thoughts/shared/plans/2026-02-03-polychromos-cli-production-must-haves.md` - Production readiness items

---

## Open Questions

1. **Clerk OAuth Application**: Does Clerk support creating an OAuth application for the browser redirect flow, or is a custom auth endpoint needed on the web app?

2. **Token Type**: Should the CLI use:
   - The `__session` cookie value directly (current approach)
   - A Convex-specific token via `getToken({ template: "convex" })`
   - A long-lived API key issued by the web app

3. **Callback Port**: What port should the local callback server use? Need to handle port conflicts.

4. **Token Lifetime**: What is the actual lifetime of Clerk session tokens? Need to determine refresh requirements.

5. **Headless Environments**: How to handle CI/CD and headless environments where browser is not available? Current `POLYCHROMOS_TOKEN` env var works, but is there a better approach?

---

## Summary of Current vs. Desired State

| Aspect | Current State | Desired State (Claude Code-like) |
|--------|--------------|----------------------------------|
| **Login trigger** | User runs `polychromos login` | User runs `polychromos login` |
| **Auth initiation** | CLI prints instructions | CLI starts local server + opens browser |
| **User action** | Copy cookie from DevTools | Click "Authorize" in browser |
| **Token transfer** | Manual paste | Automatic via callback URL |
| **Browser required** | Yes (manual) | Yes (automated) |
| **Token storage** | `~/.polychromos/credentials.json` | Same |
| **Token refresh** | Manual re-login | Could add OAuth refresh |
