import { writeFile } from "fs/promises";
import { ConvexHttpClient } from "convex/browser";

import { loadConfig } from "../lib/config.js";
import { getValidToken } from "../lib/credentials.js";

interface RedoResult {
  success: boolean;
  message?: string;
  data?: unknown;
  previousVersion?: number;
  currentVersion?: number;
}

export async function redoCommand(): Promise<void> {
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
    const result = (await client.mutation("workspaces:redo" as never, {
      id: config.workspaceId,
    } as never)) as RedoResult;

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
      `✓ Redone: v${result.previousVersion} → v${result.currentVersion}`,
    );
  } catch (error) {
    console.error(
      "Redo failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
