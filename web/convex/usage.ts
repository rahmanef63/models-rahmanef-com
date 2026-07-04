// Usage stats — per-user (self) + global (super-admin). Reactive: the dashboard updates live.
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./_shared/auth";

export const log = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), model: v.string(), promptTokens: v.number(), completionTokens: v.number(), status: v.string() },
  handler: (ctx, a) => ctx.db.insert("usage", { ...a, at: Date.now() }),
});

type Row = { provider: string; model: string; promptTokens: number; completionTokens: number; status: string; at: number };

function aggregate(rows: Row[]) {
  let promptTokens = 0, completionTokens = 0, errors = 0;
  const byModel: Record<string, number> = {};
  const byModelTokens: Record<string, { prompt: number; completion: number }> = {}; // per-model sums so the client can price each × its models.dev rate
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    promptTokens += r.promptTokens;
    completionTokens += r.completionTokens;
    if (r.status !== "ok") errors++;
    byModel[r.model] = (byModel[r.model] ?? 0) + 1;
    const t = (byModelTokens[r.model] ??= { prompt: 0, completion: 0 });
    t.prompt += r.promptTokens;
    t.completion += r.completionTokens;
    byDay[new Date(r.at).toISOString().slice(0, 10)] = (byDay[new Date(r.at).toISOString().slice(0, 10)] ?? 0) + 1;
  }
  return {
    requests: rows.length,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    errors,
    byModel,
    byModelTokens,
    byDay,
    recent: rows.slice(0, 15).map((r) => ({ model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, status: r.status, at: r.at })),
  };
}

export const myUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db.query("usage").withIndex("by_user_at", (q) => q.eq("userId", userId)).order("desc").take(500);
    return aggregate(rows as Row[]);
  },
});

export const globalUsage = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("usage").withIndex("by_at").order("desc").take(1000);
    return aggregate(rows as Row[]);
  },
});
