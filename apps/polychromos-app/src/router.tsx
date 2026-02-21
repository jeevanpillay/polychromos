import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

import { routeTree } from "./routeTree.gen";
import { env, getEnvironment } from "./env";

export function getRouter() {
  const CONVEX_URL = env.VITE_CONVEX_URL;
  const CLERK_PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY;
  const SENTRY_DSN = env.VITE_SENTRY_DSN;

  const convex = new ConvexReactClient(CONVEX_URL);

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient },
      scrollRestoration: true,
      defaultPreloadStaleTime: 0,
      defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
      defaultNotFoundComponent: () => <p>not found</p>,
      Wrap: ({ children }) => (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY ?? ""}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>
      ),
    }),
    queryClient,
  );

  // Initialize Sentry on client only
  if (!router.isServer && SENTRY_DSN) {
    void (async () => {
      const { tanstackRouterBrowserTracingIntegration, replayIntegration, init } = await import("@sentry/tanstackstart-react");
      init({
        dsn: SENTRY_DSN,
        environment: getEnvironment(),
        integrations: [
          tanstackRouterBrowserTracingIntegration(router),
          replayIntegration(),
        ],
        tracesSampleRate: 0.1, // 10% in production
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% on error
      });
    })();
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
