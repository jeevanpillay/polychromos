const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const BACKEND_PORT = process.env.CONVEX_BACKEND_PORT || 3210;
const WEB_APP_PORT = process.env.WEB_APP_PORT || 3001;
const BACKEND_URL = process.env.CONVEX_BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;
const WEB_APP_URL = process.env.WEB_APP_URL || `http://localhost:${WEB_APP_PORT}`;
const CWD = path.dirname(__dirname);

let backendProcess = null;
let webAppProcess = null;
let ownedBackend = false;
let ownedWebApp = false;

async function isBackendRunning() {
  return new Promise((resolve) => {
    const req = http.request(`${BACKEND_URL}/version`, { method: 'GET', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function isWebAppRunning() {
  return new Promise((resolve) => {
    const req = http.request(WEB_APP_URL, { method: 'GET', timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function waitFor(checkFn, name, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkFn()) {
      console.log(`[E2E] ${name} is ready`);
      return;
    }
    if (i % 10 === 0 && i > 0) {
      console.log(`[E2E] Waiting for ${name}... (${i}/${maxAttempts})`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`${name} did not start within ${maxAttempts * 0.5}s`);
}

async function startBackend() {
  if (await isBackendRunning()) {
    console.log('[E2E] Backend already running, reusing existing instance');
    ownedBackend = false;
    return;
  }

  console.log('[E2E] Starting local Convex backend...');

  // Reset data for clean state
  const { execSync } = require('child_process');
  try {
    execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'pipe' });
  } catch (e) {
    // Ignore reset errors (may not exist yet)
  }

  backendProcess = spawn('./scripts/local-backend.sh', ['run'], {
    cwd: CWD,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CONVEX_TRACE_FILE: '1' }
  });

  backendProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG) console.log(`[backend] ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG) console.error(`[backend] ${data}`);
  });

  ownedBackend = true;
  await waitFor(isBackendRunning, 'Backend');
}

async function startWebApp() {
  if (await isWebAppRunning()) {
    console.log('[E2E] Web app already running, reusing existing instance');
    ownedWebApp = false;
    return;
  }

  console.log('[E2E] Starting web app...');

  // In CI, run vite directly since env vars are passed via CI environment
  // Locally, use dev:web which loads from .vercel/.env.development.local
  const isCI = process.env.CI === 'true';
  const command = 'pnpm';
  const args = isCI ? ['exec', 'vite', 'dev'] : ['dev:web'];

  webAppProcess = spawn(command, args, {
    cwd: CWD,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_CONVEX_URL: BACKEND_URL,
      PORT: String(WEB_APP_PORT),
    },
    shell: true
  });

  // Always log output in CI to debug issues
  const shouldLog = isCI || process.env.DEBUG;
  webAppProcess.stdout.on('data', (data) => {
    if (shouldLog) console.log(`[web] ${data}`);
  });
  webAppProcess.stderr.on('data', (data) => {
    if (shouldLog) console.error(`[web] ${data}`);
  });
  webAppProcess.on('exit', (code, signal) => {
    console.error(`[E2E] Web app process exited! code=${code}, signal=${signal}`);
  });
  webAppProcess.on('error', (err) => {
    console.error(`[E2E] Web app process error:`, err.message);
  });

  ownedWebApp = true;
  await waitFor(isWebAppRunning, 'Web app', 120);
}

async function deployConvexSchema() {
  console.log('[E2E] Deploying Convex schema...');
  const { execSync } = require('child_process');
  execSync('./scripts/local-backend.sh convex deploy', {
    cwd: CWD,
    stdio: 'inherit',
    env: { ...process.env, IS_TEST: 'true' }
  });
}

function cleanup() {
  const isCI = process.env.CI === 'true';
  // In CI, use SIGKILL for immediate termination to avoid hanging
  const signal = isCI ? 'SIGKILL' : 'SIGTERM';

  if (ownedWebApp && webAppProcess) {
    console.log('[E2E] Stopping web app...');
    try {
      webAppProcess.kill(signal);
      if (!isCI) {
        // Give process a moment to exit gracefully in local dev
        const exitHandler = () => { webAppProcess = null; };
        webAppProcess.once('exit', exitHandler);
        setTimeout(() => {
          if (webAppProcess) {
            webAppProcess.kill('SIGKILL');
            webAppProcess = null;
          }
        }, 2000);
      } else {
        webAppProcess = null;
      }
    } catch (e) {
      console.log('[E2E] Web app process already exited!', e.message);
      webAppProcess = null;
    }
  }
  if (ownedBackend && backendProcess) {
    console.log('[E2E] Stopping backend...');
    try {
      backendProcess.kill(signal);
      if (!isCI) {
        // Give process a moment to exit gracefully in local dev
        const exitHandler = () => { backendProcess = null; };
        backendProcess.once('exit', exitHandler);
        setTimeout(() => {
          if (backendProcess) {
            backendProcess.kill('SIGKILL');
            backendProcess = null;
          }
        }, 2000);
      } else {
        backendProcess = null;
      }
    } catch (e) {
      console.log('[E2E] Backend process already exited!', e.message);
      backendProcess = null;
    }
  }
}

async function runE2ETests(command) {
  try {
    await startBackend();
    await deployConvexSchema();
    await startWebApp();

    console.log(`[E2E] Running: ${command}`);
    const { execSync } = require('child_process');
    execSync(command, {
      cwd: CWD,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: 'true', VITE_CONVEX_URL: BACKEND_URL }
    });

    return 0;
  } catch (error) {
    if (error.status) return error.status;
    console.error('[E2E] Error:', error.message);
    return 1;
  } finally {
    cleanup();
  }
}

// Handle signals
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

// Main - only run if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  if (!command) {
    console.error('Usage: node backendHarness.cjs <command>');
    process.exit(1);
  }

  runE2ETests(command).then(code => process.exit(code));
}

module.exports = { startBackend, startWebApp, cleanup, isBackendRunning, isWebAppRunning, deployConvexSchema };
