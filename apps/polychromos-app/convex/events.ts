import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const recordEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    version: v.number(),
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      workspaceId: args.workspaceId,
      version: args.version,
      timestamp: Date.now(),
      patches: args.patches,
    });
  },
});

export const getHistory = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .collect();
  },
});
