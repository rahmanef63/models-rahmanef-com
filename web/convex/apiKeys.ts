// Workspace-bound API keys (`sk-rr-…`) for the /v1 OpenAI/Anthropic-compatible gateway. Only
// sha256(key) is stored; the raw is shown once. A key acts as its issuer inside ONE workspace and
// spends that workspace's creds. Web Crypto works in the Convex default runtime — no "use node".
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";

async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const issueApiKey = mutation({
  args: { workspaceId: v.id("workspaces"), label: v.string() },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const raw = "sk-rr-" + b64url(crypto.getRandomValues(new Uint8Array(32)));
    await ctx.db.insert("apiKeys", { userId, workspaceId: a.workspaceId, keyHash: await sha256hex(raw), prefix: raw.slice(0, 14) + "…", label: a.label.trim().slice(0, 60) || "key", createdAt: Date.now() });
    return raw; // shown/copied exactly once
  },
});

export const listApiKeys = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const rows = await ctx.db.query("apiKeys").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(50);
    return rows.filter((r) => !r.revoked).map((r) => ({ id: r._id, prefix: r.prefix, label: r.label, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt ?? null }));
  },
});

export const revokeApiKey = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return;
    await requireWorkspaceRole(ctx, row.workspaceId, "member");
    await ctx.db.patch(a.id, { revoked: true });
  },
});

// hash → {userId, workspaceId, apiKeyId} or null. Called by the /v1 gateway action (never session auth).
export const _validate = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("apiKeys").withIndex("by_hash", (q) => q.eq("keyHash", a.keyHash)).unique();
    if (!row || row.revoked) return null;
    return { userId: row.userId, workspaceId: row.workspaceId, apiKeyId: row._id };
  },
});

export const _touch = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: (ctx, a) => ctx.db.patch(a.id, { lastUsedAt: Date.now() }),
});
