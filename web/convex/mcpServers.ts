// External MCP server registry (OUTBOUND — we are the client). CRUD + probe-result recording.
// Encryption of custom headers is isolated to an action (getRandomValues is non-deterministic);
// the mutation only writes finished ciphertext (credentials.ts pattern). Raw header values NEVER
// leave via a public read — list responses expose only hasHeaders + probe status. The AI-SDK tool
// derivation lives in mcpClientNode.ts ("use node"); this file is the default runtime.
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireUser, requireWorkspaceRoleAction } from "./_shared/auth";
import { encryptSecret } from "./crypto";
import { assertSafeUrl } from "./_shared/ssrf";

const SLUG = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const TRANSPORTS = ["http", "sse"];

// public-safe projection — never the ciphertext, never decrypted header values
const mapRow = (r: any) => ({
  id: r._id,
  name: r.name,
  url: r.url,
  transport: r.transport,
  enabled: r.enabled !== false,
  hasHeaders: !!r.headersCiphertext,
  toolCount: (r.toolCache ?? []).length,
  tools: (r.toolCache ?? []).map((t: any) => ({ name: t.name, description: t.description })),
  lastProbeAt: r.lastProbeAt,
  lastProbeOk: r.lastProbeOk,
  lastProbeError: r.lastProbeError,
});

export const listServers = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db.query("mcpServers").withIndex("by_user", (q) => q.eq("userId", userId)).take(100);
    const scoped = a.workspaceId ? rows.filter((r) => r.workspaceId === a.workspaceId) : rows;
    return scoped.sort((x, y) => y.createdAt - x.createdAt).map(mapRow);
  },
});

// action: encrypt optional headers, then insert via the internal mutation (deterministic write).
export const addServer = action({
  args: {
    name: v.string(),
    url: v.string(),
    transport: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    headersJson: v.optional(v.string()), // raw JSON object of header name→value
  },
  handler: async (ctx, a): Promise<void> => {
    const userId = await requireUser(ctx);
    if (a.workspaceId) await requireWorkspaceRoleAction(ctx, a.workspaceId, "member");
    const name = a.name.trim().toLowerCase();
    if (!SLUG.test(name)) throw new ConvexError({ code: "invalid_request", detail: "name must be a slug: a-z 0-9 _ - (≤32)" });
    if (!TRANSPORTS.includes(a.transport)) throw new ConvexError({ code: "invalid_request", detail: "transport must be http|sse" });
    assertSafeUrl(a.url); // https/http only + blocks private/loopback/metadata (SSRF guard)
    let headersCiphertext: string | undefined;
    if (a.headersJson && a.headersJson.trim()) {
      let parsed: unknown;
      try { parsed = JSON.parse(a.headersJson); } catch { throw new ConvexError({ code: "invalid_request", detail: "headers must be valid JSON" }); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ConvexError({ code: "invalid_request", detail: "headers must be a JSON object" });
      headersCiphertext = await encryptSecret(JSON.stringify(parsed));
    }
    await ctx.runMutation(internal.mcpServers._insert, { userId, workspaceId: a.workspaceId, name, url: a.url, transport: a.transport, headersCiphertext });
  },
});

export const _insert = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    url: v.string(),
    transport: v.string(),
    headersCiphertext: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const mine = await ctx.db.query("mcpServers").withIndex("by_user", (q) => q.eq("userId", a.userId)).take(100);
    if (mine.some((r) => r.name === a.name)) throw new ConvexError({ code: "conflict", detail: `A server named "${a.name}" already exists.` });
    const now = Date.now();
    await ctx.db.insert("mcpServers", { userId: a.userId, workspaceId: a.workspaceId, name: a.name, url: a.url, transport: a.transport, headersCiphertext: a.headersCiphertext, enabled: true, createdAt: now, updatedAt: now });
  },
});

