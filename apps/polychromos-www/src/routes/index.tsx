import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-6 lg:px-12">
        {/* Left: Logo + Time */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-lg"
            style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
          >
            POLYCHROMOS
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            v0.0.1
          </span>
        </div>

        {/* Right: CTA */}
        <Button size="default" className="rounded-none">
          <span className="mr-1">↗</span> GET EARLY ACCESS
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col px-6 lg:px-12">
        {/* Hero Section */}
        <div className="mt-16 flex-1 lg:mt-24">
          {/* Value Proposition */}
          <div className="flex max-w-xl flex-col">
            <div className="font-pp-neue text-xl leading-relaxed font-medium lg:text-2xl space-y-4">
              <p>
                Bridge the gap between Figma and React. Direct manipulation of
                the DOM with a designer-friendly interface.
              </p>
              <p>Code-first. Real-time. No more handoff friction.</p>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-muted-foreground text-sm">
                Be the first to experience code-driven design. Join the
                waitlist.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="max-w-xs rounded-none"
                />
                <Button size="default" className="rounded-none">
                  <span className="mr-1">↗</span> Join
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Large Typography */}
        <div className="mb-8 lg:mb-12">
          <div className="text-primary overflow-hidden">
            <h1 className="text-[10vw] leading-[0.95] tracking-tight lg:text-5xl">
              <span
                style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
              >
                DESIGN IS NO LONGER
              </span>
              <span
                style={{
                  fontFamily: "var(--font-hw-animo-semi-expanded)",
                }}
              >
                {" "}
                STATIC PIXELS.
              </span>
            </h1>
            <h1 className="text-[10vw] leading-[0.95] tracking-tight lg:text-10xl">
              <span
                style={{ fontFamily: "var(--font-hw-animo-semi-expanded)" }}
              >
                IT IS
              </span>
              <span
                style={{
                  fontFamily: "var(--font-hw-animo-semi-condensed-outline)",
                }}
              >
                {" "}
                EXECUTABLE LOGIC.
              </span>
            </h1>
          </div>
        </div>
      </main>
    </div>
  );
}
