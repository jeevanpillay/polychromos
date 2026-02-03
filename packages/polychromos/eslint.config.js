import baseConfig from "@polychromos/eslint-config/base";

export default [
  ...baseConfig,
  {
    // Ignore test setup files - they are covered by tsconfig.test.json
    ignores: ["test/setup.ts", "test/mocks/**", "test/integration/**"],
  },
];
