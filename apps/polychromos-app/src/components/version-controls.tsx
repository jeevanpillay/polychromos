import { useState } from "react";
import { useQuery } from "convex/react";

import { Button } from "@repo/ui/components/ui/button";
import { api } from "../../convex/_generated/api";

interface VersionControlsProps {
  workspaceId: string;
}

interface WorkspaceDocument {
  version: number;
  data: unknown;
}

interface HistoryEvent {
  _id: string;
  version: number;
  timestamp: number;
  patches: { op: string; path: string; value?: unknown }[];
}

export function VersionControls({ workspaceId }: VersionControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Type assertions for Convex's untyped API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const workspaceAsId = workspaceId as any;

  const workspace = useQuery(api.workspaces.get, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    id: workspaceAsId,
  }) as WorkspaceDocument | null | undefined;

  const history = useQuery(api.events.getHistory, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    workspaceId: workspaceAsId,
  }) as HistoryEvent[] | undefined;

  const handleUndo = () => {
    setIsLoading(true);
    try {
      // TODO: Implement undo mutation
      // This would require storing previous states or patches in Convex
      // For now, log placeholder behavior
      console.log("Undo not yet implemented - use CLI: polychromos undo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedo = () => {
    setIsLoading(true);
    try {
      // TODO: Implement redo mutation
      // This would require storing redo stack in Convex
      // For now, log placeholder behavior
      console.log("Redo not yet implemented - use CLI: polychromos redo");
    } finally {
      setIsLoading(false);
    }
  };

  const currentVersion = workspace?.version ?? 0;
  const historyCount = history?.length ?? 0;

  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={isLoading || historyCount === 0}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRedo}
          disabled={isLoading}
        >
          Redo
        </Button>
      </div>
      <div className="text-muted-foreground text-sm">
        v{currentVersion} · {historyCount} change{historyCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
