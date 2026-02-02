import { readFile } from "fs/promises";
import chokidar from "chokidar";
import { ConvexHttpClient } from "convex/browser";

import { loadConfig } from "../lib/config.js";
import { getValidToken } from "../lib/credentials.js";

let pendingMutation: Promise<void> | null = null;
let pendingData: unknown = null;

export async function devCommand(): Promise<void> {
  const config = await loadConfig();

  console.log("Polychromos CLI v1.0.0");
  if (!config) {
    console.log("No Convex configuration found.");
    console.log('Run "polychromos init <name>" first to set up syncing.');
    process.exit(1);
  }

  // Require authentication
  let token: string;
  try {
    token = await getValidToken();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Authentication required");
    process.exit(1);
  }

  console.log(`Convex URL: ${config.convexUrl}`);
  console.log(`Workspace ID: ${config.workspaceId}`);
  console.log("✓ Authenticated");
  console.log("");

  // Create authenticated Convex client
  const convexClient = new ConvexHttpClient(config.convexUrl);
  convexClient.setAuth(token);

  let currentVersion = 1;
  let eventVersion = 0;

  // Fetch current workspace state to get version
  try {
    const workspace = (await convexClient.query("workspaces:get" as never, {
      id: config.workspaceId,
    } as never)) as { version: number; eventVersion: number } | null;
    if (workspace) {
      currentVersion = workspace.version;
      eventVersion = workspace.eventVersion;
    } else {
      console.warn("⚠ Workspace not found or access denied");
    }
  } catch (error) {
    console.warn(
      "⚠ Could not fetch workspace state:",
      error instanceof Error ? error.message : error,
    );
  }

  // Refresh token periodically for long sessions
  const tokenRefreshInterval = setInterval(() => {
    void (async () => {
      try {
        const newToken = await getValidToken();
        convexClient.setAuth(newToken);
      } catch {
        console.warn("⚠ Token refresh failed. You may need to re-login.");
      }
    })();
  }, 45 * 60 * 1000); // Every 45 minutes

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

          try {
            const result = (await convexClient.mutation(
              "workspaces:update" as never,
              {
                id: config.workspaceId,
                data: toSync,
                expectedVersion: currentVersion,
              } as never,
            )) as { success: boolean; noChanges?: boolean };

            if (result.noChanges) {
              console.log(`✓ No changes detected`);
            } else {
              currentVersion++;
              eventVersion++;
              console.log(`✓ Synced to Convex (event v${eventVersion})`);
            }
          } catch (convexError) {
            if (
              convexError instanceof Error &&
              convexError.message.includes("Version conflict")
            ) {
              console.error(
                "✗ Conflict detected - please reload to get latest version",
              );
            } else if (
              convexError instanceof Error &&
              convexError.message.includes("Unauthenticated")
            ) {
              console.error("✗ Authentication expired. Run `polychromos login`");
            } else if (
              convexError instanceof Error &&
              convexError.message.includes("Access denied")
            ) {
              console.error("✗ Access denied to this workspace");
            } else {
              console.error(
                "✗ Sync failed:",
                convexError instanceof Error
                  ? convexError.message
                  : convexError,
              );
            }
          }
        })();

        await pendingMutation;
      } catch (error) {
        console.error("✗ Sync failed:", error);
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

  process.on("SIGINT", () => {
    clearInterval(tokenRefreshInterval);
    process.exit(0);
  });
}
