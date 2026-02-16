import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

/**
 * Environment configuration with t3-env validation
 *
 * TanStack Start with Vite has a dual environment:
 * - Server-side code has access to process.env
 * - Client-side code has access to import.meta.env (for VITE_ prefixed vars)
 *
 * We merge both sources in runtimeEnv to support SSR properly.
 */

const isServer = typeof window === "undefined";
// In Vite, import.meta.env is available on client-side, but we need a fallback for server-side
const clientEnv: ImportMetaEnv = import.meta.env;

const appUrl =
  (isServer ? process.env.VITE_APP_URL : clientEnv.VITE_APP_URL) ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "http://localhost:3001";

export const env = createEnv({
  extends: [vercel()],
  clientPrefix: "VITE_",
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    CLERK_JWT_ISSUER_DOMAIN: z.string().url().optional(),
  },
  client: {
    VITE_APP_URL: z.string().url(),
    VITE_CONVEX_URL: z.string().url(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  },
  runtimeEnv: {
    // Merge both process.env (for server) and import.meta.env (for client)
    ...process.env,
    ...clientEnv,
    // Explicit values with proper fallbacks
    VITE_APP_URL: appUrl,
    VITE_CONVEX_URL: clientEnv.VITE_CONVEX_URL ?? process.env.VITE_CONVEX_URL,
    NODE_ENV: process.env.NODE_ENV ?? clientEnv.NODE_ENV,
    CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
    VITE_CLERK_PUBLISHABLE_KEY: clientEnv.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_SENTRY_DSN: clientEnv.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN,
    VITE_VERCEL_ENV: clientEnv.VITE_VERCEL_ENV ?? process.env.VERCEL_ENV,
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "typecheck" ||
    process.env.npm_lifecycle_event === "build",
  emptyStringAsUndefined: true,
});

/**
 * Get the current environment name for use in monitoring/analytics.
 * Prioritizes VERCEL_ENV (production/preview/development) over NODE_ENV.
 */
export function getEnvironment(): string {
  return env.VITE_VERCEL_ENV ?? env.NODE_ENV;
}

