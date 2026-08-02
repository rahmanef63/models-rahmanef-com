// Per-user BYOK CRUD. tenantId is ALWAYS derived from the authed session (getAuthUserId),
// never taken from the client. Encryption (uses getRandomValues) is isolated to an action so
// mutations stay deterministic; the mutation only writes the finished ciphertext.
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";
import { encryptSecret } from "./crypto";

// never the ciphertext — last-check fields drive the health badge in the Providers list
const mapCred = (r: any) => ({
  provider: r.provider,
  kind: r.kind ?? "api_key",
  models: r.models, // manual custom-provider models — feeds the chat picker (undefined for built-ins)
  lastCheckedAt: r.lastCheckedAt,
  lastCheckedOk: r.lastCheckedOk,
  lastCheckedCode: r.lastCheckedCode,
  lastCheckedDetail: r.lastCheckedDetail,
});

export const listConfiguredProviders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("modelCreds").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    // one card per provider — collapse multi-key pools + keyCount. Representative = the OLDEST row
    // (min _creationTime), the same row store()/_recordCheck target via .first(). Using max-updatedAt
    // would pick a freshly-added pool key (newest updatedAt, no health yet) and flip the card to
    // NOT-TESTED the moment a 2nd key is added, while the badge write lands on the old row — they'd
    // never agree. Per-key status lives in the ProviderKeys expander instead.
    const byProvider = new Map<string, { row: any; count: number }>();
    for (const r of rows) {
      const cur = byProvider.get(r.provider);
      if (!cur) byProvider.set(r.provider, { row: r, count: 1 });
      else { cur.count++; if (r._creationTime < cur.row._creationTime) cur.row = r; }
    }
    return [...byProvider.values()].map(({ row, count }) => ({ ...mapCred(row), keyCount: count }));
  },
});

// explicit-userId sibling of listConfiguredProviders — feeds the shared list_my_providers tool
// (agent + MCP). Same rich shape; never the ciphertext. userId is pre-authorized by the caller.
export const providersForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, a) => {
    const rows = await ctx.db.query("modelCreds").withIndex("by_user", (q) => q.eq("userId", a.userId)).collect();
    return rows.map(mapCred);
  },
});

export const setCredential = action({
  args: { provider: v.string(), apiKey: v.string() },
  handler: async (ctx, a): Promise<void> => {
    const userId = await requireUser(ctx);
    if (!a.apiKey) throw new ConvexError({ code: "invalid_request", detail: "apiKey required" });
    const ciphertext = await encryptSecret(a.apiKey);
    await ctx.runMutation(internal.credentials.store, { userId, provider: a.provider, kind: "api_key", ciphertext });
  },
});

// internal: record the result of a connectivity test (chat.ts testCredential) against this
// credential — never touches the ciphertext itself.
export const _recordCheck = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), ok: v.boolean(), code: v.optional(v.string()), detail: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const row = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .first(); // personal primary — never .unique: a provider may hold multiple pool keys now
    if (!row) return; // credential was deleted mid-check — nothing to record
    await ctx.db.patch(row._id, { lastCheckedAt: Date.now(), lastCheckedOk: a.ok, lastCheckedCode: a.code, lastCheckedDetail: a.detail });
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
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .first(); // .first not .unique: a provider may now hold multiple personal pool keys — upsert the primary
    // a fresh key write un-bricks the row: reset the pool-health verdict so re-pasting a valid key
    // into a cred that pickCredentials had benched (dead/exhausted) brings it back into rotation.
    if (existing) await ctx.db.patch(existing._id, { kind: a.kind, ciphertext: a.ciphertext, expires: a.expires, updatedAt: Date.now(), refreshLeaseUntil: undefined, status: "ok", cooldownUntil: undefined, backoffLevel: 0, lastErrorCode: undefined });
    else await ctx.db.insert("modelCreds", { userId: a.userId, provider: a.provider, kind: a.kind, ciphertext: a.ciphertext, expires: a.expires, updatedAt: Date.now() });
  },
});

