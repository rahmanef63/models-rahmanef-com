// MCP tokens + tool data (deterministic half). The JSON-RPC dispatch + token minting live in
// mcpNode.ts ("use node"). We store only sha256(token); the raw bearer is shown to the user once.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";

export const _storeToken = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string(), label: v.string(), clientId: v.optional(v.string()), scope: v.optional(v.string()) },
  handler: (ctx, a) => ctx.db.insert("mcpTokens", { ...a, createdAt: Date.now() }),
});

export const _validateToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("mcpTokens").withIndex("by_hash", (q) => q.eq("tokenHash", a.tokenHash)).unique();
    if (!row || row.revoked) return null;
    return { _id: row._id, userId: row.userId };
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

// ---- tool data for an EXPLICIT userId (called by mcpNode.rpc AFTER token validation) ----
export const _providersForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, a) => {
    const rows = await ctx.db.query("modelCreds").withIndex("by_user", (q) => q.eq("userId", a.userId)).collect();
    return rows.map((r) => ({ provider: r.provider, kind: r.kind ?? "api_key" })); // never the ciphertext
  },
});

export const _usageForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, a) => {
    // bounded like usage.ts's myUsage — this is exposed to the MCP client as a tool result, an
    // unbounded scan here would grow forever as the user keeps chatting
    const rows = await ctx.db.query("usage").withIndex("by_user_at", (q) => q.eq("userId", a.userId)).order("desc").take(500);
    let promptTokens = 0, completionTokens = 0, errors = 0;
    const byModel: Record<string, number> = {};
    for (const r of rows) {
      promptTokens += r.promptTokens;
      completionTokens += r.completionTokens;
      if (r.status === "error") errors++;
      byModel[r.model] = (byModel[r.model] ?? 0) + 1;
    }
    return { requests: rows.length, promptTokens, completionTokens, errors, byModel };
  },
});
