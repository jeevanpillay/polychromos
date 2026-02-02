import { VersionManager } from "../lib/version-manager.js";

export async function checkpointCommand(name: string): Promise<void> {
  const versionManager = new VersionManager(".polychromos");
  await versionManager.init();

  await versionManager.checkpoint(name);
}
