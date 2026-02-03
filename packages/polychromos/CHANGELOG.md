# polychromos

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
