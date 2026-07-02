// Per-user BYOK CRUD. tenantId is ALWAYS derived from the authed session (getAuthUserId),
// never taken from the client. Encryption (uses getRandomValues) is isolated to an action so
// mutations stay deterministic; the mutation only writes the finished ciphertext.
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { encryptSecret } from "./crypto";

export const listConfiguredProviders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("modelCreds")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => ({ provider: r.provider, kind: r.kind ?? "api_key" })); // never the ciphertext
  },
});

export const setCredential = action({
  args: { provider: v.string(), apiKey: v.string() },
  handler: async (ctx, a): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (!a.apiKey) throw new Error("apiKey required");
    const ciphertext = await encryptSecret(a.apiKey);
    await ctx.runMutation(internal.credentials.store, { userId, provider: a.provider, kind: "api_key", ciphertext });
  },
});

// internal: upsert a credential (api_key or oauth). Called by setCredential + the OAuth flows.
// A successful write also RELEASES any refresh lease.
export const store = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), kind: v.string(), ciphertext: v.string(), expires: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { kind: a.kind, ciphertext: a.ciphertext, expires: a.expires, updatedAt: Date.now(), refreshLeaseUntil: undefined });
    else await ctx.db.insert("modelCreds", { userId: a.userId, provider: a.provider, kind: a.kind, ciphertext: a.ciphertext, expires: a.expires, updatedAt: Date.now() });
  },
});

// internal: single-flight lease so only ONE concurrent request refreshes a rotating OAuth
// token. Returns win:true only if the token is actually stale AND no live lease is held.
export const claimRefresh = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), marginMs: v.number() },
  handler: async (ctx, a): Promise<{ win: boolean }> => {
    const row = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .unique();
    if (!row || row.kind !== "oauth") return { win: false };
    const now = Date.now();
    if (row.expires && now < row.expires - a.marginMs) return { win: false }; // still fresh
    if (row.refreshLeaseUntil && now < row.refreshLeaseUntil) return { win: false }; // another refresh in flight
    await ctx.db.patch(row._id, { refreshLeaseUntil: now + 30_000 });
    return { win: true };
  },
});

export const deleteCredential = mutation({
  args: { provider: v.string() },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const row = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", a.provider))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

// internal: hand the ciphertext row to the chat action (which decrypts server-side)
export const getCiphertext = internalQuery({
  args: { userId: v.id("users"), provider: v.string() },
  handler: (ctx, a) =>
    ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .unique(),
});
