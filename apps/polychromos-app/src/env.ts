import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

/** Environment configuration with t3-env validation */

const appUrl =
  process.env.VITE_APP_URL ??
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
  },
  runtimeEnv: {
    ...process.env,
    VITE_APP_URL: appUrl,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL,
    NODE_ENV: process.env.NODE_ENV,
    CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
    VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "typecheck" ||
    process.env.npm_lifecycle_event === "build",
  emptyStringAsUndefined: true,
});

