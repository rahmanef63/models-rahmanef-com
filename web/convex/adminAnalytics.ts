// Admin analytics — 30-day time-series + per-user activity. SUPER-ADMIN ONLY. AGGREGATE/COUNTS +
// activity metadata only (model, tokens, status, timestamps) — never a key, never message content.
// Sibling of admin.ts (which owns the point-in-time stats); this file owns the over-time reads.
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_shared/auth";

const DAY = 86_400_000;
const WINDOW_DAYS = 30;
// Bounded reads, most-recent-first — same rationale as admin.ts's ADMIN_SCAN_CAP: never a bare
// .collect(); once a table exceeds the cap we keep the RECENT window, which is what analytics wants.
const SCAN_CAP = 10_000;

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

// System-wide daily series for the Analytics dashboard. One query powers the whole view:
// signups/requests/errors/tokens per day + top models + provider mix + agent-run status.
export const adminAnalytics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const days: string[] = [];
    const idx: Record<string, number> = {};
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const k = dayKey(now - i * DAY);
      idx[k] = days.length;
      days.push(k);
    }
    const zeros = () => new Array(WINDOW_DAYS).fill(0) as number[];
    const signups = zeros(), requests = zeros(), errors = zeros(), tokens = zeros();

    const users = await ctx.db.query("users").order("desc").take(SCAN_CAP);
    for (const u of users) {
      const i = idx[dayKey(u._creationTime)];
      if (i !== undefined) signups[i]++;
    }

    const usage = await ctx.db.query("usage").withIndex("by_at").order("desc").take(SCAN_CAP);
    const models: Record<string, number> = {};
    for (const r of usage) {
      const i = idx[dayKey(r.at)];
      if (i !== undefined) {
        requests[i]++;
        tokens[i] += r.promptTokens + r.completionTokens;
        if (r.status === "error") errors[i]++;
      }
      models[r.model] = (models[r.model] ?? 0) + 1;
    }

    const creds = await ctx.db.query("modelCreds").order("desc").take(SCAN_CAP);
    const providers: Record<string, number> = {};
    for (const c of creds) providers[c.provider] = (providers[c.provider] ?? 0) + 1;

    const runs = await ctx.db.query("agentRuns").order("desc").take(SCAN_CAP);
    const runsByStatus: Record<string, number> = {};
    for (const r of runs) runsByStatus[r.status] = (runsByStatus[r.status] ?? 0) + 1;

    return {
      days,
      signups,
      requests,
      errors,
      tokens,
      topModels: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 8),
      providers: Object.entries(providers).sort((a, b) => b[1] - a[1]),
      runsByStatus,
      totals: {
        users: users.length,
        connections: creds.length,
        requests: usage.length,
        agentRuns: runs.length,
        windowTokens: tokens.reduce((s, n) => s + n, 0),
        windowRequests: requests.reduce((s, n) => s + n, 0),
        windowSignups: signups.reduce((s, n) => s + n, 0),
      },
    };
  },
});

// Per-user activity log — SUPER-ADMIN ONLY. Signup instant + recent model calls (metadata only,
// no content). Indexed .take(50) — never a per-user .collect(). Powers the admin Users drill-down.
export const adminUserActivity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const creds = await ctx.db
      .query("modelCreds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    return {
      signupAt: user._creationTime,
      providers: creds.length,
      lastActiveAt: rows[0]?.at ?? null,
      activity: rows.map((r) => ({
        model: r.model,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        status: r.status,
        at: r.at,
      })),
    };
  },
});
