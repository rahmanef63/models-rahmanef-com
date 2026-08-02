// usage-rollups — roll raw per-call `usage` rows into per-workspace daily aggregates with an
// ESTIMATED cost (see features/usageRollups/rates). rollupDay is the cron target; workspaceUsage
// feeds the dashboard (requireWorkspaceRole 'viewer'). Idempotent: re-running re-computes the same
// (ws, day, provider, model) rows via the by_ws_day upsert key. NO bare .collect() — bounded takes.
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import { estCostUsd } from "./features/usageRollups/rates";

const DAY_MS = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

type Agg = { day: string; provider: string; model: string; calls: number; prompt: number; completion: number };

// Cron target ({} args). Aggregates yesterday+today's usage per workspace via by_ws_at, upserts
// workspaceUsageDaily. Bounded: <=1000 workspaces, <=5000 usage rows/ws/window (a note flags the cap).
export const rollupDay = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - (now % DAY_MS) - DAY_MS; // start of yesterday (UTC)
    const workspaces = await ctx.db.query("workspaces").take(1000);
    for (const ws of workspaces) {
      const rows = await ctx.db
        .query("usage")
        .withIndex("by_ws_at", (q) => q.eq("workspaceId", ws._id).gte("at", cutoff))
        .take(5000);
      if (!rows.length) continue;

      // fold to one bucket per (day, provider, model)
      const agg = new Map<string, Agg>();
      for (const r of rows) {
        const day = dayKey(r.at);
        const key = `${day}|${r.provider}|${r.model}`;
        const a = agg.get(key) ?? { day, provider: r.provider, model: r.model, calls: 0, prompt: 0, completion: 0 };
        a.calls++; a.prompt += r.promptTokens; a.completion += r.completionTokens;
        agg.set(key, a);
      }

      // pre-load existing rows for the affected days (<=2 days) to decide patch vs insert
      const existing = new Map<string, { _id: any }>();
      for (const day of new Set([...agg.values()].map((a) => a.day))) {
        const ex = await ctx.db
          .query("workspaceUsageDaily")
          .withIndex("by_ws_day", (q) => q.eq("workspaceId", ws._id).eq("day", day))
          .take(500);
        for (const e of ex) existing.set(`${e.day}|${e.provider}|${e.model}`, e);
      }

      for (const [key, a] of agg) {
        const { cost, hasRate } = estCostUsd(a.model, a.prompt, a.completion);
        const doc = {
          workspaceId: ws._id, day: a.day, provider: a.provider, model: a.model,
          calls: a.calls, promptTokens: a.prompt, completionTokens: a.completion,
          estCostUsd: cost, hasRate, updatedAt: now,
        };
        const e = existing.get(key);
        if (e) await ctx.db.patch(e._id, doc);
        else await ctx.db.insert("workspaceUsageDaily", doc);
      }
    }
  },
});

// Dashboard read: the last `days` (default 30, max 90) of daily rows for a workspace, newest first.
export const workspaceUsage = query({
  args: { workspaceId: v.id("workspaces"), days: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const n = Math.min(Math.max(a.days ?? 30, 1), 90);
    const cutoff = dayKey(Date.now() - (n - 1) * DAY_MS);
    const rows = await ctx.db
      .query("workspaceUsageDaily")
      .withIndex("by_ws_day", (q) => q.eq("workspaceId", a.workspaceId).gte("day", cutoff)) // recent days always in-range
      .take(2000);
    return rows
      .filter((r) => r.day >= cutoff)
      .sort((x, y) => (x.day < y.day ? 1 : x.day > y.day ? -1 : 0))
      .map((r) => ({
        day: r.day, provider: r.provider, model: r.model, calls: r.calls,
        promptTokens: r.promptTokens, completionTokens: r.completionTokens,
        estCostUsd: r.estCostUsd, hasRate: r.hasRate !== false,
      }));
  },
});
