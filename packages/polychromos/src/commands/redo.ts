import { writeFile } from "fs/promises";

import { VersionManager } from "../lib/version-manager.js";

export async function redoCommand(): Promise<void> {
  const versionManager = new VersionManager(".polychromos");
  await versionManager.init();

  const previousVersion = versionManager.getVersion();
  const newState = await versionManager.redo();

  if (newState) {
    // Write the restored state back to design.json
    await writeFile("design.json", JSON.stringify(newState, null, 2), "utf-8");
    console.log(
      `✓ Redone: v${previousVersion} → v${versionManager.getVersion()}`,
    );
  }
}
