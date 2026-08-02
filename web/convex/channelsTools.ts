// Channel gateway-tool backends (channel_list / channel_create / channel_config). Split from
// channelsCore for the 200-line cap. Explicit userId+workspaceId (pre-authorized by the caller);
// channels are ADMIN-scoped, so WRITES re-check admin/owner role — mcpNode only membership-checks a
// token, not its role. Reuses channelSecret/KINDS/rand from channelsCore; never returns ciphertext.
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { encryptSecret } from "./crypto";
import { KINDS, rand, channelSecret } from "./channelsCore";

const isChannelAdmin = async (ctx: any, userId: any, workspaceId: any) => {
  const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q: any) => q.eq("workspaceId", workspaceId).eq("userId", userId)).unique();
  return !!m && (m.role === "admin" || m.role === "owner");
};
const agentIdByName = async (ctx: any, userId: any, name: string) => {
  const nm = name.trim().toLowerCase();
  return (await ctx.db.query("agentDefs").withIndex("by_user", (q: any) => q.eq("userId", userId)).take(200)).find((d: any) => d.name.toLowerCase() === nm) ?? null;
};

export const _channelsForUser = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  handler: async (ctx, a) =>
    (await ctx.db.query("channels").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(50))
      .map((r) => ({ name: r.name, kind: r.kind, slug: r.slug, model: (r.config as any)?.model ?? null, hasAgent: !!r.agentId, enabled: r.enabled !== false, lastError: r.lastError ?? null })),
});

export const _channelCreateForUser = internalMutation({
  args: {
    userId: v.id("users"), workspaceId: v.id("workspaces"), kind: v.string(), name: v.string(),
    secrets: v.object({ botToken: v.optional(v.string()), signingSecret: v.optional(v.string()), appSecret: v.optional(v.string()), verifyToken: v.optional(v.string()), phoneNumberId: v.optional(v.string()), accessToken: v.optional(v.string()), publicKey: v.optional(v.string()), applicationId: v.optional(v.string()) }),
    agentName: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<string> => {
    if (!(await isChannelAdmin(ctx, a.userId, a.workspaceId))) return "You need admin access to set up channels in this workspace.";
    if (!KINDS.includes(a.kind)) return `Unsupported channel kind "${a.kind}" — one of: ${KINDS.join(", ")}.`;
    let agentId: any = undefined;
    if (a.agentName?.trim()) {
      const agent = await agentIdByName(ctx, a.userId, a.agentName);
      if (!agent) return `No agent named "${a.agentName}" to bind — create it first with agent_write.`;
      agentId = agent._id;
    }
    let secret: Record<string, string>, secretToken: string | undefined;
    try { ({ secret, secretToken } = channelSecret(a.kind, a.secrets)); }
    catch (e: any) { return e?.data?.detail ?? "Invalid channel secrets."; }
    const slug = rand(18);
    await ctx.db.insert("channels", { workspaceId: a.workspaceId, userId: a.userId, kind: a.kind, name: a.name.trim().slice(0, 60) || a.kind, slug, secretCiphertext: await encryptSecret(JSON.stringify(secret)), agentId, enabled: true, createdAt: Date.now() });
    return `Created ${a.kind} channel "${a.name}". Webhook path: /channels/${a.kind}/${slug}${secretToken ? ` · secret_token (shown once): ${secretToken}` : ""}. Point the platform's webhook at your site + this path.`;
  },
});

export const _channelConfigForUser = internalMutation({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces"), name: v.string(), model: v.optional(v.string()), agentName: v.optional(v.string()), enabled: v.optional(v.boolean()) },
  handler: async (ctx, a): Promise<string> => {
    if (!(await isChannelAdmin(ctx, a.userId, a.workspaceId))) return "You need admin access to configure channels.";
    const nm = a.name.trim().toLowerCase();
    const ch = (await ctx.db.query("channels").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(50)).find((c) => c.name.toLowerCase() === nm || c.slug === a.name.trim());
    if (!ch) return `No channel named "${a.name}".`;
    const patch: Record<string, unknown> = {};
    if (a.enabled !== undefined) patch.enabled = a.enabled;
    if (a.model !== undefined) patch.config = { ...(ch.config ?? {}), model: a.model.trim() || undefined };
    if (a.agentName !== undefined) {
      if (!a.agentName.trim()) patch.agentId = undefined;
      else { const agent = await agentIdByName(ctx, a.userId, a.agentName); if (!agent) return `No agent named "${a.agentName}".`; patch.agentId = agent._id; }
    }
    if (!Object.keys(patch).length) return "Nothing to change — pass model, agentName, or enabled.";
    await ctx.db.patch(ch._id, patch);
    return `Updated channel "${ch.name}".`;
  },
});
