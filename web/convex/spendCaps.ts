// spend-caps (5.3) — optional per-workspace monthly USD budget. Sums this month's
// workspaceUsageDaily estCostUsd and compares to the workspace's capUsdPerMonth (the EXISTING
// Phase-5 field — this slice adds NO new column). checkSpendCap gates the model hot path
// (callForUser); setSpendCap/getSpendStatus drive the SpendCapCard. Cost is an ESTIMATE, not a bill.
import { internalQuery, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const monthStart = () => new Date().toISOString().slice(0, 7) + "-01"; // 'YYYY-MM-01' (UTC)

// Sum this month's estimated USD spend + resolve the workspace's monthly cap. Bounded take (a
// month is <=31 days * providers*models rows). over = a cap is set AND spend has reached it.
async function computeSpend(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const ws = await ctx.db.get(workspaceId);
  const capUsd = ws?.capUsdPerMonth ?? null;
  const since = monthStart();
  const LIMIT = 4000;
  const rows = await ctx.db
    .query("workspaceUsageDaily")
    .withIndex("by_ws_day", (q) => q.eq("workspaceId", workspaceId).gte("day", since))
    .take(LIMIT);
  let spentUsd = 0;
  for (const r of rows) spentUsd += r.estCostUsd;
  // ponytail: monthly rollup rows sit far under LIMIT in practice (~1 per ws/day/provider/model).
  // But this GATES spend — if the bound is ever hit we'd undercount and under-enforce, so fail CLOSED
  // (treat as over-cap) rather than silently letting spend through. `truncated` is returned so a
  // caller can surface WHY it's over (the block itself already shows via `over`).
  const truncated = rows.length === LIMIT;
  return { over: capUsd != null && (truncated || spentUsd >= capUsd), spentUsd, capUsd, truncated };
}

// Internal gate for the model hot path — no auth (callers already authorized). No cap ⇒ over:false.
export const checkSpendCap = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: (ctx, a) => computeSpend(ctx, a.workspaceId),
});

// Admin sets the monthly USD budget; omitting monthlyCapUsd clears it (patch drops the field).
export const setSpendCap = mutation({
  args: { workspaceId: v.id("workspaces"), monthlyCapUsd: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    if (a.monthlyCapUsd != null && (!isFinite(a.monthlyCapUsd) || a.monthlyCapUsd < 0))
      throw new ConvexError({ code: "invalid_request", detail: "Cap must be a non-negative number." });
    await ctx.db.patch(a.workspaceId, { capUsdPerMonth: a.monthlyCapUsd });
    return null;
  },
});

// UI read: current-month spend vs cap for the active workspace.
export const getSpendStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    return computeSpend(ctx, a.workspaceId);
  },
});
