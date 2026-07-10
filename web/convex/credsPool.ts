// Multi-key BYOK write path (provider-pool 2.3). The pool ENGINE (providerPool.pickCredentials)
// already rotates over every modelCreds row for a provider — this file is the surface that lets a
// user register >1 personal api key per provider (labeled + prioritized), list them, and remove
// one. setCredential (credentials.ts) still writes the primary key by upsert; addCredential here
// always INSERTS an additional row. OAuth providers are single-credential and rejected.
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";
import { encryptSecret } from "./crypto";

const OAUTH_ONLY = new Set(["openai-codex", "anthropic-oauth"]);

// internal: pure INSERT of a personal api_key pool row (encryption happened in the action).
export const insertCred = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), ciphertext: v.string(), label: v.optional(v.string()), priority: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await ctx.db.insert("modelCreds", {
      userId: a.userId, provider: a.provider, kind: "api_key", ciphertext: a.ciphertext,
      label: a.label, priority: a.priority, updatedAt: Date.now(),
    });
  },
});

// add ANOTHER key for a provider — populates the failover pool. Distinct from setCredential's
// upsert. Trust boundary: label ≤40 chars, priority clamped [0,999] (lower tried first), OAuth
// providers rejected (they can't be pooled). Encryption is isolated to this action (crypto uses
// getRandomValues) so the mutation stays deterministic.
export const addCredential = action({
  args: { provider: v.string(), apiKey: v.string(), label: v.optional(v.string()), priority: v.optional(v.number()) },
  handler: async (ctx, a): Promise<void> => {
    const userId = await requireUser(ctx);
    if (!a.apiKey) throw new ConvexError({ code: "invalid_request", detail: "apiKey required" });
    if (OAUTH_ONLY.has(a.provider)) throw new ConvexError({ code: "invalid_request", detail: "OAuth providers are single-credential — no key pool" });
    const priority = a.priority == null ? undefined : Math.max(0, Math.min(999, Math.round(a.priority)));
    const label = a.label?.trim().slice(0, 40) || undefined;
    const ciphertext = await encryptSecret(a.apiKey);
    await ctx.runMutation(internal.credsPool.insertCred, { userId, provider: a.provider, ciphertext, label, priority });
  },
});

// per-key list for the multi-key manager — one row per credential, PERSONAL only, NEVER ciphertext.
export const listCredentials = query({
  args: { provider: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = a.provider
      ? await ctx.db.query("modelCreds").withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", a.provider!)).take(50)
      : await ctx.db.query("modelCreds").withIndex("by_user", (q) => q.eq("userId", userId)).take(200);
    return rows
      .filter((r) => r.workspaceId === undefined && (r.kind ?? "api_key") === "api_key")
      .map((r) => ({
        credId: r._id, provider: r.provider, label: r.label,
        priority: r.priority ?? 100, status: r.status ?? "ok", cooldownUntil: r.cooldownUntil,
        lastCheckedOk: r.lastCheckedOk, lastCheckedAt: r.lastCheckedAt,
      }));
  },
});

// remove ONE key by id (ownership-gated, idempotent). Shared-cred deletes stay audited.
export const deleteCredentialById = mutation({
  args: { credId: v.id("modelCreds") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.credId);
    if (!row || row.userId !== userId) return; // idempotent + ownership gate
    await ctx.db.delete(a.credId);
    if (row.workspaceId) await ctx.db.insert("auditEvents", { workspaceId: row.workspaceId, actorUserId: userId, action: "cred.deleted", target: row.provider, meta: { kind: row.kind }, at: Date.now() });
  },
});