// action: edit name/url/transport + optionally re-encrypt (or clear) headers, then internal _update.
export const updateServer = action({
  args: { id: v.id("mcpServers"), name: v.string(), url: v.string(), transport: v.string(), headersJson: v.optional(v.string()) },
  handler: async (ctx, a): Promise<void> => {
    const userId = await requireUser(ctx);
    const name = a.name.trim().toLowerCase();
    if (!SLUG.test(name)) throw new ConvexError({ code: "invalid_request", detail: "name must be a slug: a-z 0-9 _ - (≤32)" });
    if (!TRANSPORTS.includes(a.transport)) throw new ConvexError({ code: "invalid_request", detail: "transport must be http|sse" });
    assertSafeUrl(a.url); // re-check on edit (SSRF guard)
    // headersJson: undefined = leave as-is · "" = clear · non-empty = replace (re-encrypt)
    let headersCiphertext: string | undefined;
    let clearHeaders = false;
    if (a.headersJson !== undefined) {
      if (!a.headersJson.trim()) clearHeaders = true;
      else {
        let parsed: unknown;
        try { parsed = JSON.parse(a.headersJson); } catch { throw new ConvexError({ code: "invalid_request", detail: "headers must be valid JSON" }); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ConvexError({ code: "invalid_request", detail: "headers must be a JSON object" });
        headersCiphertext = await encryptSecret(JSON.stringify(parsed));
      }
    }
    await ctx.runMutation(internal.mcpServers._update, { id: a.id, userId, name, url: a.url, transport: a.transport, headersCiphertext, clearHeaders });
  },
});

export const _update = internalMutation({
  args: { id: v.id("mcpServers"), userId: v.id("users"), name: v.string(), url: v.string(), transport: v.string(), headersCiphertext: v.optional(v.string()), clearHeaders: v.boolean() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== a.userId) throw new ConvexError({ code: "not_found", detail: "server not found" });
    const mine = await ctx.db.query("mcpServers").withIndex("by_user", (q) => q.eq("userId", a.userId)).take(100);
    if (mine.some((r) => r.name === a.name && r._id !== a.id)) throw new ConvexError({ code: "conflict", detail: `A server named "${a.name}" already exists.` });
    const patch: any = { name: a.name, url: a.url, transport: a.transport, updatedAt: Date.now() };
    if (a.headersCiphertext !== undefined) patch.headersCiphertext = a.headersCiphertext;
    else if (a.clearHeaders) patch.headersCiphertext = undefined;
    // a changed url/transport invalidates the cached tool list — drop it so a stale probe can't linger.
    if (row.url !== a.url || row.transport !== a.transport) { patch.toolCache = []; patch.lastProbeAt = undefined; patch.lastProbeOk = undefined; patch.lastProbeError = undefined; }
    await ctx.db.patch(a.id, patch);
  },
});

export const toggleServer = mutation({
  args: { id: v.id("mcpServers"), enabled: v.boolean() },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== userId) throw new ConvexError({ code: "not_found", detail: "server not found" });
    await ctx.db.patch(a.id, { enabled: a.enabled, updatedAt: Date.now() });
  },
});

export const removeServer = mutation({
  args: { id: v.id("mcpServers") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(a.id);
    if (!row || row.userId !== userId) throw new ConvexError({ code: "not_found", detail: "server not found" });
    await ctx.db.delete(a.id);
  },
});

// ── internal (node module reads these) ──────────────────────────────────────
// enabled rows for a user, WITH ciphertext so the node module can decrypt per call. Internal only.
export const _enabledServers = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, a) => {
    const rows = await ctx.db.query("mcpServers").withIndex("by_user", (q) => q.eq("userId", a.userId)).take(100);
    // per-workspace isolation (mirrors listServers scoping): a personal server (no workspaceId) is
    // ambient — usable in any context; a workspace-scoped server is visible ONLY inside its own
    // workspace. Without this an agent in workspace A could invoke a server the same user registered
    // in workspace B, breaking the "per-workspace isolation" claim.
    return rows
      .filter((r) => r.enabled !== false && (r.workspaceId == null || r.workspaceId === a.workspaceId))
      .map((r) => ({ id: r._id, name: r.name, url: r.url, transport: r.transport, headersCiphertext: r.headersCiphertext, toolCache: r.toolCache ?? [] }));
  },
});

// single owned row for a probe (includes ciphertext — internal only)
export const _getForProbe = internalQuery({
  args: { serverId: v.id("mcpServers"), userId: v.id("users") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.serverId);
    if (!row || row.userId !== a.userId) return null;
    return { id: row._id, name: row.name, url: row.url, transport: row.transport, headersCiphertext: row.headersCiphertext };
  },
});

export const _recordProbe = internalMutation({
  args: {
    serverId: v.id("mcpServers"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    tools: v.optional(v.array(v.object({ name: v.string(), description: v.string(), inputSchema: v.any() }))),
  },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.serverId);
    if (!row) return;
    await ctx.db.patch(a.serverId, {
      lastProbeAt: Date.now(),
      lastProbeOk: a.ok,
      lastProbeError: a.ok ? undefined : a.error,
      ...(a.ok && a.tools ? { toolCache: a.tools } : {}),
      updatedAt: Date.now(),
    });
  },
});
