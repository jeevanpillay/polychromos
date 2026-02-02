import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const CLERK_PUBLISHABLE_KEY = (import.meta as any).env
    .VITE_CLERK_PUBLISHABLE_KEY as string;

  if (!CONVEX_URL) {
    console.error("missing envar VITE_CONVEX_URL");
  }
  if (!CLERK_PUBLISHABLE_KEY) {
    console.error("missing envar VITE_CLERK_PUBLISHABLE_KEY");
  }

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
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>
      ),
    }),
    queryClient,
  );

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
