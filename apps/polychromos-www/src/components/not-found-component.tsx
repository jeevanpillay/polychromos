import { Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

export function CustomNotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col p-6 md:p-12">
      {/* Header - Logo */}
      <header className="flex items-center justify-between">
        <Link
          to="/"
          style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
        >
          <h1 className="text-lg">POLYCHROMOS</h1>
        </Link>
        <Button size="pill" variant="outline">
          Get Started
        </Button>
      </header>

      {/* Main Content - Large 404 */}
      <main className="flex flex-1 flex-col items-center justify-center">
        <h2
          className="text-primary text-[20vw] leading-none font-semibold md:text-[15vw]"
          style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
        >
          404
        </h2>
        <p className="text-muted-foreground mb-8 text-lg">Page not found</p>
        <Link
          to="/"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-8 font-medium hover:opacity-90"
        >
          Go Home
        </Link>
      </main>
    </div>
  );
}
