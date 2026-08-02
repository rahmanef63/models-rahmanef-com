// audit-log slice — table defs (spread into convex/schema.ts, the byok tablesExport pattern).
// auditEvents is APPEND-ONLY: rows are inserted inside the acting mutation's transaction and are
// never patched or deleted except by the 90-day retention sweep (audit.pruneAudit). One immutable
// record per sensitive workspace action (role changes, member removal, invite accept, cred delete).
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const auditLogTables = {
  auditEvents: defineTable({
    workspaceId: v.id("workspaces"), // tenant boundary — the audit trail is per-workspace
    actorUserId: v.id("users"), // who did it
    action: v.string(), // dotted verb, e.g. 'member.role_changed' | 'member.removed' | 'cred.deleted'
    target: v.optional(v.string()), // subject id/slug (a userId, provider, etc.)
    meta: v.optional(v.any()), // bounded extra context (from/to role, …) — never secret material
    at: v.number(),
  })
    .index("by_ws_at", ["workspaceId", "at"]) // admin card: recent events for this workspace
    .index("by_at", ["at"]), // retention sweep: prune globally by age
};
