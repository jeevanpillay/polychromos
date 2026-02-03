import { randomBytes } from "crypto";

/**
 * Generate a unique session code for CLI auth.
 * Format: pol_<random-hex>
 */
export function generateSessionCode(): string {
  const random = randomBytes(16).toString("hex");
  return `pol_${random}`;
}

/**
 * Get the web app URL for CLI auth.
 * Uses environment variable or defaults to production.
 */
export function getAuthUrl(code: string): string {
  const baseUrl = process.env.POLYCHROMOS_APP_URL ?? "https://app.polychromos.xyz";
  return `${baseUrl}/cli-auth?code=${encodeURIComponent(code)}`;
}

/**
 * Get the Convex URL for CLI operations.
 * Uses environment variable or defaults to production.
 */
export function getConvexUrl(): string {
  return process.env.POLYCHROMOS_CONVEX_URL ?? "https://dainty-toucan-799.convex.cloud";
}
