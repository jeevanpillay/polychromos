import { createFileRoute } from "@tanstack/react-router";

import { env } from "~/env";
import { defaultSitemapEntries, generateSitemapXML } from "~/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  beforeLoad: ({ location: _location }) => {
    const baseUrl = env.VITE_APP_URL;

    // Generate sitemap XML
    const sitemap = generateSitemapXML(defaultSitemapEntries, baseUrl);

    return {
      sitemap,
      baseUrl,
    };
  },
  component: () => null,
  // Prerender this route
  preload: true,
});

// Export as server handler for text response
export function loader() {
  const baseUrl = env.VITE_APP_URL;
  const sitemap = generateSitemapXML(defaultSitemapEntries, baseUrl);

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
