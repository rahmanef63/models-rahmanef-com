// Per-user token-saver settings. Caveman = terse output; Ponytail = lazy/YAGNI-minimal output.
// Both are just system-prompt injection (ported concept from 9router) — save output tokens.
import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const DEFAULTS = { cavemanEnabled: false, cavemanLevel: "full", ponytailEnabled: false, ponytailLevel: "full", agentMode: false };

export const mySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const s = await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    return { ...DEFAULTS, ...(s ?? {}) };
  },
});

export const setSettings = mutation({
  args: { cavemanEnabled: v.optional(v.boolean()), ponytailEnabled: v.optional(v.boolean()), cavemanLevel: v.optional(v.string()), ponytailLevel: v.optional(v.string()), agentMode: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const existing = await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (existing) await ctx.db.patch(existing._id, a);
    else await ctx.db.insert("settings", { userId, ...a });
  },
});

// internal: read settings inside the chat action
export const _getForChat = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, a) => {
    const s = await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", a.userId)).unique();
    return { ...DEFAULTS, ...(s ?? {}) };
  },
});
