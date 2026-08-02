// channels access policy — the pairing/allowlist gate that decides whether an inbound sender may
// spend the channel owner's provider tokens. Every adapter routes through `_checkAccess` AFTER the
// message is persisted (so denied senders still show up in the owner's sender list to click-add) but
// BEFORE callForUser — a denied sender never reaches the model. Admin CRUD (policy + allow flags)
// lives here too. Default runtime (DB only, no fetch/model) — the "use node" adapters call in via
// ctx.runMutation. Defense-in-depth: the per-sender rate-limit still runs upstream in each adapter.
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";
import { requireChannelAdmin } from "./channelsCore";

const defaultPolicy = (p: string | undefined) => (p === "open" ? "open" : "allowlist"); // unset → safe

// the gate. 'open' → anyone. 'allowlist' → only identities flagged allowed, or the paired channel
// owner (identity.userId === channel.userId). Returns firstDeny once per sender (adapter sends a
// single "ask the owner" hint, then goes silent) — the flag is stamped on the identity here.
export const _checkAccess = internalMutation({
  args: { channelId: v.id("channels"), externalUserId: v.string() },
  handler: async (ctx, a): Promise<{ allowed: boolean; firstDeny: boolean }> => {
    const ch = await ctx.db.get(a.channelId);
    if (!ch) return { allowed: false, firstDeny: false };
    if (defaultPolicy(ch.accessPolicy) === "open") return { allowed: true, firstDeny: false };
    const identity = await ctx.db
      .query("channelIdentities")
      .withIndex("by_channel_external", (q) => q.eq("channelId", a.channelId).eq("externalUserId", a.externalUserId))
      .unique();
    if (identity?.allowed === true || (identity?.userId && identity.userId === ch.userId)) return { allowed: true, firstDeny: false };
    // denied: notify exactly once so we never spam an unauthorized stranger.
    const firstDeny = !!identity && !identity.denyNotifiedAt;
    if (firstDeny && identity) await ctx.db.patch(identity._id, { denyNotifiedAt: Date.now() });
    return { allowed: false, firstDeny };
  },
});

// admin: flip a channel between 'open' and 'allowlist'.
export const setAccessPolicy = mutation({
  args: { id: v.id("channels"), policy: v.union(v.literal("open"), v.literal("allowlist")) },
  handler: async (ctx, a) => {
    await requireChannelAdmin(ctx, a.id);
    await ctx.db.patch(a.id, { accessPolicy: a.policy });
  },
});

// admin: allow/deny a specific sender (identity). Clears the deny-notified flag on re-allow so a
// later removal can hint again. The identity must belong to the channel (checked via the row).
export const setSenderAllowed = mutation({
  args: { channelId: v.id("channels"), identityId: v.id("channelIdentities"), allowed: v.boolean() },
  handler: async (ctx, a) => {
    await requireChannelAdmin(ctx, a.channelId);
    const row = await ctx.db.get(a.identityId);
    if (!row || row.channelId !== a.channelId) return;
    await ctx.db.patch(a.identityId, { allowed: a.allowed, denyNotifiedAt: a.allowed ? undefined : row.denyNotifiedAt });
  },
});

// admin: recent senders on a channel (bounded .take) so the UI can click-add them to the allowlist.
export const listSenders = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, a) => {
    const ch = await ctx.db.get(a.channelId);
    if (!ch) return { policy: "allowlist" as const, senders: [] };
    await requireWorkspaceRole(ctx, ch.workspaceId, "viewer");
    const rows = await ctx.db
      .query("channelIdentities")
      .withIndex("by_channel_external", (q) => q.eq("channelId", a.channelId))
      .take(50);
    return {
      policy: defaultPolicy(ch.accessPolicy),
      senders: rows.map((r) => ({
        id: r._id, externalUserId: r.externalUserId, displayName: r.displayName ?? null,
        allowed: r.allowed === true, createdAt: r.createdAt,
      })),
    };
  },
});
