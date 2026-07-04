// channels-core — CRUD for inbound messaging channels + the slug resolver. Secrets are a per-kind
// JSON bag (telegram {botToken,secretToken} · slack {signingSecret,botToken} · whatsapp {appSecret,
// verifyToken,phoneNumberId,accessToken} · discord {publicKey,botToken?,applicationId?}) AES-256-GCM
// encrypted (crypto.ts) into secretCiphertext; telegram's minted secret_token is shown ONCE. Admin-
// only writes (requireWorkspaceRole 'admin'). Web Crypto works in the default runtime — no "use node".
// The ingest→callForUser→reply loop lives in channelsIngest.ts + channel<Kind>.ts (via channelsDispatch).
import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import { encryptSecret, decryptSecret } from "./crypto";

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const KINDS = ["telegram", "slack", "whatsapp", "discord"]; // registry-driven adapters
const bad = (detail: string) => new ConvexError({ code: "invalid_request", detail });

// Per-kind secret builder. Returns the plaintext object to encrypt into secretCiphertext + (telegram
// only) the freshly-minted webhook secretToken to surface once. Discord botToken/applicationId are
// optional (only needed to register the /command); everything else is required for verify + reply.
function channelSecret(kind: string, s: any): { secret: Record<string, string>; secretToken?: string } {
  const need = (k: string) => {
    const val = String(s?.[k] ?? "").trim();
    if (!val) throw bad(`"${k}" is required for a ${kind} channel.`);
    return val;
  };
  const opt = (k: string) => String(s?.[k] ?? "").trim();
  if (kind === "telegram") {
    const secretToken = rand(24); // header value WE choose; set via setWebhook, compared on ingest
    return { secret: { botToken: need("botToken"), secretToken }, secretToken };
  }
  if (kind === "slack") return { secret: { signingSecret: need("signingSecret"), botToken: need("botToken") } };
  if (kind === "whatsapp") return { secret: { appSecret: need("appSecret"), verifyToken: need("verifyToken"), phoneNumberId: need("phoneNumberId"), accessToken: need("accessToken") } };
  if (kind === "discord") return { secret: { publicKey: need("publicKey"), botToken: opt("botToken"), applicationId: opt("applicationId") } };
  throw bad(`Unsupported channel kind "${kind}".`);
}

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

// create a channel: store the per-kind secret JSON (encrypted) + a random slug. Returns the slug
// (→ webhook URL) and, for telegram, the raw secretToken (shown once — set it via setWebhook).
export const createChannel = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    kind: v.string(),
    name: v.string(),
    // per-kind secret bag — only the fields the chosen kind needs are read (validated in channelSecret):
    //   telegram {botToken} · slack {signingSecret,botToken} · whatsapp {appSecret,verifyToken,
    //   phoneNumberId,accessToken} · discord {publicKey, botToken?, applicationId?}
    secrets: v.object({
      botToken: v.optional(v.string()),
      signingSecret: v.optional(v.string()),
      appSecret: v.optional(v.string()),
      verifyToken: v.optional(v.string()),
      phoneNumberId: v.optional(v.string()),
      accessToken: v.optional(v.string()),
      publicKey: v.optional(v.string()),
      applicationId: v.optional(v.string()),
    }),
    agentId: v.optional(v.id("agentDefs")),
  },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    if (!KINDS.includes(a.kind)) throw bad(`Unsupported channel kind "${a.kind}".`);
    const { secret, secretToken } = channelSecret(a.kind, a.secrets);
    const slug = rand(18);
    const id = await ctx.db.insert("channels", {
      workspaceId: a.workspaceId, userId, kind: a.kind, name: a.name.trim().slice(0, 60) || a.kind,
      slug, secretCiphertext: await encryptSecret(JSON.stringify(secret)),
      agentId: a.agentId, enabled: true, createdAt: Date.now(),
    });
    return { id, slug, secretToken }; // secretToken (telegram only) shown once — never stored in plaintext
  },
});

export async function requireChannelAdmin(ctx: any, id: any) {
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

// rotate the Telegram webhook secret_token (keep the bot token). Returns the new secretToken (shown
// once). Only telegram mints a webhook secret — the other kinds' secrets are platform-issued, so
// rotate them by editing the channel on the platform + recreating (or a future kind-aware editor).
export const rotateSecret = mutation({
  args: { id: v.id("channels") },
  handler: async (ctx, a) => {
    const row = await requireChannelAdmin(ctx, a.id);
    if (row.kind !== "telegram") throw bad("Only Telegram channels have a rotatable webhook secret.");
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
