import { createFileRoute } from "@tanstack/react-router";

import { env } from "~/env";

export const Route = createFileRoute("/robots.txt")({
  component: () => null,
});

export function loader() {
  const baseUrl = env.VITE_APP_URL;

  const content = `User-agent: *
Allow: /

Disallow: /og.png

Sitemap: ${baseUrl}/sitemap.xml`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
