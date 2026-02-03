import baseConfig from "@polychromos/eslint-config/base";
import reactConfig from "@polychromos/eslint-config/react";
import tanstackConfig from "@polychromos/eslint-config/tanstack";

export default [
  {
    ignores: [
      ".output/**",
      ".nitro/**",
      ".vinxi/**",
      "convex/_generated/**",
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
