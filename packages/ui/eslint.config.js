import baseConfig from "@polychromos/eslint-config/base";
import reactConfig from "@polychromos/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**", "turbo/**"],
  },
  ...baseConfig,
  ...reactConfig,
];
