import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    data: v.any(), // Full PolychromosWorkspace JSON - current state
    baseData: v.any(), // Initial state (for rebuilding from events)
    eventVersion: v.number(), // Current event position (0 = base)
    maxEventVersion: v.number(), // Highest event version (for redo limit)
    version: v.number(), // For conflict detection (OCC)
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Event log for version history
  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      }),
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_version", ["workspaceId", "version"]),
});
