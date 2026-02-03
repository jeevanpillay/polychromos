import open from "open";
import { ConvexHttpClient } from "convex/browser";
import { saveCredentials, loadCredentials } from "../lib/credentials.js";
import { generateSessionCode, getAuthUrl, getConvexUrl } from "../lib/auth.js";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute timeout

export async function loginCommand(): Promise<void> {
  console.log("Polychromos CLI Login");
  console.log("");

  // Check if already logged in
  const existingCreds = await loadCredentials();
  if (existingCreds) {
    console.log("Already logged in. Run `polychromos logout` first to sign out.");
    console.log("");
    console.log("Or continue to re-authenticate...");
    console.log("");
  }

  const convexUrl = getConvexUrl();
  const client = new ConvexHttpClient(convexUrl);
  const code = generateSessionCode();

  try {
    // Create pending session in Convex
    console.log("Creating authentication session...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.mutation("cliAuth:createSession" as any, { code });

    // Open browser
    const authUrl = getAuthUrl(code);
    console.log("");
    console.log("Opening browser for authentication...");
    console.log(`If browser doesn't open, visit: ${authUrl}`);
    console.log("");

    await open(authUrl);

    // Poll for completion
    console.log("Waiting for authentication...");
    const startTime = Date.now();
    let dots = 0;

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.query("cliAuth:getSession" as any, { code }) as { status: string; token?: string; expiresAt?: number };

      if (result.status === "completed" && result.token) {
        // Save credentials
        await saveCredentials({
          accessToken: result.token,
          expiresAt: result.expiresAt,
        });

        console.log("");
        console.log("✓ Login successful!");
        console.log("");
        console.log("You can now use polychromos commands.");
        return;
      }

      if (result.status === "expired" || result.status === "not_found") {
        console.log("");
        console.error("Authentication session expired. Please try again.");
        process.exit(1);
      }

      // Show progress dots
      process.stdout.write(`\rWaiting for authentication${".".repeat((dots % 3) + 1)}   `);
      dots++;

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout
    console.log("");
    console.error("Authentication timed out. Please try again.");
    process.exit(1);
  } catch (error) {
    console.error(
      "Login failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
