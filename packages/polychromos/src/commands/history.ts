import { ConvexHttpClient } from "convex/browser";

import { loadConfig } from "../lib/config.js";
import { getValidToken } from "../lib/credentials.js";

interface EventEntry {
  version: number;
  timestamp: number;
  patches: { op: string; path: string; value?: unknown }[];
}

interface Workspace {
  eventVersion: number;
  maxEventVersion: number;
}

export async function historyCommand(): Promise<void> {
  const config = await loadConfig();

  if (!config) {
    console.error("No Convex configuration found.");
    console.error("Run 'polychromos dev' first to set up syncing.");
    process.exit(1);
  }

  const token = await getValidToken();
  const client = new ConvexHttpClient(config.convexUrl);
  client.setAuth(token);

  try {
    const [workspace, history] = await Promise.all([
      client.query("workspaces:get" as never, {
        id: config.workspaceId,
      } as never) as Promise<Workspace | null>,
      client.query("events:getHistory" as never, {
        workspaceId: config.workspaceId,
      } as never) as Promise<EventEntry[]>,
    ]);

    if (!workspace) {
      console.error("Workspace not found.");
      process.exit(1);
    }

    if (history.length === 0) {
      console.log("No version history found.");
      console.log("Make some changes to start tracking.");
      return;
    }

    console.log("Version History");
    console.log("===============");
    console.log("");

    for (const entry of history) {
      const date = new Date(entry.timestamp);
      const timestamp = date.toLocaleString();
      const patchCount = entry.patches.length;
      const isCurrent = entry.version === workspace.eventVersion;
      const marker = isCurrent ? " ← current" : "";

      console.log(
        `  v${entry.version}  ${timestamp}  (${patchCount} change${patchCount !== 1 ? "s" : ""})${marker}`,
      );
    }

    console.log("");
    console.log(
      `Current: v${workspace.eventVersion} / Max: v${workspace.maxEventVersion}`,
    );
  } catch (error) {
    console.error(
      "Failed to fetch history:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
