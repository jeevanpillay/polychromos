#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');

const CWD = path.dirname(__dirname);
const BACKEND_URL = 'http://127.0.0.1:3210';

// Import backend management from refactored harness
const { startBackend, startWebApp, cleanup, deployConvexSchema } = require('./backendHarness.cjs');

async function runCommand(name, command, args = [], options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[E2E] ${name}`);
  console.log('='.repeat(60));

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, VITE_CONVEX_URL: BACKEND_URL },
      shell: true,
      ...options
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${name} failed with code ${code}`));
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0 || args.includes('--all');
  const runBrowser = runAll || args.includes('--browser');
  const runCli = runAll || args.includes('--cli');
  const runCrossPlatform = runAll || args.includes('--cross-platform');
  const skipSetup = args.includes('--skip-setup');

  try {
    // Start infrastructure
    await startBackend();

    // Deploy schema with environment variables
    console.log('\n[E2E] Deploying Convex schema...');
    execSync('./scripts/local-backend.sh convex env set IS_TEST true', {
      cwd: CWD,
      stdio: 'inherit'
    });
    if (process.env.CLERK_JWT_ISSUER_DOMAIN) {
      execSync(`./scripts/local-backend.sh convex env set CLERK_JWT_ISSUER_DOMAIN "${process.env.CLERK_JWT_ISSUER_DOMAIN}"`, {
        cwd: CWD,
        stdio: 'inherit'
      });
    } else {
      console.warn('\n[E2E] WARNING: CLERK_JWT_ISSUER_DOMAIN not set - Clerk auth may fail!');
      console.warn('[E2E] Make sure this env var is set in your .vercel/.env.development.local or CI environment\n');
    }
    execSync('./scripts/local-backend.sh convex deploy', {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, IS_TEST: 'true', VITE_CONVEX_URL: BACKEND_URL }
    });

    await startWebApp();

    // Run Playwright auth setup (unless skipped)
    if (!skipSetup) {
      await runCommand(
        'Playwright Auth Setup',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=setup']
      );
    }

    // Run browser tests
    if (runBrowser) {
      await runCommand(
        'Browser E2E Tests',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=chromium', '--project=unauthenticated']
      );
    }

    // Run CLI E2E tests
    if (runCli) {
      await runCommand(
        'CLI E2E Tests',
        'pnpm',
        ['--filter', 'polychromos', 'test:e2e'],
        { cwd: path.dirname(CWD) } // Run from monorepo root
      );
    }

    // Run cross-platform tests
    if (runCrossPlatform) {
      await runCommand(
        'Cross-Platform E2E Tests',
        'pnpm',
        ['exec', 'playwright', 'test', '--project=cross-platform']
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('[E2E] All tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n[E2E] Test suite failed:', error.message);
    process.exit(1);
  } finally {
    cleanup();
  }
}

// Handle signals
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

main();
