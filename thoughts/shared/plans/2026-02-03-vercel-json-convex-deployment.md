# Vercel.json Override for Convex Deployment Implementation Plan

## Overview

Create a `vercel.json` configuration file for `apps/polychromos-app` to enable automatic Convex function deployment alongside the frontend build on Vercel. This ensures Convex backend functions are deployed whenever the app is deployed.

## Current State Analysis

**What exists:**
- `apps/polychromos-app/.vercel/project.json` - Framework detected as `tanstack-start`, all build commands `null` (uses defaults)
- `apps/polychromos-app/convex.json` - Convex team: `polychromos`, project: `polychromos-mvp`
- `apps/polychromos-app/package.json:13` - Build command: `"build": "vite build"`
- No `vercel.json` file exists

**Current deployment flow problem:**
```
Vercel Build → vite build → Frontend deployed
                          → Convex functions NOT deployed ❌
```

**Required deployment flow:**
```
Vercel Build → npx convex deploy --cmd 'pnpm run build'
             → Convex functions deployed ✅
             → Frontend built with correct CONVEX_URL ✅
             → Frontend deployed ✅
```

### Key Discoveries:
- Build command in `package.json:13` is `vite build`
- Nitro plugin at `vite.config.ts:19` has no explicit preset (auto-detects Vercel)
- User has already configured `CONVEX_DEPLOY_KEY` for both production and preview environments in Vercel
- Clerk requires custom domains for production (cannot use `*.vercel.app`)

## Desired End State

After this plan is complete:
1. A `vercel.json` file exists at `apps/polychromos-app/vercel.json`
2. Vercel builds trigger Convex deployment before frontend build
3. Both production and preview deployments work correctly
4. Environment variables are properly documented

**Verification:**
- Vercel deployment logs show `npx convex deploy` executing before `pnpm run build`
- Convex Dashboard shows functions deployed matching the deployed commit
- Frontend connects to the correct Convex deployment URL

## What We're NOT Doing

- **Not modifying Clerk configuration** - Custom domain setup is out of scope (separate concern)
- **Not changing the Nitro/Vite build configuration** - Auto-detection works fine
- **Not modifying CI/CD pipelines** - This is Vercel-specific configuration
- **Not setting up environment variables** - User confirmed these are already configured

## Implementation Approach

Single-phase implementation: Create the `vercel.json` file with the build command override.

---

## Phase 1: Create vercel.json Configuration

### Overview
Create `apps/polychromos-app/vercel.json` to override the build command with Convex deployment.

### Changes Required:

#### 1. Create vercel.json
**File**: `apps/polychromos-app/vercel.json`
**Action**: Create new file

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx convex deploy --cmd 'pnpm run build'"
}
```

**Explanation:**
- `$schema` - Provides IDE autocomplete and validation
- `buildCommand` - Overrides the default build command
- Uses `pnpm run build` (not `npm run build`) since this monorepo uses pnpm
- `npx convex deploy` reads `CONVEX_DEPLOY_KEY` and sets `CONVEX_URL` before running the build

### Success Criteria:

#### Automated Verification:
- [ ] File exists: `ls apps/polychromos-app/vercel.json`
- [ ] JSON is valid: `cat apps/polychromos-app/vercel.json | jq .`
- [ ] Local build still works: `pnpm --filter @polychromos/app build`

#### Manual Verification:
- [ ] Deploy to Vercel preview environment
- [ ] Check Vercel build logs show Convex deployment step
- [ ] Verify Convex Dashboard shows updated deployment
- [ ] Verify frontend loads and connects to Convex backend
- [ ] Deploy to Vercel production environment
- [ ] Verify production Convex deployment is updated

**Implementation Note**: After completing automated verification, deploy to a preview branch first to validate the configuration works before merging to main.

---

## Environment Variable Reference

These environment variables should already be configured in Vercel (user confirmed):

### Production Environment
| Variable | Description | Source |
|----------|-------------|--------|
| `CONVEX_DEPLOY_KEY` | Production deploy key | Convex Dashboard → Project Settings → Generate Production Deploy Key |
| `VITE_CONVEX_URL` | Auto-set by `npx convex deploy` | N/A (set during build) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk production publishable key | Clerk Dashboard |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer for Convex auth | Clerk Dashboard |

### Preview Environment
| Variable | Description | Source |
|----------|-------------|--------|
| `CONVEX_DEPLOY_KEY` | Preview deploy key | Convex Dashboard → Generate Preview Deploy Key |
| `VITE_CONVEX_URL` | Auto-set by `npx convex deploy` | N/A (set during build) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk development publishable key | Clerk Dashboard (development instance) |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer (development) | Clerk Dashboard (development instance) |

---

## Clerk Preview Deployment Notes

Based on research, Clerk has specific requirements for preview deployments:

### Option 1: Independent Preview Environment (Recommended)
- Use Clerk **development** API keys for Vercel preview deployments
- Preview deployments use `*.vercel.app` domains
- Users/sessions are separate from production
- **Limitation**: Cannot share production user data

### Option 2: Shared Production Data (Vercel Pro/Enterprise only)
- Use Vercel's "Preview Deployment Suffix" feature
- Host previews on subdomain of production domain (e.g., `preview.yourapp.com`)
- Share production Clerk API keys
- Requires custom domain configuration

### Production Requirement
- Clerk production API keys **cannot** be used with `*.vercel.app` domains
- A custom domain must be configured for production deployment

---

## Testing Strategy

### Pre-Deployment Test
1. Run local build to ensure no regressions:
   ```bash
   pnpm --filter @polychromos/app build
   ```

### Preview Deployment Test
1. Create a test branch and push to trigger Vercel preview
2. Check Vercel build logs for:
   - `npx convex deploy` command execution
   - Convex deployment success message
   - `pnpm run build` execution
3. Visit preview URL and verify:
   - App loads without errors
   - Console shows no Convex connection errors
   - Can create/read data (if applicable)

### Production Deployment Test
1. Merge to main branch
2. Monitor Vercel production deployment logs
3. Verify production Convex deployment updated in Convex Dashboard
4. Test production URL functionality

---

## Rollback Plan

If issues occur after deployment:

1. **Revert vercel.json**: Delete the file or revert the commit
2. **Manual Convex deploy**: Run `npx convex deploy --prod` from local machine
3. **Vercel redeploy**: Trigger new deployment without the build override

---

## References

- Research document: `thoughts/shared/research/2026-02-03-vercel-json-convex-deployment-configuration.md`
- Convex Vercel hosting docs: https://docs.convex.dev/production/hosting/vercel
- Clerk preview environment docs: https://clerk.com/docs/deployments/set-up-preview-environment
- Clerk Vercel deployment docs: https://clerk.com/docs/deployments/vercel
- Current build config: `apps/polychromos-app/package.json:13`
- Vercel project config: `apps/polychromos-app/.vercel/project.json`
- Convex project config: `apps/polychromos-app/convex.json`
