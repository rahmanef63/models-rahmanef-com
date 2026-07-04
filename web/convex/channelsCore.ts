// channels-core — CRUD for inbound messaging channels + the slug resolver. Secrets (bot token +
// the platform webhook secret_token) are AES-256-GCM encrypted (crypto.ts); the webhook secret is
// shown ONCE on create/rotate so the user can register it with the platform. Admin-only writes
// (requireWorkspaceRole 'admin'). Web Crypto works in the default runtime — no "use node".
// The ingest→callForUser→reply loop lives in the sibling channelsIngest.ts + channelTelegram.ts.
import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import { encryptSecret, decryptSecret } from "./crypto";

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const KINDS = ["telegram"]; // registry-driven; only telegram ships in this wave
const bad = (detail: string) => new ConvexError({ code: "invalid_request", detail });

// list channels for a workspace (viewer+). Never returns the ciphertext.
export const listChannels = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const rows = await ctx.db.query("channels").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(50);
    return rows.map((r) => ({
      id: r._id, kind: r.kind, name: r.name, slug: r.slug, agentId: r.agentId ?? null,
      enabled: r.enabled !== false, lastInboundAt: r.lastInboundAt ?? null, lastError: r.lastError ?? null, createdAt: r.createdAt,
    }));
  },
});

// create a channel: store the bot token + a freshly-minted webhook secret_token, encrypted. Returns
// the slug (→ webhook URL) and the raw secretToken (shown once — set it on the platform via setWebhook).
export const createChannel = mutation({
  args: { workspaceId: v.id("workspaces"), kind: v.string(), name: v.string(), botToken: v.string(), agentId: v.optional(v.id("agentDefs")) },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    if (!KINDS.includes(a.kind)) throw bad(`Unsupported channel kind "${a.kind}".`);
    if (!a.botToken.trim()) throw bad("Bot token is required.");
    const secretToken = rand(24);
    const slug = rand(18);
    const id = await ctx.db.insert("channels", {
      workspaceId: a.workspaceId, userId, kind: a.kind, name: a.name.trim().slice(0, 60) || a.kind,
      slug, secretCiphertext: await encryptSecret(JSON.stringify({ botToken: a.botToken.trim(), secretToken })),
      agentId: a.agentId, enabled: true, createdAt: Date.now(),
    });
    return { id, slug, secretToken }; // secretToken shown once — never stored in plaintext
  },
});

async function requireChannelAdmin(ctx: any, id: any) {
  const row = await ctx.db.get(id);
  if (!row) throw bad("Channel not found.");
  await requireWorkspaceRole(ctx, row.workspaceId, "admin");
  return row;
}

export const setEnabled = mutation({
  args: { id: v.id("channels"), enabled: v.boolean() },
  handler: async (ctx, a) => { await requireChannelAdmin(ctx, a.id); await ctx.db.patch(a.id, { enabled: a.enabled }); },
});

export const bindAgent = mutation({
  args: { id: v.id("channels"), agentId: v.union(v.id("agentDefs"), v.null()) },
  handler: async (ctx, a) => { await requireChannelAdmin(ctx, a.id); await ctx.db.patch(a.id, { agentId: a.agentId ?? undefined }); },
});

export const setModel = mutation({
  args: { id: v.id("channels"), model: v.string() },
  handler: async (ctx, a) => {
    const row = await requireChannelAdmin(ctx, a.id);
    await ctx.db.patch(a.id, { config: { ...(row.config ?? {}), model: a.model.trim() || undefined } });
  },
});

// rotate the webhook secret_token (keep the bot token). Returns the new secretToken (shown once).
export const rotateSecret = mutation({
  args: { id: v.id("channels") },
  handler: async (ctx, a) => {
    const row = await requireChannelAdmin(ctx, a.id);
    // re-encrypt with a fresh secretToken; keep the stored botToken (Web Crypto decrypt works here).
    const cur = JSON.parse(await decryptSecret(row.secretCiphertext)) as { botToken: string };
    const secretToken = rand(24);
    await ctx.db.patch(a.id, { secretCiphertext: await encryptSecret(JSON.stringify({ botToken: cur.botToken, secretToken })) });
    return { secretToken };
  },
});

export const deleteChannel = mutation({
  args: { id: v.id("channels") },
  handler: async (ctx, a) => { await requireChannelAdmin(ctx, a.id); await ctx.db.delete(a.id); },
});

// internal: resolve a channel (full row, incl. ciphertext) by its webhook slug — the ingress path.
export const _resolveChannelBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("channels").withIndex("by_slug", (q) => q.eq("slug", a.slug)).unique();
    return row ?? null;
  },
});

// internal: ciphertext + workspaceId for the setWebhook action (authz done in the action via workspaceId).
export const _secretFor = internalQuery({
  args: { channelId: v.id("channels") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.channelId);
    return row ? { secretCiphertext: row.secretCiphertext, workspaceId: row.workspaceId, kind: row.kind } : null;
  },
});
