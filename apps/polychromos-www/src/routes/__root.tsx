import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
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
import { generateSEO } from "~/lib/seo";

import "../styles/app.css";

// Lazy load analytics - not critical for initial render
const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics })),
);
const SpeedInsights = lazy(() =>
  import("@vercel/speed-insights/react").then((m) => ({
    default: m.SpeedInsights,
  })),
);

export const Route = createRootRoute({
  head: () =>
    generateSEO({
      title: "Polychromos | Code-Driven Design Platform",
      description:
        "Bridge the gap between Figma and React. Direct manipulation of the DOM with a designer-friendly interface. Code-first. Real-time. No more handoff friction.",
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
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        {/* Critical CSS to prevent flash of wrong background color */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html.dark{--background:oklch(0.145 0 0);background:oklch(0.145 0 0)}`,
          }}
        />
        <HeadContent />
      </head>
      <body className="bg-background font-sans antialiased">
        {children}
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}
