// Super-admin gate + operator stats. Auth lives in ./_shared/auth (requireUser/isSuperAdmin/
// requireAdmin) — this file just re-exports isSuperAdmin for the few call sites that need the
// boolean (not the throw) and owns the stats queries.
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isSuperAdmin, requireAdmin } from "./_shared/auth";

export { isSuperAdmin };

// Bounded rather than a bare .collect() — these are admin-only aggregate reads, not per-record
// listings, so a high cap keeps counts accurate at any scale we're actually at while still
// protecting against an unbounded scan degrading/timing out if a table gets huge. Always ordered
// "desc" (most-recent-first) — these tables grow with per-message/per-call ACTIVITY, not user
// count, so once a table exceeds the cap we still want the RECENT window, not a scan frozen on
// the oldest rows forever.
const ADMIN_SCAN_CAP = 10_000;

// The current user's identity + admin flag, for the UI (and for pinning their id as admin).
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return { id: userId, email: user?.email ?? null, isSuperAdmin: await isSuperAdmin(ctx) };
  },
});

// Aggregate stats — SUPER-ADMIN ONLY, and only aggregates (no keys, no per-user emails).
export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(ADMIN_SCAN_CAP);
    const creds = await ctx.db.query("modelCreds").order("desc").take(ADMIN_SCAN_CAP);
    const byProvider: Record<string, number> = {};
    let oauth = 0;
    for (const c of creds) {
      byProvider[c.provider] = (byProvider[c.provider] ?? 0) + 1;
      if (c.kind === "oauth") oauth++;
    }
    return { users: users.length, connections: creds.length, oauth, byProvider };
  },
});

// Per-user list — SUPER-ADMIN ONLY. Returns identity (email/name) + how many providers each
// has connected, but never any key/ciphertext.
export const adminUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(ADMIN_SCAN_CAP);
    const creds = await ctx.db.query("modelCreds").order("desc").take(ADMIN_SCAN_CAP);
    const count: Record<string, number> = {};
    for (const c of creds) count[c.userId] = (count[c.userId] ?? 0) + 1;
    return users
      .map((u) => ({ id: u._id, email: u.email ?? null, name: u.name ?? null, createdAt: u._creationTime, providers: count[u._id] ?? 0 }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// System-wide operator insight. AGGREGATE / COUNTS ONLY — never a key, never message/task content.
export const adminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const creds = await ctx.db.query("modelCreds").order("desc").take(ADMIN_SCAN_CAP);
    const providers: Record<string, number> = {};
    for (const c of creds) providers[c.provider] = (providers[c.provider] ?? 0) + 1;

    const usage = await ctx.db.query("usage").order("desc").take(ADMIN_SCAN_CAP);
    const models: Record<string, number> = {};
    let promptTokens = 0, completionTokens = 0, errors = 0;
    for (const u of usage) {
      models[u.model] = (models[u.model] ?? 0) + 1;
      promptTokens += u.promptTokens;
      completionTokens += u.completionTokens;
      if (u.status === "error") errors++;
    }

    const runs = await ctx.db.query("agentRuns").order("desc").take(ADMIN_SCAN_CAP);
    const runsByStatus: Record<string, number> = {};
    for (const r of runs) runsByStatus[r.status] = (runsByStatus[r.status] ?? 0) + 1;

    const threads = (await ctx.db.query("threads").order("desc").take(ADMIN_SCAN_CAP)).length;
    const messages = (await ctx.db.query("messages").order("desc").take(ADMIN_SCAN_CAP)).length;

    return {
      providers: Object.entries(providers).sort((a, b) => b[1] - a[1]),
      topModels: Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 8),
      runsByStatus,
      totals: {
        connections: creds.length,
        requests: usage.length,
        promptTokens,
        completionTokens,
        errors,
        agentRuns: runs.length,
        threads,
        messages,
      },
    };
  },
});
