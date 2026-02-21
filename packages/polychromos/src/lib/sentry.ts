import * as Sentry from "@sentry/node";
import { isTelemetryEnabled } from "./telemetry-config.js";
import { getVersion } from "./version.js";

// Hardcoded Sentry DSN - this is NOT a secret, it's safe to be public
const SENTRY_DSN =
  "https://6381f2ec10a3ab36b1dea0b0cda769da@o4508333286948864.ingest.us.sentry.io/4510825143533569";

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: `polychromos-cli@${getVersion()}`,
    environment: process.env.NODE_ENV ?? "production",
    // Error-only mode - no tracing for CLI
    beforeSend(event) {
      // Check opt-out: environment variable takes precedence
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      if (process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1") {
        return null;
      }

      // Check user config
      if (!isTelemetryEnabled()) {
        return null;
      }

      // Scrub PII: file paths that might contain usernames
      if (event.exception?.values) {
        event.exception.values.forEach((exc) => {
          if (exc.stacktrace?.frames) {
            exc.stacktrace.frames.forEach((frame) => {
              if (frame.filename) {
                // Replace /Users/<username> or /home/<username> with anonymized path
                frame.filename = frame.filename
                  .replace(/\/Users\/[^/]+/g, "/Users/***")
                  .replace(/\/home\/[^/]+/g, "/home/***")
                  .replace(/C:\\Users\\[^\\]+/g, "C:\\Users\\***");
              }
            });
          }
        });
      }
      return event;
    },
  });
}

export async function closeSentry(): Promise<void> {
  await Sentry.close(2000);
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export function setUser(userId: string): void {
  Sentry.setUser({ id: userId });
}
