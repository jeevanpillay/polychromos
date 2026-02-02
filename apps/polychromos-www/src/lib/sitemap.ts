/**
 * Sitemap Generation
 * Generate XML sitemap from routes
 */

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

/**
 * Generate sitemap XML
 */
export function generateSitemapXML(
  entries: SitemapEntry[],
  baseUrl: string,
): string {
  const urls = entries
    .map((entry) => {
      const fullUrl = entry.url.startsWith("http")
        ? entry.url
        : `${baseUrl}${entry.url}`;

      let xml = `  <url>\n    <loc>${escapeXml(fullUrl)}</loc>\n`;

      if (entry.lastmod) {
        xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
      }

      if (entry.changefreq) {
        xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
      }

      if (entry.priority) {
        xml += `    <priority>${entry.priority}</priority>\n`;
      }

      xml += `  </url>\n`;

      return xml;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Default sitemap entries for Polychromos WWW
 */
export const defaultSitemapEntries: SitemapEntry[] = [
  {
    url: "/",
    changefreq: "weekly",
    priority: 1.0,
    lastmod: new Date().toISOString().split("T")[0],
  },
];
