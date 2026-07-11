// Cookieless visitor analytics. `record` is the PUBLIC beacon ingest (called
// only by /api/analytics, which resolves geo + hashes the IP into a bucket key);
// `summary` is the SUPER-ADMIN dashboard read. Never stores a raw IP or a stable
// identifier. Sibling of adminAnalytics.ts (app-usage) — this file owns VISITOR
// traffic.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_shared/auth";

const DAY = 86_400_000;
const HARD_CAP = 10_000; // bounded read, most-recent-first — same rationale as adminAnalytics
const RL_WINDOW = 60_000;
const RL_MAX = 240; // beacons per IP per minute — generous; throttles a runaway tab/bot only
const PROP_CAP = 2000;
const VIEWPORTS = new Set(["mobile", "tablet", "desktop"]);

const trimUtm = (s?: string) => {
  if (!s) return undefined;
  const t = s.trim().toLowerCase().slice(0, 120);
  return t || undefined;
};

// PUBLIC beacon ingest. Public-write surface: abuse is bounded by the per-IP
// fixed-window limiter below (the source beacon had none). The route passes an
// ipHash (sha256 of the caller IP) purely as a bucket key — the raw IP never
// reaches Convex. Geo fields are resolved server-side in the route.
export const record = mutation({
  args: {
    path: v.string(),
    referrerHost: v.optional(v.string()),
    viewport: v.optional(v.string()),
    eventType: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    properties: v.optional(v.string()),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const path = a.path.slice(0, 256);
    if (!path || path.startsWith("/app") || path.startsWith("/api")) return null;

    // Per-IP fixed-window limiter. OCC-safe read-modify-write on rateLimits —
    // same pattern as rateLimit.hit, inlined because a mutation can't runMutation
    // the internalMutation one.
    if (a.ipHash) {
      const key = `pv:${a.ipHash}`;
      const now = Date.now();
      const row = await ctx.db
        .query("rateLimits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (!row || now >= row.resetAt) {
        if (row) await ctx.db.patch(row._id, { count: 1, resetAt: now + RL_WINDOW });
        else await ctx.db.insert("rateLimits", { key, count: 1, resetAt: now + RL_WINDOW });
      } else if (row.count >= RL_MAX) {
        return null; // over cap — drop silently
      } else {
        await ctx.db.patch(row._id, { count: row.count + 1 });
      }
    }

    const country = a.country && /^[A-Z]{2}$/.test(a.country) ? a.country : undefined;
    const sessionId = a.sessionId && /^[a-f0-9]{8,64}$/.test(a.sessionId) ? a.sessionId : undefined;
    const properties = a.properties && a.properties.length <= PROP_CAP ? a.properties : undefined;

    await ctx.db.insert("pageviews", {
      path,
      referrerHost: a.referrerHost?.slice(0, 80),
      viewport: a.viewport && VIEWPORTS.has(a.viewport) ? a.viewport : undefined,
      eventType: a.eventType?.slice(0, 40) || "page_view",
      sessionId,
      utmSource: trimUtm(a.utmSource),
      utmMedium: trimUtm(a.utmMedium),
      utmCampaign: trimUtm(a.utmCampaign),
      utmTerm: trimUtm(a.utmTerm),
      utmContent: trimUtm(a.utmContent),
      country,
      region: a.region?.slice(0, 8),
      city: a.city?.slice(0, 80),
      lat: a.lat,
      lon: a.lon,
      properties,
      at: Date.now(),
    });
    return null;
  },
});

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
const topN = (m: Map<string, number>, n: number) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

// SUPER-ADMIN visitor dashboard. One query powers the Traffic view: totals +
// unique sessions + top paths/referrers/countries/cities + per-day volume.
export const summary = query({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, { sinceMs }) => {
    await requireAdmin(ctx);
    const cutoff = Date.now() - (sinceMs ?? 30 * DAY);
    const rows = await ctx.db
      .query("pageviews")
      .withIndex("by_at", (q) => q.gt("at", cutoff))
      .order("desc")
      .take(HARD_CAP);

    const byPath = new Map<string, number>();
    const byReferrer = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byCity = new Map<string, number>();
    const byDay = new Map<string, number>();
    const sessions = new Set<string>();
    for (const r of rows) {
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
      if (r.referrerHost) byReferrer.set(r.referrerHost, (byReferrer.get(r.referrerHost) ?? 0) + 1);
      if (r.country) byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
      if (r.city) {
        const k = r.country ? `${r.city}, ${r.country}` : r.city;
        byCity.set(k, (byCity.get(k) ?? 0) + 1);
      }
      const d = dayKey(r.at);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
      if (r.sessionId) sessions.add(r.sessionId);
    }

    return {
      total: rows.length,
      capped: rows.length === HARD_CAP,
      uniqueSessions: sessions.size,
      topPaths: topN(byPath, 20),
      topReferrers: topN(byReferrer, 10),
      topCountries: topN(byCountry, 10),
      topCities: topN(byCity, 10),
      perDay: [...byDay.entries()].sort().map(([day, count]) => ({ day, count })),
    };
  },
});
