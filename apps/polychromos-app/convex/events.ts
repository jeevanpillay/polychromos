import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceAccess } from "./lib/auth";

export const recordEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { identity, workspace } = await requireWorkspaceAccess(
      ctx,
      args.workspaceId,
    );

    const version = workspace.eventVersion + 1;

    await ctx.db.insert("events", {
      workspaceId: args.workspaceId,
      version,
      timestamp: Date.now(),
      userId: identity.subject,
      patches: args.patches,
    });

    return { version };
  },
});

export const getHistory = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify ownership before returning history
    await requireWorkspaceAccess(ctx, args.workspaceId);

    return await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .collect();
  },
});
