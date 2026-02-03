---
"polychromos": patch
"@polychromos/types": patch
---

fix: resolve workspace:* protocol during npm publish

Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:*` protocol. This caused the published `polychromos` package to contain `"@polychromos/types": "workspace:*"` which npm cannot resolve.

This release:
- Fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies
- `@polychromos/types` dependency is now correctly published as `"@polychromos/types": "0.1.0-alpha.1"`

Installation should now work:
```
npm install polychromos@alpha
```
