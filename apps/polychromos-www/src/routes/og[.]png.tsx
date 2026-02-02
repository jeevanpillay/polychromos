import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/og.png")({
  server: {
    handlers: {
      GET: async () => {
        const { ImageResponse } = await import("@takumi-rs/image-response");

        // Load HW Animo fonts
        const [hwAnimoSemiExpanded, hwAnimoOutline] = await Promise.all([
          readFile(
            join(
              process.cwd(),
              "public/fonts/hw-animo/hw-animo-semi-expanded-regular.woff2",
            ),
          ),
          readFile(
            join(
              process.cwd(),
              "public/fonts/hw-animo/hw-animo-semicondensed-regular-outline.woff2",
            ),
          ),
        ]);

        return new ImageResponse(
          <div
            style={{
              backgroundColor: "#0a0a0a",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "60px",
              fontFamily: "HW Animo",
            }}
          >
            {/* Top Right: Logo */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: "100%",
              }}
            >
              <span
                style={{
                  color: "#fafafa",
                  fontSize: "32px",
                  letterSpacing: "0.05em",
                  fontFamily: "HW Animo",
                }}
              >
                POLYCHROMOS
              </span>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bottom Left: Tagline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Smaller line */}
              <span
                style={{
                  color: "#fafafa",
                  fontSize: "36px",
                  lineHeight: 1.0,
                  letterSpacing: "-0.02em",
                  fontFamily: "HW Animo",
                }}
              >
                DESIGN IS NO LONGER STATIC PIXELS.
              </span>

              {/* Big headline */}
              <div
                style={{
                  display: "flex",
                  marginTop: "8px",
                }}
              >
                <span
                  style={{
                    color: "#fafafa",
                    fontSize: "80px",
                    lineHeight: 0.95,
                    letterSpacing: "-0.02em",
                    fontFamily: "HW Animo",
                  }}
                >
                  IT IS
                </span>
                <span
                  style={{
                    color: "#a1a1aa",
                    fontSize: "80px",
                    lineHeight: 0.95,
                    letterSpacing: "-0.02em",
                    fontFamily: "HW Animo Outline",
                    marginLeft: "16px",
                  }}
                >
                  EXECUTABLE LOGIC.
                </span>
              </div>
            </div>
          </div>,
          {
            width: 1200,
            height: 630,
            fonts: [
              {
                name: "HW Animo",
                data: hwAnimoSemiExpanded,
                weight: 400,
                style: "normal",
              },
              {
                name: "HW Animo Outline",
                data: hwAnimoOutline,
                weight: 400,
                style: "normal",
              },
            ],
            headers: {
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          },
        );
      },
    },
  },
});
