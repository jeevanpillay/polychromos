import { createStart } from "@tanstack/react-start";

import { securityHeadersMiddleware } from "~/lib/middleware";

/**
 * TanStack Start Instance
 * Configures global middleware for all requests
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