// internal: connect a provider from a TOOL (explicit userId; ciphertext already encrypted in the
// node handler). Upserts the personal api_key row like store(), + an optional custom `endpoint`
// (BYOK custom OpenAI-compatible provider), and un-bricks the pool-health verdict on rewrite.
export const _connectForUser = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), ciphertext: v.string(), endpoint: v.optional(v.string()), protocol: v.optional(v.string()), models: v.optional(v.array(v.string())) },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .first();
    // only overwrite models when this call supplies them — a plain key-refresh must not wipe a saved list
    const modelsPatch = a.models !== undefined ? { models: a.models } : {};
    if (existing) { await ctx.db.patch(existing._id, { kind: "api_key", ciphertext: a.ciphertext, endpoint: a.endpoint, protocol: a.protocol, ...modelsPatch, updatedAt: Date.now(), status: "ok", cooldownUntil: undefined, backoffLevel: 0, lastErrorCode: undefined, refreshLeaseUntil: undefined }); return; }
    await ctx.db.insert("modelCreds", { userId: a.userId, provider: a.provider, kind: "api_key", ciphertext: a.ciphertext, endpoint: a.endpoint, protocol: a.protocol, models: a.models, updatedAt: Date.now() });
  },
});

// edit a custom provider's manual model list WITHOUT re-entering the key (patches the primary personal
// row's `models` only — ciphertext/endpoint untouched). This is the "add models, don't re-paste the key"
// path the chat picker + Providers editor use. Public + requireUser-gated.
export const setProviderModels = mutation({
  args: { provider: v.string(), models: v.array(v.string()) },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", a.provider))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .first();
    if (!row) throw new ConvexError({ code: "not_connected", detail: `"${a.provider}" isn't connected — add it first.` });
    const models = [...new Set(a.models.map((s) => s.trim()).filter(Boolean))].slice(0, 100);
    await ctx.db.patch(row._id, { models, updatedAt: Date.now() });
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
    const userId = await requireUser(ctx);
    // provider-level "remove" = disconnect the provider = drop ALL its personal keys (the whole pool).
    // Shared creds (workspaceId set) are managed via the workspace path, not this personal card; a
    // single key is removable individually via credsPool.deleteCredentialById.
    const rows = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", a.provider))
      .take(50);
    for (const row of rows) {
      if (row.workspaceId !== undefined) continue; // personal disconnect only
      await ctx.db.delete(row._id);
    }
  },
});

// internal: hand the ciphertext row to the chat action (which decrypts server-side)
// the caller's PERSONAL cred for a provider (workspaceId unset). Used by the codex/claude OAuth
// paths (always personal — subscriptions can't be shared). `.first()` not `.unique()` so a stray
// workspace-shared row for the same provider can't break the personal read.
export const getCiphertext = internalQuery({
  args: { userId: v.id("users"), provider: v.string() },
  handler: (ctx, a) =>
    ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .first(),
});

// Resolve which credential a call uses, honoring the workspace's credPolicy:
//   personal-first (default): my key, else the workspace-shared key
//   workspace-first: shared key, else my personal   ·   *-only: no fallback
// A workspace-shared cred (workspaceId set) lets a team burn ONE key; removing a member cuts their
// access because the SPEND path (chat/runAgent) requires live membership before it ever gets here.
export const resolveCred = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), provider: v.string() },
  handler: async (ctx, a) => {
    let policy = "personal-first";
    if (a.workspaceId) policy = ((await ctx.db.get(a.workspaceId)) as { credPolicy?: string } | null)?.credPolicy ?? "personal-first";
    const personal = () =>
      ctx.db.query("modelCreds").withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider)).filter((q) => q.eq(q.field("workspaceId"), undefined)).first();
    const shared = () =>
      a.workspaceId ? ctx.db.query("modelCreds").withIndex("by_ws_provider", (q) => q.eq("workspaceId", a.workspaceId!).eq("provider", a.provider)).first() : Promise.resolve(null);
    const order = policy.startsWith("workspace") ? [shared, personal] : [personal, shared];
    for (const get of (policy.endsWith("-only") ? [order[0]] : order)) {
      const row = await get();
      if (row) return row;
    }
    return null;
  },
});
