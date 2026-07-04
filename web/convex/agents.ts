// AI Agents — persisted task runs with a step trace. The actual model loop lives in chat.ts
// (runAgent action, "use node"); this file is just the deterministic DB half (create/finish/list).
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const stepV = v.object({ text: v.string(), tools: v.array(v.string()) });

export const create = internalMutation({
  args: { userId: v.id("users"), task: v.string(), model: v.string(), agentId: v.optional(v.id("agentDefs")), agentName: v.optional(v.string()), at: v.number() },
  handler: async (ctx, a) => ctx.db.insert("agentRuns", { ...a, status: "running" }),
});

export const finish = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    status: v.string(),
    steps: v.optional(v.array(stepV)),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
  },
  handler: async (ctx, { runId, ...patch }) => {
    await ctx.db.patch(runId, { ...patch, finishedAt: Date.now() });
  },
});

export const myRuns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("agentRuns").withIndex("by_user_at", (q) => q.eq("userId", userId)).order("desc").take(20);
  },
});

// Single run by id, owner-checked — for a run-detail / shareable-trace view.
export const getRun = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const run = await ctx.db.get(runId);
    return run && run.userId === userId ? run : null;
  },
});
