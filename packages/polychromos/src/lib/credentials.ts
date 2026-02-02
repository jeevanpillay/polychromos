import { exec } from "child_process";
import { readFile, writeFile, mkdir, unlink, chmod } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

const CREDENTIALS_DIR = join(homedir(), ".polychromos");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function saveCredentials(tokens: TokenData): Promise<void> {
  try {
    // Ensure directory exists
    await mkdir(CREDENTIALS_DIR, { recursive: true });

    // Write credentials file
    await writeFile(CREDENTIALS_FILE, JSON.stringify(tokens, null, 2), "utf-8");

    // Set restrictive permissions
    if (process.platform === "win32") {
      // Windows: Use icacls to set owner-only permissions
      try {
        // Remove inherited permissions and set owner-only
        await execAsync(
          `icacls "${CREDENTIALS_FILE}" /inheritance:r /grant:r "%USERNAME%:F"`,
        );
      } catch {
        console.warn(
          "⚠ Could not set Windows file permissions. Credentials may be readable by other users.",
        );
      }
    } else {
      // Unix: Use chmod (owner read/write only)
      await chmod(CREDENTIALS_FILE, 0o600);
    }
  } catch (error) {
    console.warn("Could not save credentials:", error);
    throw error;
  }
}

export async function loadCredentials(): Promise<TokenData | null> {
  // Check environment variable first (for CI/headless)
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const envToken = process.env.POLYCHROMOS_TOKEN;
  if (envToken) {
    return { accessToken: envToken };
  }

  try {
    const content = await readFile(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(content) as TokenData;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(CREDENTIALS_FILE);
  } catch {
    // Ignore errors when clearing (file might not exist)
  }
}

export async function getValidToken(): Promise<string> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("Not authenticated. Run `polychromos login` first.");
  }

  // Check expiry if available
  if (creds.expiresAt && Date.now() > creds.expiresAt - 5 * 60 * 1000) {
    throw new Error("Token expired. Run `polychromos login` to refresh.");
  }

  return creds.accessToken;
}
