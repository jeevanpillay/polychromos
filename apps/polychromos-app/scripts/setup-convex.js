#!/usr/bin/env node
/**
 * Sets up Convex local development:
 * 1. Starts local convex backend (downloads binary if needed)
 * 2. Waits for it to be ready
 * 3. Deploys schema and functions
 * 4. Sets required environment variables
 */
import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.dirname(__dirname);

const VERCEL_ENV = ".vercel/.env.development.local";
const BACKEND_URL = "http://127.0.0.1:3210";
const LOCAL_BACKEND_SCRIPT = "./scripts/local-backend.sh";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendRunning() {
  try {
    const response = await fetch(`${BACKEND_URL}/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend(maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isBackendRunning()) {
      return true;
    }
    await sleep(500);
    if (i % 10 === 0 && i > 0) {
      process.stdout.write(".");
    }
  }
  return false;
}

async function startBackend() {
  // Check if already running
  if (await isBackendRunning()) {
    console.log("Convex backend already running");
    return null;
  }

  console.log("Starting Convex local backend...");

  // Spawn local-backend.sh run in background
  const backend = spawn(LOCAL_BACKEND_SCRIPT, ["run"], {
    cwd: APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // Log output for debugging but don't block
  backend.stdout.on("data", (data) => {
    const line = data.toString().trim();
    if (line.includes("Downloading") || line.includes("ready")) {
      console.log(line);
    }
  });
  backend.stderr.on("data", (data) => {
    console.error(data.toString());
  });

  // Don't wait for process - let it run in background
  backend.unref();

  // Wait for backend to be ready
  process.stdout.write("Waiting for backend to be ready");
  const ready = await waitForBackend();
  console.log("");

  if (!ready) {
    console.error("Backend failed to start in time");
    process.exit(1);
  }

  console.log("Backend is ready!");
  return backend;
}

function deploySchema() {
  console.log("Deploying Convex schema and functions...");
  try {
    execSync(`${LOCAL_BACKEND_SCRIPT} convex deploy`, {
      cwd: APP_DIR,
      stdio: "inherit",
    });
  } catch (e) {
    console.error("Failed to deploy schema:", e.message);
    process.exit(1);
  }
}

function setEnvVars() {
  const vercelEnvPath = path.join(APP_DIR, VERCEL_ENV);
  if (!existsSync(vercelEnvPath)) {
    console.log(`${VERCEL_ENV} not found, skipping env var setup`);
    return;
  }

  console.log("Setting Convex environment variables...");
  const content = readFileSync(vercelEnvPath, "utf8");
  const lines = content.split("\n");

  // Skip these - they're client-side only or Convex-managed
  const skipVars = [
    "VITE_", // Client-side vars
    "CONVEX_", // Convex-managed vars
    "VERCEL_OIDC_TOKEN", // Vercel internal
    "E2E_", // Test-only vars
  ];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*)["']?$/);
    if (!match) continue;

    const [, key, value] = match;
    if (skipVars.some((skip) => key.startsWith(skip))) continue;

    const cleanValue = value.replace(/^["']|["']$/g, "");

    try {
      execSync(`${LOCAL_BACKEND_SCRIPT} convex env set ${key} "${cleanValue}"`, {
        cwd: APP_DIR,
        stdio: "pipe",
      });
    } catch {
      // Ignore errors for individual env vars
    }
  }
}

function writeLocalEnvFile() {
  // Write/update .env.local with local backend URLs
  const envContent = `# Auto-generated for local Convex development
CONVEX_DEPLOYMENT=local
VITE_CONVEX_URL=${BACKEND_URL}
`;

  const envLocalPath = path.join(APP_DIR, ".env.local");
  writeFileSync(envLocalPath, envContent);
  console.log("Updated .env.local with local backend URLs");

  // Also update .vercel/.env.development.local if it exists
  const vercelEnvPath = path.join(APP_DIR, VERCEL_ENV);
  if (existsSync(vercelEnvPath)) {
    let vercelContent = readFileSync(vercelEnvPath, "utf8");

    // Remove existing Convex vars
    const convexVars = ["CONVEX_DEPLOYMENT", "VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"];
    vercelContent = vercelContent
      .split("\n")
      .filter((line) => !convexVars.some((v) => line.startsWith(`${v}=`)))
      .filter((line) => !line.includes("# Convex Local Development"))
      .join("\n")
      .trimEnd();

    vercelContent += `

# Convex Local Development
CONVEX_DEPLOYMENT=local
VITE_CONVEX_URL=${BACKEND_URL}
`;

    writeFileSync(vercelEnvPath, vercelContent);
    console.log(`Updated ${VERCEL_ENV} with local backend URLs`);
  }
}

async function main() {
  await startBackend();
  deploySchema();
  setEnvVars();
  writeLocalEnvFile();
  console.log("\nSetup complete! Backend running at " + BACKEND_URL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
