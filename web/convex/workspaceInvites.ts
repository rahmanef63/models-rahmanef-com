// Workspace invites — bearer-link onboarding (no email verification in v1). createInvite stores
// only sha256(token) and returns the raw link ONCE (mcpTokens pattern). acceptInvite adds the
// caller as a member. Web Crypto works in the Convex default runtime — no "use node" needed.
import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireUser, requireWorkspaceRole } from "./_shared/auth";

const bad = (detail: string) => new ConvexError({ code: "invalid_request", detail });
const ROLES = ["admin", "member", "viewer"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const createInvite = mutation({
  args: { workspaceId: v.id("workspaces"), email: v.string(), role: v.string() },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    if (!ROLES.includes(a.role)) throw bad("role must be admin | member | viewer");
    const raw = "inv_" + b64url(crypto.getRandomValues(new Uint8Array(32)));
    await ctx.db.insert("invites", {
      workspaceId: a.workspaceId, email: a.email.trim().toLowerCase().slice(0, 120), role: a.role,
      tokenHash: await sha256hex(raw), invitedBy: userId, expiresAt: Date.now() + INVITE_TTL_MS, createdAt: Date.now(),
    });
    return raw; // the raw token — shown/copied once, never stored
  },
});

export const listInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    const rows = await ctx.db.query("invites").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(100);
    return rows
      .filter((r) => !r.revoked && !r.acceptedBy && r.expiresAt > Date.now())
      .map((r) => ({ id: r._id, email: r.email, role: r.role, createdAt: r.createdAt, expiresAt: r.expiresAt }));
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, a) => {
    const inv = await ctx.db.get(a.inviteId);
    if (!inv) return;
    await requireWorkspaceRole(ctx, inv.workspaceId, "admin");
    await ctx.db.patch(a.inviteId, { revoked: true });
  },
});

// preview (unauthed-safe) — the accept page shows "Join <workspace> as <role>" before sign-in.
export const inviteInfo = query({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    const hash = await sha256hex(a.token);
    const inv = await ctx.db.query("invites").withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash)).unique();
    if (!inv || inv.revoked || inv.acceptedBy || inv.expiresAt < Date.now()) return null;
    const ws = await ctx.db.get(inv.workspaceId);
    return ws ? { workspaceName: ws.name, role: inv.role } : null;
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const hash = await sha256hex(a.token);
    const inv = await ctx.db.query("invites").withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash)).unique();
    if (!inv || inv.revoked || inv.acceptedBy || inv.expiresAt < Date.now()) throw bad("This invite is invalid, expired, or already used.");
    const existing = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", inv.workspaceId).eq("userId", userId)).unique();
    if (!existing) {
      await ctx.db.insert("memberships", { workspaceId: inv.workspaceId, userId, role: inv.role, invitedBy: inv.invitedBy, createdAt: Date.now() });
      await ctx.db.insert("auditEvents", { workspaceId: inv.workspaceId, actorUserId: userId, action: "invite.accepted", target: userId, meta: { role: inv.role }, at: Date.now() });
    }
    await ctx.db.patch(inv._id, { acceptedBy: userId });
    return inv.workspaceId;
  },
});
