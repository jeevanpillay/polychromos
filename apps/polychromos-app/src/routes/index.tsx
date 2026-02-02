import type { PolychromosWorkspace } from "@polychromos/types";
import { Suspense } from "react";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";

import { CanvasContainer } from "~/components/canvas-container";
import { VersionControls } from "~/components/version-controls";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    workspace:
      typeof search.workspace === "string" ? search.workspace : undefined,
  }),
});

interface SearchParams {
  workspace?: string;
}

function HomePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const createWorkspaceMutation = useMutation(api.workspaces.create);

  const handleCreateNewDesign = async () => {
    const defaultWorkspace: PolychromosWorkspace = {
      id: "",
      version: "1.0",
      name: "New Design",
      tokens: {},
      components: {
        main: {
          id: "main",
          name: "main",
          width: 1024,
          height: 768,
          root: {
            type: "box",
            id: "root",
            layout: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            },
            children: [
              {
                type: "text",
                id: "welcome",
                text: {
                  content: "Welcome to Polychromos",
                  fontSize: 32,
                },
              },
            ],
          },
        },
      },
    };

    try {
      const workspaceId = await createWorkspaceMutation({
        name: "New Design",
        data: defaultWorkspace,
      });
      await navigate({ to: "/", search: { workspace: workspaceId } });
    } catch (error) {
      console.error(
        "Failed to create workspace:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="flex flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight">Polychromos</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Code-driven design platform
          </p>
        </div>

        <button
          onClick={handleCreateNewDesign}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-3 font-semibold"
        >
          Create New Design
        </button>

        {search.workspace && (
          <Suspense
            fallback={
              <div className="text-muted-foreground">Loading workspace...</div>
            }
          >
            <WorkspacePreview workspaceId={search.workspace} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

interface WorkspaceDocument {
  data: PolychromosWorkspace;
}

function WorkspacePreview({ workspaceId }: { workspaceId: string }) {
  // Type assertions needed for Convex's untyped API
  // The query returns a document with { data: PolychromosWorkspace }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const workspaceAsId = workspaceId as any;
  const workspace = useQuery(api.workspaces.get, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    id: workspaceAsId,
  }) as WorkspaceDocument | null | undefined;

  if (workspace === undefined) {
    return <div className="text-muted-foreground">Loading workspace...</div>;
  }

  if (!workspace) {
    return <div className="text-destructive">Failed to load workspace</div>;
  }

  const mainComponent = workspace.data.components.main;

  if (!mainComponent) {
    return <div className="text-destructive">Main component not found</div>;
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {workspace.data.name || "Untitled Design"}
        </h2>
        <VersionControls workspaceId={workspaceId} />
      </div>
      <div className="border-border bg-card rounded-lg border p-4">
        <CanvasContainer
          component={mainComponent}
          workspace={workspace.data}
          className="mx-auto"
        />
      </div>
    </div>
  );
}
