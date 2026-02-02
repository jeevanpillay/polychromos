import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,

    // Navigation & Restoration
    scrollRestoration: true,

    // Preloading (Performance)
    defaultPreload: "intent", // Preload on hover
    defaultPreloadDelay: 50, // 50ms delay before preload
    defaultPreloadStaleTime: 30000, // 30 seconds cache for preloads

    // Caching & Stale Time
    defaultStaleTime: 0, // Always treat data as stale
    defaultGcTime: 1800000, // 30 minutes garbage collection

    // Loading States
    defaultPendingMs: 1000, // Show pending after 1 second
    defaultPendingMinMs: 500, // Keep pending visible 500ms minimum

    // Error/NotFound Behavior
    notFoundMode: "fuzzy", // Use nearest parent's notFoundComponent
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
