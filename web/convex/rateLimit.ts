// Anti-abuse rate limiter. One doc per key; a Convex mutation is an OCC-serializable transaction,
// so this read-modify-write is race-safe with NO rate-limiter library and NO lock — concurrent
// hits on the same key serialize (conflicting txns auto-retry) and the counter stays exact.
//
// ponytail: fixed window, not sliding — a burst straddling a window boundary can pass up to 2×max.
// Fine for abuse backpressure; swap for a token bucket only if precise smoothing ever matters.
// No GC: one row per distinct key (IP/token), patched in place, so the table grows with distinct
// callers, not requests. Add a cron sweep of expired rows only if that set ever gets large.
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const hit = internalMutation({
  args: { key: v.string(), max: v.number(), windowMs: v.number() },
  handler: async (ctx, { key, max, windowMs }) => {
    const now = Date.now();
    const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row || now >= row.resetAt) {
      const resetAt = now + windowMs;
      if (row) await ctx.db.patch(row._id, { count: 1, resetAt });
      else await ctx.db.insert("rateLimits", { key, count: 1, resetAt });
      return { ok: true, retryAfter: 0 };
    }
    if (row.count >= max) return { ok: false, retryAfter: Math.ceil((row.resetAt - now) / 1000) };
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return { ok: true, retryAfter: 0 };
  },
});

// Cron GC: delete windows that have already reset so the table stays bounded (see crons.ts).
// ponytail: bounded batch (1000/run) — at a 6h cadence that clears 4k stale keys/day, ample here;
// raise the cadence or batch size if distinct-IP/token churn ever outpaces it.
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query("rateLimits").withIndex("by_reset", (q) => q.lt("resetAt", now)).take(1000);
    for (const r of expired) await ctx.db.delete(r._id);
    return expired.length;
  },
});
