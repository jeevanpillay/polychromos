import { env } from "~/env";

/**
 * SEO Configuration for Polychromos WWW
 */

export interface SEOConfig {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export function generateSEO(config: SEOConfig) {
  const {
    title,
    description,
    canonicalUrl = env.VITE_APP_URL,
    ogImage = `${env.VITE_APP_URL}/og.png`,
  } = config;

  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "Polychromos" },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      // Theme
      { name: "theme-color", content: "#000000" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      // Preconnect for Clerk API (waitlist form)
      { rel: "preconnect", href: "https://api.clerk.com" },
      { rel: "dns-prefetch", href: "https://api.clerk.com" },
      // Critical font preloads - these are used in the hero typography
      {
        rel: "preload",
        href: "/fonts/hw-animo/hw-animo-semi-expanded-regular.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      },
      {
        rel: "preload",
        href: "/fonts/hw-animo/hw-animo-semicondensed-regular-outline.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      },
      {
        rel: "preload",
        href: "/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      },
    ],
  };
}
