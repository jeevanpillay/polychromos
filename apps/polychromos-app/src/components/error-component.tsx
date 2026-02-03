import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

export function CustomErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-destructive text-2xl font-bold">Error</h1>
      <p className="text-muted-foreground mt-2">Something went wrong</p>
      <pre className="bg-muted mt-4 max-w-lg overflow-auto rounded p-4 text-sm">
        {error.message}
      </pre>
      <div className="mt-6 flex gap-4">
        <Button onClick={() => router.invalidate()}>Try Again</Button>
        <Button variant="outline" onClick={() => router.navigate({ to: "/" })}>
          Go Home
        </Button>
      </div>
    </div>
  );
}
