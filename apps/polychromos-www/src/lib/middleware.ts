import { createMiddleware } from "@tanstack/react-start";
import {
  getResponseHeaders,
  setResponseHeaders,
} from "@tanstack/react-start/server";

/**
 * Security Headers Middleware
 * Adds HTTP security headers to all responses
 */
export const securityHeadersMiddleware = createMiddleware().server(
  ({ next }) => {
    const headers = getResponseHeaders();

    // DNS prefetching control
    headers.set("X-DNS-Prefetch-Control", "on");

    // HSTS - enforces HTTPS for 1 year
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );

    // Prevent MIME sniffing
    headers.set("X-Content-Type-Options", "nosniff");

    // Prevent clickjacking
    headers.set("X-Frame-Options", "DENY");

    // XSS protection (legacy header, modern browsers use CSP)
    headers.set("X-XSS-Protection", "1; mode=block");

    // Referrer policy
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions policy (formerly Feature-Policy)
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );

    // Content Security Policy
    // Allows: self, inline styles (Tailwind), Clerk API, Vercel Analytics
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https://api.clerk.com https://vitals.vercel-insights.com",
        "frame-ancestors 'none'",
      ].join("; "),
    );

    setResponseHeaders(headers);

    return next();
  },
);
