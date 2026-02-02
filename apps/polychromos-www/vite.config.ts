import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3002,
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    nitro({
      config: {
        preset: "vercel",
        externals: {
          traceInclude: [
            "node_modules/@takumi-rs/core",
            "node_modules/@takumi-rs/image-response",
            "node_modules/@takumi-rs/helpers",
            "node_modules/@takumi-rs/core-linux-x64-gnu",
            "node_modules/@takumi-rs/core-linux-arm64-gnu",
            "node_modules/@takumi-rs/core-darwin-arm64",
            "node_modules/@takumi-rs/core-darwin-x64",
          ],
        },
      },
    }),
    viteReact(),
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      webp: { quality: 80 },
    }),
  ],
});
