import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

const appUrl =
  process.env.VITE_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3001";

export const env = createEnv({
  extends: [vercel()],
  clientPrefix: "VITE_",
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    CONVEX_URL: z.string().url(),
  },
  server: {},
  client: {
    VITE_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    ...process.env,
    VITE_APP_URL: appUrl,
    CONVEX_URL: process.env.CONVEX_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation:
    !!process.env.CI ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "build",
  emptyStringAsUndefined: true,
});
