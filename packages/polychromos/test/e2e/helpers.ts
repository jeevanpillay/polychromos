import { execSync, spawn, type ChildProcess } from 'child_process';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TEST_WORKSPACE_DIR, TEST_CREDENTIALS_DIR } from './setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TestWorkspace {
  dir: string;
  configDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a test workspace with CLI configuration
 */
export async function createTestWorkspace(
  workspaceId: string,
  convexUrl = 'http://127.0.0.1:3210'
): Promise<TestWorkspace> {
  const dir = join(TEST_WORKSPACE_DIR, `workspace-${Date.now()}`);
  const configDir = join(dir, '.polychromos');

  await mkdir(configDir, { recursive: true });

  // Write CLI config
  await writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({ convexUrl, workspaceId }, null, 2)
  );

  return {
    dir,
    configDir,
    cleanup: async () => {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Creates a design.json file in the workspace
 */
export async function createDesignFile(
  workspace: TestWorkspace,
  data: Record<string, unknown>
): Promise<void> {
  await writeFile(join(workspace.dir, 'design.json'), JSON.stringify(data, null, 2));
}

/**
 * Reads the design.json file from the workspace
 */
export async function readDesignFile(
  workspace: TestWorkspace
): Promise<Record<string, unknown>> {
  const content = await readFile(join(workspace.dir, 'design.json'), 'utf-8');
  return JSON.parse(content);
}

/**
 * Gets the path to the CLI binary
 */
function getCLIPath(): string {
  return join(__dirname, '../../dist/index.js');
}

/**
 * Gets environment variables for running CLI commands
 */
function getCLIEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Use POLYCHROMOS_TOKEN from setup instead of home directory credentials
    POLYCHROMOS_TOKEN: process.env.POLYCHROMOS_TOKEN,
    // Override home for any fallback credential loading
    HOME: TEST_CREDENTIALS_DIR.replace('/.polychromos-home', ''),
    POLYCHROMOS_HOME: TEST_CREDENTIALS_DIR,
  };
}

/**
 * Runs a CLI command in the test workspace
 */
export function runCLI(
  command: string,
  workspace: TestWorkspace,
  options: { timeout?: number } = {}
): string {
  const cliPath = getCLIPath();
  const env = getCLIEnv();

  try {
    return execSync(`node ${cliPath} ${command}`, {
      cwd: workspace.dir,
      env,
      encoding: 'utf-8',
      timeout: options.timeout ?? 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    // If command fails, capture and return stderr/stdout for assertion
    if (error && typeof error === 'object' && 'stdout' in error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      const output = (execError.stdout || '') + (execError.stderr || '');
      if (output) {
        return output;
      }
    }
    throw error;
  }
}

/**
 * Runs a CLI command and expects it to succeed
 */
export function runCLISuccess(
  command: string,
  workspace: TestWorkspace,
  options: { timeout?: number } = {}
): string {
  const cliPath = getCLIPath();
  const env = getCLIEnv();

  return execSync(`node ${cliPath} ${command}`, {
    cwd: workspace.dir,
    env,
    encoding: 'utf-8',
    timeout: options.timeout ?? 30000,
  });
}

export interface DevProcess {
  process: ChildProcess;
  output: string[];
  stop: () => void;
}

/**
 * Spawns the dev command for testing file watching
 */
export function spawnDevCommand(workspace: TestWorkspace): DevProcess {
  const output: string[] = [];
  const cliPath = getCLIPath();
  const env = getCLIEnv();

  const proc = spawn('node', [cliPath, 'dev'], {
    cwd: workspace.dir,
    env,
    stdio: 'pipe',
  });

  proc.stdout?.on('data', (data) => {
    const text = data.toString();
    output.push(text);
    // Uncomment for debugging:
    // console.log('[dev stdout]', text);
  });

  proc.stderr?.on('data', (data) => {
    const text = data.toString();
    output.push(text);
    // Uncomment for debugging:
    // console.log('[dev stderr]', text);
  });

  return {
    process: proc,
    output,
    stop: () => {
      proc.kill('SIGINT');
    },
  };
}

/**
 * Waits for output to contain a specific string
 */
export async function waitForOutput(
  output: string[],
  match: string | RegExp,
  timeout = 10000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const text = output.join('');
    if (typeof match === 'string' ? text.includes(match) : match.test(text)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const text = output.join('');
  throw new Error(`Timeout waiting for output: ${match}\nActual output:\n${text}`);
}

/**
 * Waits for a specific number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
