import { Link } from "@tanstack/react-router";

import { Button } from "@repo/ui/components/ui/button";

export function CustomNotFoundComponent() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-6">
        <Link to="/" className="text-lg font-bold">
          Polychromos
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center">
        <h1 className="text-primary text-[20vw] leading-none font-bold lg:text-[15vw]">
          404
        </h1>
        <Link to="/">
          <Button variant="default" size="lg" className="mt-8">
            Go Home
          </Button>
        </Link>
      </main>
    </div>
  );
}
