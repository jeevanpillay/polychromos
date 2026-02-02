import baseConfig from "@repo/eslint-config/base";
import reactConfig from "@repo/eslint-config/react";
import tanstackConfig from "@repo/eslint-config/tanstack";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".output/**", ".nitro/**", ".vinxi/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...tanstackConfig,
];
