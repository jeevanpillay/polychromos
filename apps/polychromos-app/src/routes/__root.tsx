import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";
import "../styles/app.css";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Polychromos" },
      { name: "description", content: "Code-driven design platform" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
});

function RootComponent() {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    void (async () => {
      const { setUser } = await import("@sentry/tanstackstart-react");
      if (isSignedIn && userId) {
        setUser({ id: userId });
      } else {
        setUser(null);
      }
    })();
  }, [isSignedIn, userId]);

  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <div className="flex min-h-screen flex-col">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}
