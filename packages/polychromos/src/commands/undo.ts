import { writeFile } from "fs/promises";
import { ConvexHttpClient } from "convex/browser";

import { loadConfig } from "../lib/config.js";
import { getValidToken } from "../lib/credentials.js";

interface UndoResult {
  success: boolean;
  message?: string;
  data?: unknown;
  previousVersion?: number;
  currentVersion?: number;
}

export async function undoCommand(): Promise<void> {
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
    const result = (await client.mutation("workspaces:undo" as never, {
      id: config.workspaceId,
    } as never)) as UndoResult;

    if (!result.success) {
      console.log(result.message);
      return;
    }

    // Write updated state to design.json
    await writeFile(
      "design.json",
      JSON.stringify(result.data, null, 2),
      "utf-8",
    );

    console.log(
      `✓ Undone: v${result.previousVersion} → v${result.currentVersion}`,
    );
  } catch (error) {
    console.error(
      "Undo failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
