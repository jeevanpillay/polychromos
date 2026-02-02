import { ConvexHttpClient } from "convex/browser";
import { loadCredentials } from "../lib/credentials.js";
import { loadConfig } from "../lib/config.js";

export async function whoamiCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not logged in. Run `polychromos login` to authenticate.");
    return;
  }

  const config = await loadConfig();
  if (!config) {
    console.log("Logged in, but no project configured.");
    console.log("Run `polychromos init <name>` to set up a project.");
    return;
  }

  // Verify token by making an authenticated request
  try {
    const client = new ConvexHttpClient(config.convexUrl);
    client.setAuth(creds.accessToken);

    // Try to list workspaces - if it works, we're authenticated
    const workspaces = (await client.query(
      "workspaces:list" as never,
      {} as never,
    )) as unknown[];

    console.log("✓ Authenticated");
    console.log(`  Workspaces: ${workspaces.length}`);
    console.log(`  Convex URL: ${config.convexUrl}`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Unauthenticated") ||
        error.message.includes("401"))
    ) {
      console.error(
        "Token invalid or expired. Run `polychromos login` to re-authenticate.",
      );
    } else {
      console.error(
        "Error verifying authentication:",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
