import { createInterface } from "readline";
import { saveCredentials } from "../lib/credentials.js";

export async function loginCommand(): Promise<void> {
  console.log("Polychromos CLI Login");
  console.log("");
  console.log("To authenticate, you need a Clerk session token from the web app.");
  console.log("");
  console.log("Steps:");
  console.log("1. Open the Polychromos web app and sign in");
  console.log("2. Open browser DevTools (F12) → Application → Cookies");
  console.log("3. Find the '__session' cookie and copy its value");
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your session token: ", (token) => {
      rl.close();

      const trimmedToken = token.trim();
      if (!trimmedToken) {
        console.error("No token provided. Login cancelled.");
        process.exit(1);
      }

      void (async () => {
        try {
          await saveCredentials({ accessToken: trimmedToken });
          console.log("");
          console.log("✓ Login successful!");
          console.log("You can now use polychromos commands.");
          resolve();
        } catch (error) {
          console.error(
            "Failed to save credentials:",
            error instanceof Error ? error.message : error,
          );
          process.exit(1);
        }
      })();
    });
  });
}
