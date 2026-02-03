import baseConfig from "@repo/eslint-config/base";
import reactConfig from "@repo/eslint-config/react";
import tanstackConfig from "@repo/eslint-config/tanstack";

export default [
  {
    ignores: [
      ".output/**",
      ".nitro/**",
      ".vinxi/**",
      "convex/_generated/**",
      "convex/**/*.js",
      "convex/**/*.d.ts",
      "test/**",
      "e2e/**",
      "scripts/**",
    ],
  },
  ...baseConfig,
  ...reactConfig,
  ...tanstackConfig,
  {
    files: ["convex/**/*.ts"],
    rules: {
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];
