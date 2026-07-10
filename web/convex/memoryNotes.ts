// Memory vault — md/json documents, the editable knowledge base behind the graph. Distinct from
// recalled facts: the "note" scope is NEVER injected into the prompt (_buildContext reads only
// user/workspace scopes), so a note can be a large md doc or a json blob without touching the recall
// budget. Obsidian-style [[Title]] links in a body become graph edges (memory-graph/lib/graph-links).
import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./_shared/auth";

const FORMATS = new Set(["md", "json"]);
const MAX_BODY = 8000;
const MAX_TITLE = 120;
// scopes the vault surfaces + edits: note docs first, then the recalled facts/summaries so they're
// all reachable + linkable in one tree. workspace/agent scopes stay out of the personal vault.
const VAULT_SCOPES = ["note", "user", "summary"];

// vault contents — the user's editable docs, newest first. Never returns archived rows.
export const listNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = [];
    for (const scope of VAULT_SCOPES) {
      const r = await ctx.db
        .query("memories")
        .withIndex("by_user_scope", (q) => q.eq("userId", userId).eq("scope", scope))
        .take(200);
      rows.push(...r.filter((m) => !m.archived));
    }
    return rows
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .map((m) => ({
        id: m._id, title: m.title ?? "", text: m.text, format: m.format ?? "md",
        scope: m.scope, kind: m.kind, pinned: !!m.pinned, updatedAt: m.updatedAt ?? m.createdAt,
      }));
  },
});

// create (scope "note") or edit any OWNED doc. json format is parse-validated at the trust boundary;
// title/body capped. Editing keeps the row's existing scope (a "user" fact stays injectable).
export const upsertNote = mutation({
  args: { id: v.optional(v.id("memories")), title: v.string(), text: v.string(), format: v.string() },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    if (!FORMATS.has(a.format)) throw new ConvexError({ code: "invalid_request", detail: "format must be md|json" });
    if (a.format === "json" && a.text.trim()) {
      try { JSON.parse(a.text); } catch { throw new ConvexError({ code: "invalid_request", detail: "body is not valid JSON" }); }
    }
    const title = a.title.trim().slice(0, MAX_TITLE);
    const text = a.text.slice(0, MAX_BODY);
    if (a.id) {
      const row = await ctx.db.get(a.id);
      if (!row || row.userId !== userId) throw new ConvexError({ code: "not_found", detail: "note not found" });
      await ctx.db.patch(a.id, { title, text, format: a.format, updatedAt: Date.now() });
      return a.id;
    }
    return await ctx.db.insert("memories", {
      userId, scope: "note", kind: "note", title, text, format: a.format,
      source: "ui", createdAt: Date.now(), updatedAt: Date.now(),
    });
  },
});
