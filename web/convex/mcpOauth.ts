// OAuth 2.1 for the MCP server (deterministic half). Token/code minting + PKCE live in
// mcpOauthNode.ts ("use node"). Public clients (PKCE, no secret). Codes stored as sha256, single-use.
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const _registerClient = internalMutation({
  args: { clientId: v.string(), name: v.string(), redirectUris: v.array(v.string()) },
  handler: (ctx, a) => ctx.db.insert("mcpClients", { ...a, createdAt: Date.now() }),
});

export const _getClient = internalQuery({
  args: { clientId: v.string() },
  handler: (ctx, a) => ctx.db.query("mcpClients").withIndex("by_clientId", (q) => q.eq("clientId", a.clientId)).unique(),
});

// public: lets the consent page show the client name + verify the redirect_uri. No secrets.
export const clientInfo = query({
  args: { clientId: v.string() },
  handler: async (ctx, a) => {
    const c = await ctx.db.query("mcpClients").withIndex("by_clientId", (q) => q.eq("clientId", a.clientId)).unique();
    return c ? { clientId: c.clientId, name: c.name, redirectUris: c.redirectUris } : null;
  },
});

export const _storeAuthCode = internalMutation({
  args: { codeHash: v.string(), userId: v.id("users"), clientId: v.string(), redirectUri: v.string(), codeChallenge: v.string(), scope: v.string(), expiresAt: v.number() },
  handler: (ctx, a) => ctx.db.insert("mcpAuthCodes", { ...a, used: false }),
});

// Atomically consume a code — single-use + TTL enforced in this transaction.
export const _consumeAuthCode = internalMutation({
  args: { codeHash: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("mcpAuthCodes").withIndex("by_codeHash", (q) => q.eq("codeHash", a.codeHash)).unique();
    if (!row || row.used || Date.now() > row.expiresAt) return null;
    await ctx.db.patch(row._id, { used: true });
    return { userId: row.userId, clientId: row.clientId, redirectUri: row.redirectUri, codeChallenge: row.codeChallenge, scope: row.scope };
  },
});
