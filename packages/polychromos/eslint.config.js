import baseConfig from "@polychromos/eslint-config/base";

export default [
  ...baseConfig,
  {
    // Ignore test files - they are covered by tsconfig.test.json
    ignores: ["test/**"],
  },
];
