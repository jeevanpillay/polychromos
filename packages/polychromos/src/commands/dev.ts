import { readFile } from "fs/promises";
import chokidar from "chokidar";
import { ConvexHttpClient } from "convex/browser";

import { VersionManager } from "../lib/version-manager.js";
import { loadConfig } from "../lib/config.js";

let pendingMutation: Promise<void> | null = null;
let pendingData: unknown = null;

export async function devCommand(): Promise<void> {
  const versionManager = new VersionManager(".polychromos");
  const config = await loadConfig();

  // Initialize version manager
  await versionManager.init();

  console.log("Polychromos CLI v1.0.0");
  if (config) {
    console.log(`Convex URL: ${config.convexUrl}`);
    console.log(`Workspace ID: ${config.workspaceId}`);
  } else {
    console.log("No Convex configuration found - syncing locally only");
    console.log(
      'Run "polychromos init <name>" first, or create .polychromos/config.json',
    );
  }
  console.log("");

  // Create Convex client if configured
  const convexClient = config ? new ConvexHttpClient(config.convexUrl) : null;
  let currentVersion = 1;

  const syncWithSingleFlight = async (data: unknown): Promise<void> => {
    pendingData = data;
    if (pendingMutation) return;

    while (pendingData) {
      const toSync = pendingData;
      pendingData = null;

      try {
        pendingMutation = (async () => {
          const time = new Date().toLocaleTimeString();
          console.log(`[${time}] Syncing design...`);

          // Record locally first
          await versionManager.recordChange(toSync);

          // Sync to Convex if configured
          if (convexClient && config) {
            try {
              await convexClient.mutation("workspaces:update" as never, {
                id: config.workspaceId,
                data: toSync,
                expectedVersion: currentVersion,
              } as never);
              currentVersion++;
              console.log(
                `✓ Synced to Convex (v${versionManager.getVersion()})`,
              );
            } catch (convexError) {
              if (
                convexError instanceof Error &&
                convexError.message.includes("Version conflict")
              ) {
                console.error(
                  "✗ Conflict detected - please reload to get latest version",
                );
              } else {
                // Log Convex error but continue with local sync
                console.warn(
                  "⚠ Convex sync failed (local changes saved):",
                  convexError instanceof Error
                    ? convexError.message
                    : convexError,
                );
              }
            }
          } else {
            console.log(`✓ Synced locally (v${versionManager.getVersion()})`);
          }
        })();

        await pendingMutation;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Version conflict")
        ) {
          console.error(
            "✗ Conflict detected - please reload to get latest version",
          );
        } else {
          console.error("✗ Sync failed:", error);
        }
      } finally {
        pendingMutation = null;
      }
    }
  };

  const watcher = chokidar.watch("design.json", {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  const handleChange = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const content = await readFile("design.json", "utf-8");
          const data: unknown = JSON.parse(content);
          await syncWithSingleFlight(data);
        } catch (error) {
          console.error("✗ Error reading file:", error);
        }
      })();
    }, 300);
  };

  watcher.on("change", handleChange);

  watcher.on("error", (error) => {
    console.error("Watcher error:", error);
  });

  console.log("Watching design.json for changes...");
  console.log("Press Ctrl+C to stop");
  console.log("");
}
