import type {
  PolychromosComponent,
  PolychromosWorkspace,
} from "@polychromos/types";

import { Renderer } from "./renderer";

interface CanvasContainerProps {
  component: PolychromosComponent;
  workspace: PolychromosWorkspace;
  className?: string;
}

export function CanvasContainer({
  component,
  workspace,
  className,
}: CanvasContainerProps) {
  const containerStyle: React.CSSProperties = {
    width: `${component.width}px`,
    height: `${component.height}px`,
    position: "relative",
    overflow: "hidden",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
  };

  try {
    return (
      <div
        style={containerStyle}
        className={className}
        data-component-id={component.name}
      >
        <Renderer element={component.root} tokens={workspace.tokens} />
      </div>
    );
  } catch (error) {
    console.error(
      `Error rendering component ${component.name}:`,
      error instanceof Error ? error.message : String(error),
    );
    return (
      <div
        style={{
          ...containerStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
        className={className}
        data-component-id={component.name}
      >
        <div style={{ color: "#999", textAlign: "center", padding: "20px" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 500 }}>
            Error rendering component
          </p>
          <p style={{ margin: 0, fontSize: "12px" }}>
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }
}
