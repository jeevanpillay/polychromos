import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

let cachedVersion: string | null = null;

/**
 * Get the CLI version from package.json.
 * Caches the result for subsequent calls.
 */
export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Navigate from dist/lib/ to package root
    const packagePath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8")) as {
      version: string;
    };
    cachedVersion = pkg.version;
    return cachedVersion;
  } catch {
    return "unknown";
  }
}
