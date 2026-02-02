#!/usr/bin/env node
/**
 * Syncs Convex environment variables from .env.local to .vercel/.env.development.local
 * This allows us to maintain a single source of truth in the .vercel directory
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

const ENV_LOCAL = ".env.local";
const VERCEL_ENV = ".vercel/.env.development.local";
const CONVEX_VARS = ["CONVEX_DEPLOYMENT", "VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"];

function syncEnv() {
  if (!existsSync(ENV_LOCAL)) {
    console.log("No .env.local found, skipping sync");
    return;
  }

  if (!existsSync(VERCEL_ENV)) {
    console.error(`${VERCEL_ENV} not found`);
    process.exit(1);
  }

  // Read source and extract Convex vars
  const source = readFileSync(ENV_LOCAL, "utf8");
  const convexLines = [];
  for (const varName of CONVEX_VARS) {
    const match = source.match(new RegExp(`^${varName}=.*`, "m"));
    if (match) {
      convexLines.push(match[0]);
    }
  }

  if (convexLines.length === 0) {
    console.log("No Convex variables found in .env.local");
    return;
  }

  // Read destination and filter out old Convex vars
  const dest = readFileSync(VERCEL_ENV, "utf8");
  const filteredLines = dest
    .split("\n")
    .filter((line) => !CONVEX_VARS.some((v) => line.startsWith(`${v}=`)))
    .filter((line) => !line.includes("# Convex Local Development"));

  // Remove trailing empty lines and add Convex section
  const cleanedDest = filteredLines.join("\n").trimEnd();
  const newContent = `${cleanedDest}

# Convex Local Development (synced from .env.local)
${convexLines.join("\n")}
`;

  writeFileSync(VERCEL_ENV, newContent);
  console.log(`Synced Convex vars to ${VERCEL_ENV}`);
}

syncEnv();
