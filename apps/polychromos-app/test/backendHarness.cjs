const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');

const BACKEND_URL = new URL('http://127.0.0.1:3210');
const CWD = path.dirname(__dirname);

async function isBackendRunning() {
  return new Promise((resolve) => {
    http
      .request(
        {
          hostname: BACKEND_URL.hostname,
          port: BACKEND_URL.port,
          path: '/version',
          method: 'GET',
        },
        (res) => resolve(res.statusCode === 200)
      )
      .on('error', () => resolve(false))
      .end();
  });
}

async function waitForBackend(maxAttempts = 60) {
  let running = await isBackendRunning();
  let attempts = 0;
  while (!running && attempts < maxAttempts) {
    if (attempts % 10 === 0) console.log('Waiting for backend...');
    await new Promise((r) => setTimeout(r, 500));
    running = await isBackendRunning();
    attempts++;
  }
  if (!running) throw new Error('Backend failed to start');
}

let backendProcess = null;

function cleanup() {
  if (backendProcess) {
    console.log('Cleaning up backend');
    backendProcess.kill('SIGTERM');
    try {
      execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function runWithLocalBackend(command) {
  if (await isBackendRunning()) {
    console.error('Backend already running. Stop it first.');
    process.exit(1);
  }

  try {
    execSync('./scripts/local-backend.sh reset', { cwd: CWD, stdio: 'ignore' });
  } catch {
    // Ignore if no data to reset
  }

  backendProcess = spawn('./scripts/local-backend.sh', ['run'], {
    cwd: CWD,
    stdio: 'pipe',
    env: { ...process.env, CONVEX_TRACE_FILE: '1' },
  });

  await waitForBackend();
  console.log('Backend running! Starting tests...');

  const testProcess = spawn(command, {
    shell: true,
    stdio: 'inherit',
    cwd: CWD,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  return new Promise((resolve) => {
    testProcess.on('exit', (code) => {
      console.log(`Tests exited with code ${code}`);
      resolve(code);
    });
  });
}

// Main
runWithLocalBackend(process.argv[2])
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch(() => {
    cleanup();
    process.exit(1);
  });

process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});
