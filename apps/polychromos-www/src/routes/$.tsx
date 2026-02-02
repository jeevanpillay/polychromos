import { createFileRoute } from "@tanstack/react-router";

import { CustomNotFoundComponent } from "~/components/not-found-component";

export const Route = createFileRoute("/$")({
  component: CustomNotFoundComponent,
});
