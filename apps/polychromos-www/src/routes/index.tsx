import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="bg-background flex h-screen w-full overflow-hidden">
      {/* Left Sidebar */}
      <aside className="bg-background text-foreground flex flex-col justify-between px-8 py-6">
        <div>
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="bg-foreground h-4 w-4" />
          </div>

          {/* Hero Text */}
          <h2 className="text-foreground mt-8 text-7xl font-normal leading-[1.1] tracking-tight">
            Design is no longer
            <span className="text-primary"> static pixels.</span>
            <br />
            <span className="text-muted-foreground">
              It is executable logic.
            </span>
          </h2>
        </div>

        {/* Bottom Content */}
        <div>
          <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
            <p>
              Bridge the gap between Figma and React. Direct manipulation of the
              DOM with a designer-friendly interface.
            </p>
            <p>Code-first. Real-time. No more handoff friction.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="bg-background relative flex-1 overflow-hidden"></main>
    </div>
  );
}
