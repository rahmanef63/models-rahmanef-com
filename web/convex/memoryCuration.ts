// Daily memory curation — ARCHIVE-ONLY, never hard-deletes. Pinned rows bypass everything.
// Targets the OLDEST rows (creation-time asc, bounded) each run so stale summaries get swept over
// time without an unbounded scan. Archives: summaries whose source thread is gone or >90d stale,
// and exact-duplicate texts within the batch (keeps the first per user+text).
// Cron: crons.interval("curate memory", { hours: 24 }, internal.memoryCuration.curateMemories, {}).
import { internalMutation } from "./_generated/server";

const BATCH = 200;
const STALE_MS = 90 * 24 * 60 * 60 * 1000;

export const curateMemories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // oldest-first, bounded — uses the system _creationTime index (not a bare .collect()).
    const rows = await ctx.db.query("memories").order("asc").take(BATCH);
    const seen = new Set<string>(); // userId|text — first occurrence kept
    let archived = 0;
    for (const r of rows) {
      if (r.archived || r.pinned) continue; // pinned bypasses all curation
      const key = `${r.userId}|${r.text.toLowerCase()}`;
      // exact-duplicate (any scope): archive later copies
      if (seen.has(key)) {
        await ctx.db.patch(r._id, { archived: true, updatedAt: now });
        archived++;
        continue;
      }
      seen.add(key);
      if (r.scope !== "summary") continue;
      // summary: archive if its thread is gone, or it's gone stale (no recall in 90d)
      const threadGone = r.sourceThreadId ? (await ctx.db.get(r.sourceThreadId)) === null : false;
      const stale = (r.lastRecalledAt ?? r.updatedAt ?? r.createdAt) < now - STALE_MS;
      if (threadGone || stale) {
        await ctx.db.patch(r._id, { archived: true, updatedAt: now });
        archived++;
      }
    }
    return { scanned: rows.length, archived };
  },
});
