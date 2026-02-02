import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

import { env } from "~/env";

export function CustomErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-md text-center">
        <h1 className="text-destructive mb-2 text-5xl font-bold">Error</h1>
        <p className="text-muted-foreground mb-6 text-lg">
          Something went wrong while loading this page.
        </p>

        {/* Error Details (only in development) */}
        {env.NODE_ENV === "development" && (
          <div className="bg-muted mb-6 rounded-lg p-4 text-left">
            <p className="text-foreground font-mono text-sm">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.invalidate()}
            className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-md px-6 py-2 font-medium hover:opacity-90"
          >
            Try Again
          </button>
          <button
            onClick={() => router.navigate({ to: "/" })}
            className="border-input bg-background hover:bg-accent inline-flex h-10 items-center justify-center rounded-md border px-6 py-2 font-medium"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
