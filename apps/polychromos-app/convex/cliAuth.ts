import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Session expires after 10 minutes if not completed
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Create a pending CLI auth session.
 * Called by CLI when user runs `polychromos login`.
 * No authentication required - anyone can create a pending session.
 */
export const createSession = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if code already exists
    const existing = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Session code already exists");
    }

    const now = Date.now();
    return ctx.db.insert("cliAuthSessions", {
      code: args.code,
      status: "pending",
      createdAt: now,
      expiresAt: 0, // Will be set when completed
    });
  },
});

/**
 * Complete a CLI auth session with the user's token.
 * Called by web app after user authenticates.
 * Requires authentication.
 */
export const completeSession = mutation({
  args: {
    code: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to complete CLI auth");
    }

    const session = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status !== "pending") {
      throw new Error("Session already completed or expired");
    }

    // Check if session has timed out
    if (Date.now() > session.createdAt + SESSION_TIMEOUT_MS) {
      await ctx.db.patch(session._id, { status: "expired" });
      throw new Error("Session expired");
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      token: args.token,
      expiresAt: args.expiresAt,
      completedAt: Date.now(),
      userId: identity.subject,
    });

    return { success: true };
  },
});

/**
 * Poll for CLI auth session status and token.
 * Called by CLI while waiting for user to authenticate.
 * No authentication required - uses session code for lookup.
 */
export const getSession = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!session) {
      return { status: "not_found" as const };
    }

    // Check if session has timed out
    if (
      session.status === "pending" &&
      Date.now() > session.createdAt + SESSION_TIMEOUT_MS
    ) {
      return { status: "expired" as const };
    }

    if (session.status === "completed" && session.token) {
      return {
        status: "completed" as const,
        token: session.token,
        expiresAt: session.expiresAt,
      };
    }

    return { status: session.status as "pending" | "expired" };
  },
});

/**
 * Clean up old CLI auth sessions.
 * Should be called periodically via cron or manual cleanup.
 */
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Find old sessions
    const oldSessions = await ctx.db
      .query("cliAuthSessions")
      .withIndex("by_status_created")
      .filter((q) => q.lt(q.field("createdAt"), oneDayAgo))
      .collect();

    // Delete them
    let deleted = 0;
    for (const session of oldSessions) {
      await ctx.db.delete(session._id);
      deleted++;
    }

    return { deleted };
  },
});
