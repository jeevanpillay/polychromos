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
    ownerId: v.string(), // Clerk user subject
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Event log for version history
  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(), // Who made this change
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

  // CLI auth session management
  cliAuthSessions: defineTable({
    code: v.string(),                    // Unique session code (pol_xxx)
    status: v.string(),                  // "pending" | "completed" | "expired"
    token: v.optional(v.string()),       // Convex token after auth completes
    expiresAt: v.number(),               // Token expiry timestamp (ms)
    createdAt: v.number(),               // Session creation timestamp
    completedAt: v.optional(v.number()), // When auth was completed
    userId: v.optional(v.string()),      // Clerk user ID after auth
  })
    .index("by_code", ["code"])
    .index("by_status_created", ["status", "createdAt"]),
});
