#!/usr/bin/env node
/**
 * Sets up Convex local development:
 * 1. Starts convex backend in background
 * 2. Waits for it to be ready
 * 3. Sets required environment variables
 * 4. Syncs env vars to .vercel/.env.development.local
 */
import { spawn, execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";

const VERCEL_ENV = ".vercel/.env.development.local";
const ENV_LOCAL = ".env.local";
const CONVEX_URL = "http://127.0.0.1:3210";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(CONVEX_URL);
      if (response.ok || response.status === 426) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(500);
    process.stdout.write(".");
  }
  return false;
}

async function main() {
  // Check if backend is already running
  try {
    const response = await fetch(CONVEX_URL);
    if (response.ok || response.status === 426) {
      console.log("Convex backend already running, setting env vars...");
      setEnvVars();
      syncEnv();
      return;
    }
  } catch {
    // Not running, need to start it
  }

  console.log("Starting Convex local backend...");

  // Start convex dev in background
  const convex = spawn("npx", ["convex", "dev", "--once", "--typecheck", "disable", "--codegen", "disable"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  convex.stdout.on("data", (data) => process.stdout.write(data));
  convex.stderr.on("data", (data) => process.stderr.write(data));

  // Wait for backend to be ready
  process.stdout.write("Waiting for backend");
  const ready = await waitForBackend();
  console.log("");

  if (!ready) {
    console.error("Backend failed to start in time, but continuing...");
  }

  // Give it a moment to fully initialize
  await sleep(1000);

  // Set environment variables
  setEnvVars();

  // Wait for convex process to exit
  await new Promise((resolve) => {
    convex.on("close", resolve);
    // If it doesn't exit in 5 seconds, kill it
    setTimeout(() => {
      convex.kill();
      resolve();
    }, 5000);
  });

  // Sync env vars
  syncEnv();

  console.log("Setup complete!");
}

function setEnvVars() {
  if (!existsSync(VERCEL_ENV)) {
    console.error(`${VERCEL_ENV} not found`);
    return;
  }

  const content = readFileSync(VERCEL_ENV, "utf8");
  const lines = content.split("\n");

  // Skip these - they're client-side only or Convex-managed
  const skipVars = [
    "VITE_",           // Client-side vars
    "CONVEX_",         // Convex-managed vars
    "VERCEL_OIDC_TOKEN", // Vercel internal
  ];

  for (const line of lines) {
    // Skip comments and empty lines
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*)["']?$/);
    if (!match) continue;

    const [, key, value] = match;

    // Skip vars that shouldn't be set in Convex
    if (skipVars.some((skip) => key.startsWith(skip))) continue;

    // Clean up the value (remove surrounding quotes if present)
    const cleanValue = value.replace(/^["']|["']$/g, "");

    try {
      execSync(`npx convex env set ${key} "${cleanValue}"`, {
        stdio: "inherit",
      });
    } catch (e) {
      console.error(`Failed to set ${key}:`, e.message);
    }
  }
}

function syncEnv() {
  if (!existsSync(ENV_LOCAL)) {
    console.log("No .env.local found, skipping sync");
    return;
  }

  if (!existsSync(VERCEL_ENV)) {
    console.error(`${VERCEL_ENV} not found`);
    return;
  }

  const CONVEX_VARS = ["CONVEX_DEPLOYMENT", "VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"];

  const source = readFileSync(ENV_LOCAL, "utf8");
  const convexLines = [];
  for (const varName of CONVEX_VARS) {
    const match = source.match(new RegExp(`^${varName}=.*`, "m"));
    if (match) {
      convexLines.push(match[0]);
    }
  }

  if (convexLines.length === 0) {
    return;
  }

  const dest = readFileSync(VERCEL_ENV, "utf8");
  const filteredLines = dest
    .split("\n")
    .filter((line) => !CONVEX_VARS.some((v) => line.startsWith(`${v}=`)))
    .filter((line) => !line.includes("# Convex Local Development"));

  const cleanedDest = filteredLines.join("\n").trimEnd();
  const newContent = `${cleanedDest}

# Convex Local Development (synced from .env.local)
${convexLines.join("\n")}
`;

  writeFileSync(VERCEL_ENV, newContent);
  console.log(`Synced Convex vars to ${VERCEL_ENV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
