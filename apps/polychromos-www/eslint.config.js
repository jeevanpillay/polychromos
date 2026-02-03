import baseConfig from "@polychromos/eslint-config/base";
import reactConfig from "@polychromos/eslint-config/react";
import tanstackConfig from "@polychromos/eslint-config/tanstack";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".output/**", ".nitro/**", ".vinxi/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...tanstackConfig,
];
