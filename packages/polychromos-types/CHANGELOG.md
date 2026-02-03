# @polychromos/types

## 0.1.0-alpha.3

### Patch Changes

- [`558dbe4`](https://github.com/jeevanpillay/polychromos/commit/558dbe42dd236afe70b4db812080e5e84baa3e3b) Thanks [@claude](https://github.com/claude)! - fix: resolve workspace:\* protocol during npm publish

  Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:*` protocol. This caused the published `polychromos` package to contain `"@polychromos/types": "workspace:*"` which npm cannot resolve.

  This release:
  - Fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies
  - `@polychromos/types` dependency is now correctly published as `"@polychromos/types": "0.1.0-alpha.1"`

  Installation should now work:

  ```
  npm install polychromos@alpha
  ```

## 0.1.0-alpha.2

### Patch Changes

- Bump version to match polychromos CLI release

## 0.1.0-alpha.1

### Patch Changes

- fix: resolve workspace:\* protocol during npm publish

  Accompanies the polychromos CLI fix for proper workspace dependency resolution during publish.

## 0.1.0-alpha.0

### Patch Changes

- Initial alpha release of Polychromos design system
