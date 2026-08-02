// embeds — CRUD for the drop-in chat-widget tokens. The token is PUBLISHABLE (it ships in the
// customer's client JS), so it's stored plaintext + shown in the dashboard; safety is the origin
// allowlist + rate limit + the owner's spend cap, NOT secrecy. The widget runs as the OWNER,
// spending their creds (embedChat.reply). Personal embeds have no dollar cap — attach a workspace
// with a monthly cap for a hard ceiling; the per-embed rate limit is the always-on backstop.
import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./_shared/auth";

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const isRef = (r: string) => { const i = r.indexOf("/"); return i > 0 && i < r.length - 1; };
// normalize a user-entered origin/URL to a bare origin (scheme://host[:port]); drops path/query.
function normOrigin(raw: string): string | null {
  const t = raw.trim(); if (!t) return null;
  try { return new URL(t.includes("://") ? t : `https://${t}`).origin; } catch { return null; }
}
const view = (e: any) => ({ id: e._id, title: e.title, model: e.model, token: e.token, allowedOrigins: e.allowedOrigins, enabled: e.enabled, greeting: e.greeting ?? "", systemPrompt: e.systemPrompt ?? "", createdAt: e.createdAt });

export const listEmbeds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return (await ctx.db.query("embeds").withIndex("by_user", (q) => q.eq("userId", userId)).take(100)).sort((a, b) => b.createdAt - a.createdAt).map(view);
  },
});

export const createEmbed = mutation({
  args: { title: v.string(), model: v.string(), systemPrompt: v.optional(v.string()), greeting: v.optional(v.string()), allowedOrigins: v.array(v.string()), workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, a): Promise<{ token: string }> => {
    const userId = await requireUser(ctx);
    if (!isRef(a.model)) throw new ConvexError({ code: "invalid_request", detail: 'model must be "provider/model"' });
    const origins = [...new Set(a.allowedOrigins.map(normOrigin).filter((o): o is string => !!o))].slice(0, 20);
    if (!origins.length) throw new ConvexError({ code: "invalid_request", detail: "add at least one website origin, e.g. https://yoursite.com" });
    const token = "pk_" + b64url(crypto.getRandomValues(new Uint8Array(24)));
    await ctx.db.insert("embeds", {
      userId, workspaceId: a.workspaceId, token,
      title: a.title.trim().slice(0, 60) || "Assistant", model: a.model.trim(),
      systemPrompt: a.systemPrompt?.trim() ? a.systemPrompt.trim().slice(0, 2000) : undefined,
      greeting: a.greeting?.trim() ? a.greeting.trim().slice(0, 300) : undefined,
      allowedOrigins: origins, enabled: true, createdAt: Date.now(),
    });
    return { token };
  },
});

export const setEmbedEnabled = mutation({
  args: { id: v.id("embeds"), enabled: v.boolean() },
  handler: async (ctx, a) => { const userId = await requireUser(ctx); const row = await ctx.db.get(a.id); if (row && row.userId === userId) await ctx.db.patch(a.id, { enabled: a.enabled }); },
});

export const removeEmbed = mutation({
  args: { id: v.id("embeds") },
  handler: async (ctx, a) => { const userId = await requireUser(ctx); const row = await ctx.db.get(a.id); if (row && row.userId === userId) await ctx.db.delete(a.id); },
});

// internal: resolve an embed by its public token for the chat endpoint (embedChat.reply).
export const _validate = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("embeds").withIndex("by_token", (q) => q.eq("token", a.token)).unique();
    if (!row) return null;
    return { id: row._id, userId: row.userId, workspaceId: row.workspaceId, model: row.model, systemPrompt: row.systemPrompt, allowedOrigins: row.allowedOrigins, enabled: row.enabled };
  },
});
