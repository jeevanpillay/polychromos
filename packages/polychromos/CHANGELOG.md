# polychromos

## 0.1.0-alpha.3

### Patch Changes

- [`0c11b81`](https://github.com/jeevanpillay/polychromos/commit/0c11b81ed079f7bdda8f4293fcbaa4e02a334b9e) Thanks [@claude](https://github.com/claude)! - fix: update production Convex URL to correct deployment

  The CLI was pointing to the wrong Convex backend URL (`dainty-toucan-799.convex.cloud`), causing login and other backend operations to fail. Updated to the correct production URL (`pleasant-ox-89.convex.cloud`).

- [`558dbe4`](https://github.com/jeevanpillay/polychromos/commit/558dbe42dd236afe70b4db812080e5e84baa3e3b) Thanks [@claude](https://github.com/claude)! - fix: resolve workspace:\* protocol during npm publish

  Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:*` protocol. This caused the published `polychromos` package to contain `"@polychromos/types": "workspace:*"` which npm cannot resolve.

  This release:
  - Fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies
  - `@polychromos/types` dependency is now correctly published as `"@polychromos/types": "0.1.0-alpha.1"`

  Installation should now work:

  ```
  npm install polychromos@alpha
  ```

- Updated dependencies [[`558dbe4`](https://github.com/jeevanpillay/polychromos/commit/558dbe42dd236afe70b4db812080e5e84baa3e3b)]:
  - @polychromos/types@0.1.0-alpha.3

## 0.1.0-alpha.2

### Patch Changes

- fix: update production Convex URL to correct deployment

  The CLI was pointing to the wrong Convex backend URL (`dainty-toucan-799.convex.cloud`), causing login and other backend operations to fail. Updated to the correct production URL (`pleasant-ox-89.convex.cloud`).

- Updated dependencies:
  - @polychromos/types@0.1.0-alpha.2

## 0.1.0-alpha.1

### Patch Changes

- fix: resolve workspace:\* protocol during npm publish

  Previously, the release workflow used `npm publish` which does not understand pnpm's `workspace:\*` protocol. This caused the published package to contain an unresolvable dependency.

  This release fixes the publish workflow to use `pnpm publish` which properly resolves workspace dependencies.

- Updated dependencies:
  - @polychromos/types@0.1.0-alpha.1

## 0.1.0-alpha.0

### Patch Changes

- Initial alpha release of Polychromos design system

- Updated dependencies []:
  - @polychromos/types@0.1.0-alpha.0
