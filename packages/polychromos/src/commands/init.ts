import { writeFile } from "fs/promises";
import type { PolychromosWorkspace } from "@polychromos/types";

export async function initCommand(name: string): Promise<void> {
  const workspaceId = `ws_${Date.now()}`;

  const workspace: PolychromosWorkspace = {
    id: workspaceId,
    version: "1.0",
    name,
    settings: {
      defaultUnits: "px",
      rootFontSize: 16,
    },
    tokens: {
      colors: {
        primary: "#3b82f6",
        background: "#ffffff",
        foreground: "#000000",
      },
      spacing: {
        sm: "8px",
        md: "16px",
        lg: "24px",
      },
    },
    components: {
      main: {
        id: "main",
        name: "Main Component",
        width: 1024,
        height: 768,
        root: {
          id: "root",
          type: "box",
          layout: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          },
          width: "100%",
          height: "100%",
          style: {
            backgroundColor: "#ffffff",
          },
          children: [
            {
              id: "title",
              type: "text",
              text: {
                content: `Welcome to ${name}`,
                fontSize: 32,
                fontWeight: "bold",
                color: "#000000",
              },
            },
            {
              id: "subtitle",
              type: "text",
              text: {
                content: "Edit this file to see changes in real-time",
                fontSize: 16,
                color: "#666666",
              },
              margin: [16, 0, 0, 0],
            },
          ],
        },
      },
    },
  };

  const filename = "design.json";
  await writeFile(filename, JSON.stringify(workspace, null, 2), "utf-8");

  console.log(`✓ Created ${filename}`);
  console.log(`  Workspace: ${name}`);
  console.log(`  ID: ${workspaceId}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Run 'polychromos dev' to start watching for changes");
  console.log("  2. Edit design.json to modify your design");
  console.log("  3. Open the web app to see live preview");
}
