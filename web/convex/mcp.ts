// MCP tokens + tool data (deterministic half). The JSON-RPC dispatch + token minting live in
// mcpNode.ts ("use node"). We store only sha256(token); the raw bearer is shown to the user once.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";

export const _storeToken = internalMutation({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), tokenHash: v.string(), label: v.string(), clientId: v.optional(v.string()), scope: v.optional(v.string()) },
  handler: (ctx, a) => ctx.db.insert("mcpTokens", { ...a, createdAt: Date.now() }),
});

export const _validateToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("mcpTokens").withIndex("by_hash", (q) => q.eq("tokenHash", a.tokenHash)).unique();
    if (!row || row.revoked) return null;
    return { _id: row._id, userId: row.userId, workspaceId: row.workspaceId };
  },
});

export const _touchToken = internalMutation({
  args: { id: v.id("mcpTokens") },
  handler: (ctx, a) => ctx.db.patch(a.id, { lastUsedAt: Date.now() }),
});

export const listMcpTokens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("mcpTokens").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").collect();
    return rows.map((r) => ({ id: r._id, label: r.label, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt ?? null, revoked: !!r.revoked }));
  },
});

export const revokeMcpToken = mutation({
  args: { id: v.id("mcpTokens") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== userId) return; // not the caller's token — no-op
    await ctx.db.patch(a.id, { revoked: true });
  },
});

// Panic button: revoke every active token the caller owns. Returns how many were revoked.
// by_user scan matches listMcpTokens; a single user's token count is small.
export const revokeAllMcpTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db.query("mcpTokens").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    let n = 0;
    for (const r of rows) if (!r.revoked) { await ctx.db.patch(r._id, { revoked: true }); n++; }
    return n;
  },
});

// (tool data for an explicit userId now lives with its slice: credentials.providersForUser +
// usage.usageForUser — the shared toolHandlers use those so the agent + MCP surfaces can't diverge.)
