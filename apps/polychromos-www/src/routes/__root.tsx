import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import "@fontsource/geist-mono";
import "@fontsource/geist-sans";

import "~/styles/fonts.css";

import { CustomErrorComponent } from "~/components/error-component";
import { LoadingComponent } from "~/components/loading-component";
import { CustomNotFoundComponent } from "~/components/not-found-component";

import "../styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Polychromos" },
      { name: "description", content: "Code-driven design platform" },
    ],
    links: [{ rel: "icon", href: "/favicon.svg" }],
  }),
  errorComponent: (props) => <CustomErrorComponent {...props} />,
  notFoundComponent: () => <CustomNotFoundComponent />,
  pendingComponent: () => <LoadingComponent />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
