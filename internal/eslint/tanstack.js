import pluginRouter from "@tanstack/eslint-plugin-router";

/** @type {Awaited<import('typescript-eslint').Config>} */
export default [...pluginRouter.configs["flat/recommended"]];
