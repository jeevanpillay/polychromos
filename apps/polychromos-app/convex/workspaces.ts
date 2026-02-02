/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workspaces").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    data: v.any(), // PolychromosWorkspace
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      data: args.data,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("workspaces"),
    data: v.any(), // PolychromosWorkspace
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Workspace not found");
    if (existing.version !== args.expectedVersion) {
      throw new Error("Version conflict");
    }

    await ctx.db.patch(args.id, {
      data: args.data,
      version: existing.version + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
