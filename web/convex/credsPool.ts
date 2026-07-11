// Multi-key BYOK write path (provider-pool 2.3). The pool ENGINE (providerPool.pickCredentials)
// already rotates over every modelCreds row for a provider — this file is the surface that lets a
// user register >1 personal api key per provider (labeled + prioritized), list them, and remove
// one. setCredential (credentials.ts) still writes the primary key by upsert; addCredential here
// always INSERTS an additional row. OAuth providers are single-credential and rejected.
import { action, mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser, requireWorkspaceRole, requireWorkspaceRoleAction } from "./_shared/auth";
import { encryptSecret } from "./crypto";

const OAUTH_ONLY = new Set(["openai-codex", "anthropic-oauth", "github-copilot"]);
const clampPriority = (p: number | undefined) => (p == null ? undefined : Math.max(0, Math.min(999, Math.round(p))));

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

// ── workspace-SHARED key pool (team creds) ───────────────────────────────────
// The read side (providerPool.pickCredentials) already fails over across workspace-shared rows; this
// is the missing WRITE half. Every entry point is role-gated on the workspace (add/delete = admin+,
// list = member+) and appends an audit row — the whole reason cred.shared/cred.deleted exist.

// internal: pure INSERT of a workspace-shared api_key row + its audit trail (encryption done above).
export const insertWorkspaceCred = internalMutation({
  args: { actorUserId: v.id("users"), workspaceId: v.id("workspaces"), provider: v.string(), ciphertext: v.string(), label: v.optional(v.string()), priority: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await ctx.db.insert("modelCreds", {
      userId: a.actorUserId, workspaceId: a.workspaceId, provider: a.provider, kind: "api_key",
      ciphertext: a.ciphertext, label: a.label, priority: a.priority, updatedAt: Date.now(),
    });
    await ctx.db.insert("auditEvents", { workspaceId: a.workspaceId, actorUserId: a.actorUserId, action: "cred.shared", target: a.provider, meta: { label: a.label }, at: Date.now() });
  },
});

// add a workspace-SHARED key — every member's calls can fail over onto it. Admin+ only (a shared key
// spends on the workspace's behalf). Same trust-boundary clamps as addCredential; OAuth rejected.
export const addWorkspaceCredential = action({
  args: { workspaceId: v.id("workspaces"), provider: v.string(), apiKey: v.string(), label: v.optional(v.string()), priority: v.optional(v.number()) },
  handler: async (ctx, a): Promise<void> => {
    const { userId } = await requireWorkspaceRoleAction(ctx, a.workspaceId, "admin");
    if (!a.apiKey) throw new ConvexError({ code: "invalid_request", detail: "apiKey required" });
    if (OAUTH_ONLY.has(a.provider)) throw new ConvexError({ code: "invalid_request", detail: "OAuth providers are single-credential — no key pool" });
    const ciphertext = await encryptSecret(a.apiKey);
    await ctx.runMutation(internal.credsPool.insertWorkspaceCred, { actorUserId: userId, workspaceId: a.workspaceId, provider: a.provider, ciphertext, label: a.label?.trim().slice(0, 40) || undefined, priority: clampPriority(a.priority) });
  },
});

// per-key list of a workspace's SHARED creds for one provider (indexed by_ws_provider). Member+ can
// see that a shared key exists (label/health) but NEVER the ciphertext. Provider is required — there
// is no by_ws-only index, and the manager is always scoped to a provider anyway.
export const listWorkspaceCredentials = query({
  args: { workspaceId: v.id("workspaces"), provider: v.string() },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const rows = await ctx.db.query("modelCreds").withIndex("by_ws_provider", (q) => q.eq("workspaceId", a.workspaceId).eq("provider", a.provider)).take(50);
    return rows
      .filter((r) => (r.kind ?? "api_key") === "api_key")
      .map((r) => ({ credId: r._id, provider: r.provider, label: r.label, priority: r.priority ?? 100, status: r.status ?? "ok", cooldownUntil: r.cooldownUntil, lastCheckedOk: r.lastCheckedOk, lastCheckedAt: r.lastCheckedAt }));
  },
});

// remove ONE shared key. Role-gated on the cred's OWN workspace (admin+) — NOT creator-gated, so any
// workspace admin can revoke a shared key, unlike deleteCredentialById's personal userId gate.
export const deleteWorkspaceCredentialById = mutation({
  args: { credId: v.id("modelCreds") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.credId);
    if (!row || !row.workspaceId) return; // gone, or a personal cred — use deleteCredentialById for those
    const { userId } = await requireWorkspaceRole(ctx, row.workspaceId, "admin");
    await ctx.db.delete(a.credId);
    await ctx.db.insert("auditEvents", { workspaceId: row.workspaceId, actorUserId: userId, action: "cred.deleted", target: row.provider, meta: { kind: row.kind, shared: true }, at: Date.now() });
  },
});
