# Release Process

## Overview

The `polychromos` CLI is published to npm automatically using Changesets and GitHub Actions.

## Creating a Release

1. **Make your changes** to `packages/polychromos` or `packages/polychromos-types`

2. **Create a changeset**:
   ```bash
   pnpm changeset
   ```
   - Select the packages that changed
   - Choose the version bump type (patch/minor/major)
   - Write a summary of the changes

3. **Commit and push** your changes with the changeset file

4. **Create a PR** and get it reviewed

5. **Merge to main** - this triggers the Changesets workflow

6. **Merge "Version Packages" PR** - a PR will be automatically created
   - Review the version bumps and changelog
   - Merge to trigger the release

7. **Verify the release**:
   ```bash
   npm view polychromos
   npm install -g polychromos
   polychromos --version
   ```

## Required Secrets

The following secrets must be configured in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm access token with publish permissions |

### Creating an npm token

1. Go to https://www.npmjs.com/settings/~/tokens
2. Click "Generate New Token" > "Granular Access Token"
3. Name: `polychromos-github-actions`
4. Expiration: Set appropriate expiration
5. Packages and scopes: Select "Read and write"
6. Select packages: `polychromos`
7. Copy the token and add to GitHub secrets

## Version Strategy

- `polychromos` and `@polychromos/types` are versioned together (fixed)
- Both packages always have the same version number
- Only `polychromos` is published to npm
- `@polychromos/types` remains an internal workspace dependency

## Troubleshooting

### Release didn't trigger
- Check the commit message contains "version packages"
- Verify `packages/polychromos/package.json` was modified
- Check GitHub Actions logs for errors

### npm publish failed
- Verify `NPM_TOKEN` secret is set correctly
- Check token has publish permissions
- Ensure package name `polychromos` is available
