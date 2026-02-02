/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Operation } from "rfc6902";
import { v } from "convex/values";
import { createPatch, applyPatch } from "rfc6902";

import { mutation, query } from "./_generated/server";
import { requireAuth, requireWorkspaceAccess } from "./lib/auth";

export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Return null for unauthenticated, don't throw
    }

    const workspace = await ctx.db.get(args.id);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null; // Don't reveal existence of other users' workspaces
    }

    return workspace;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return []; // Return empty for unauthenticated
    }

    return await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    data: v.any(), // PolychromosWorkspace
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const now = Date.now();
    const id = await ctx.db.insert("workspaces", {
      name: args.name,
      data: args.data,
      baseData: args.data, // Store initial state for rebuilding
      eventVersion: 0, // No events yet
      maxEventVersion: 0, // No events yet
      version: 1,
      ownerId: identity.subject, // Set owner
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
    const { identity, workspace: existing } = await requireWorkspaceAccess(
      ctx,
      args.id,
    );

    if (existing.version !== args.expectedVersion) {
      throw new Error("Version conflict");
    }

    // Calculate patches between old and new data
    const patches = createPatch(existing.data, args.data);

    // Skip if no actual changes
    if (patches.length === 0) {
      return { success: true, noChanges: true };
    }

    // If branching (user undid then made new change): delete future events
    if (existing.eventVersion < existing.maxEventVersion) {
      const futureEvents = await ctx.db
        .query("events")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
        .filter((q) => q.gt(q.field("version"), existing.eventVersion))
        .collect();

      for (const event of futureEvents) {
        await ctx.db.delete(event._id);
      }
    }

    const newEventVersion = existing.eventVersion + 1;

    // Record event
    await ctx.db.insert("events", {
      workspaceId: args.id,
      version: newEventVersion,
      timestamp: Date.now(),
      userId: identity.subject, // Track who made change
      patches,
    });

    // Update workspace
    await ctx.db.patch(args.id, {
      data: args.data,
      eventVersion: newEventVersion,
      maxEventVersion: newEventVersion,
      version: existing.version + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const undo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion <= 0) {
      return { success: false, message: "Nothing to undo" };
    }

    // Rebuild state at eventVersion - 1 by applying all events up to that point
    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .filter((q) => q.lte(q.field("version"), workspace.eventVersion - 1))
      .order("asc")
      .collect();

    // Start from base state and apply events
    const state = structuredClone(workspace.baseData);
    for (const event of events) {
      applyPatch(state, event.patches as Operation[]);
    }

    const newEventVersion = workspace.eventVersion - 1;

    await ctx.db.patch(args.id, {
      data: state,
      eventVersion: newEventVersion,
      version: workspace.version + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state,
      previousVersion: workspace.eventVersion,
      currentVersion: newEventVersion,
    };
  },
});

export const redo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion >= workspace.maxEventVersion) {
      return { success: false, message: "Nothing to redo" };
    }

    // Get the next event to apply
    const nextEvent = await ctx.db
      .query("events")
      .withIndex("by_workspace_version", (q) =>
        q.eq("workspaceId", args.id).eq("version", workspace.eventVersion + 1),
      )
      .first();

    if (!nextEvent) {
      return { success: false, message: "Event not found" };
    }

    // Apply patches to current state
    const state = structuredClone(workspace.data);
    applyPatch(state, nextEvent.patches as Operation[]);

    const newEventVersion = workspace.eventVersion + 1;

    await ctx.db.patch(args.id, {
      data: state,
      eventVersion: newEventVersion,
      version: workspace.version + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state,
      previousVersion: workspace.eventVersion,
      currentVersion: newEventVersion,
    };
  },
});
