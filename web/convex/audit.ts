// Append-only workspace audit trail (audit-log slice; table in features/auditLog/tables.ts).
// record() is an internalMutation for programmatic/action callers, BUT the highest-value hooks are
// plain `ctx.db.insert("auditEvents", …)` calls inlined into the acting mutation so the audit row
// commits in the SAME transaction as the state change (no action hop, no partial-write window).
// listAuditEvents is admin-gated; pruneAudit is the daily 90-day retention sweep (cron target).
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import { internal } from "./_generated/api";

const RETAIN_MS = 90 * 24 * 60 * 60 * 1000; // keep 90 days
const PRUNE_BATCH = 500;

// bound meta so a crafted payload can't bloat an immutable, never-compacted row.
function boundMeta(meta: unknown): unknown {
  if (meta == null) return undefined;
  try {
    const s = JSON.stringify(meta);
    return s.length > 1000 ? { truncated: true } : meta;
  } catch {
    return undefined;
  }
}

// Programmatic insert (for callers that aren't already inside the acting mutation). In-mutation
// hooks skip this and db.insert directly to stay in one transaction — see the slice's sharedEdits.
export const record = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    action: v.string(),
    target: v.optional(v.string()),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("auditEvents", {
      workspaceId: a.workspaceId,
      actorUserId: a.actorUserId,
      action: a.action.slice(0, 80),
      target: a.target?.slice(0, 200),
      meta: boundMeta(a.meta),
      at: Date.now(),
    });
  },
});

// Admin+ read: recent events for the active workspace, newest first. Indexed .take — never collect.
export const listAuditEvents = query({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    const limit = Math.min(Math.max(a.limit ?? 50, 1), 200);
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_ws_at", (q) => q.eq("workspaceId", a.workspaceId))
      .order("desc")
      .take(limit);
    const out = [];
    for (const r of rows) {
      const actor = await ctx.db.get(r.actorUserId);
      out.push({
        id: r._id,
        action: r.action,
        target: r.target ?? null,
        meta: r.meta ?? null,
        at: r.at,
        actorName: (actor as any)?.name ?? (actor as any)?.email ?? null,
      });
    }
    return out;
  },
});

// Daily retention sweep (cron). Bounded batch; self-reschedules when a full batch is hit so a large
// backlog drains across ticks without an unbounded scan.
export const pruneAudit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETAIN_MS;
    const old = await ctx.db
      .query("auditEvents")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PRUNE_BATCH);
    for (const r of old) await ctx.db.delete(r._id);
    if (old.length === PRUNE_BATCH) await ctx.scheduler.runAfter(0, internal.audit.pruneAudit, {});
  },
});
