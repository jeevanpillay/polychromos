# polychromos

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
