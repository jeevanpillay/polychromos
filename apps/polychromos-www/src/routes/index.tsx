import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:p-12">
        <Link to="/">
          <h1
            className="text-lg"
            style={{ fontFamily: "Joyride, sans-serif" }}
          >
            POLYCHROMOS
          </h1>
        </Link>
        <Button size="pill" variant="outline">
          Get Started
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 md:px-12">
        <div className="max-w-3xl text-center">
          <h2
            className="text-primary mb-6 text-5xl font-semibold leading-tight md:text-7xl"
            style={{ fontFamily: "Joyride, sans-serif" }}
          >
            Code-Driven Design
          </h2>
          <p className="text-muted-foreground mb-8 text-lg md:text-xl">
            A platform for building design systems with code. Create, iterate,
            and ship beautiful interfaces with the precision of code.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg">
              Start Building
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-muted-foreground p-6 text-center text-sm md:p-12">
        <p>&copy; {new Date().getFullYear()} Polychromos. All rights reserved.</p>
      </footer>
    </div>
  );
}
