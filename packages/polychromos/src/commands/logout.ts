import { clearCredentials, loadCredentials } from "../lib/credentials.js";

export async function logoutCommand(): Promise<void> {
  const creds = await loadCredentials();

  if (!creds) {
    console.log("Not currently logged in.");
    return;
  }

  await clearCredentials();
  console.log("✓ Logged out successfully.");
}
