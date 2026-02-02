import { VersionManager } from "../lib/version-manager.js";

export async function historyCommand(): Promise<void> {
  const versionManager = new VersionManager(".polychromos");
  await versionManager.init();

  const history = versionManager.list();

  if (history.length === 0) {
    console.log("No version history found.");
    console.log(
      "Run 'polychromos dev' and make some changes to start tracking.",
    );
    return;
  }

  console.log("Version History");
  console.log("===============");
  console.log("");

  for (const entry of history) {
    const date = new Date(entry.ts);
    const timestamp = date.toLocaleString();
    const patchCount = entry.patches.length;
    const checkpointLabel = entry.checkpoint ? ` [${entry.checkpoint}]` : "";

    console.log(
      `  v${entry.v}  ${timestamp}  (${patchCount} change${patchCount !== 1 ? "s" : ""})${checkpointLabel}`,
    );
  }

  console.log("");
  console.log(`Current version: v${versionManager.getVersion()}`);
}
