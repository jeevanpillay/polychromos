import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "https://9c0e71537f4f44e46e091628c4184a05@o4508333286948864.ingest.us.sentry.io/4510825109323776",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
});
