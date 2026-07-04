// Workspace tenancy — the deterministic CRUD half of the `workspaces` slice (tables in
// features/workspaces/tables.ts). A workspace is the tenant boundary; an individual = a personal
// workspace of one. api.workspaces.* / internal.workspaces.checkMembership (used by _shared/auth).
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser, requireWorkspaceRole, ROLE_RANK } from "./_shared/auth";

const bad = (detail: string) => new ConvexError({ code: "invalid_request", detail });
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

// used by requireWorkspaceRoleAction (actions have no ctx.db)
export const checkMembership = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", a.workspaceId).eq("userId", a.userId)).unique();
    return m ? { role: m.role } : null;
  },
});

// idempotent: the caller's personal workspace (auto-created once). OCC makes concurrent calls safe.
async function ensurePersonalWs(ctx: any, userId: any) {
  const owned = await ctx.db.query("workspaces").withIndex("by_owner", (q: any) => q.eq("ownerId", userId)).take(50);
  const existing = owned.find((w: any) => w.personal);
  if (existing) return existing._id;
  const user = await ctx.db.get(userId);
  const name = ((user as any)?.name || (user as any)?.email?.split("@")[0] || "Personal").slice(0, 40);
  const wsId = await ctx.db.insert("workspaces", { name, slug: `personal-${userId}`, personal: true, ownerId: userId, credPolicy: "personal-first", createdAt: Date.now() });
  await ctx.db.insert("memberships", { workspaceId: wsId, userId, role: "owner", createdAt: Date.now() });
  return wsId;
}

export const ensurePersonal = mutation({
  args: {},
  handler: async (ctx) => ensurePersonalWs(ctx, await requireUser(ctx)),
});

// action-safe twin: resolve the personal ws for an EXPLICIT userId (chat/runAgent when the client
// passes no workspaceId — an action can't run the authed ensurePersonal via runMutation).
export const _ensurePersonalFor = internalMutation({
  args: { userId: v.id("users") },
  handler: (ctx, a) => ensurePersonalWs(ctx, a.userId),
});

export const myWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mems = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).take(50);
    const out = [];
    for (const m of mems) {
      const ws = await ctx.db.get(m.workspaceId);
      if (ws) out.push({ id: ws._id, name: ws.name, slug: ws.slug, personal: ws.personal, role: m.role, credPolicy: ws.credPolicy ?? "personal-first" });
    }
    // personal first, then alpha — a stable switcher order
    return out.sort((a, b) => (b.personal ? 1 : 0) - (a.personal ? 1 : 0) || a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const name = a.name.trim().slice(0, 40);
    if (!name) throw bad("name required");
    const wsId = await ctx.db.insert("workspaces", { name, slug: `${slugify(name) || "team"}-${Math.random().toString(36).slice(2, 8)}`, personal: false, ownerId: userId, credPolicy: "workspace-first", createdAt: Date.now() });
    await ctx.db.insert("memberships", { workspaceId: wsId, userId, role: "owner", createdAt: Date.now() });
    return wsId;
  },
});

export const rename = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string() },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    const name = a.name.trim().slice(0, 40);
    if (!name) throw bad("name required");
    await ctx.db.patch(a.workspaceId, { name });
  },
});

// owner-only, non-personal. Deletes the workspace + its memberships/invites; owned data rows keep
// their (now-dangling) workspaceId but stop being reachable (queries scope by live membership).
export const remove = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "owner");
    const ws = await ctx.db.get(a.workspaceId);
    if (!ws) return;
    if (ws.personal) throw bad("cannot delete your personal workspace");
    for (const m of await ctx.db.query("memberships").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(500)) await ctx.db.delete(m._id);
    for (const inv of await ctx.db.query("invites").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(500)) await ctx.db.delete(inv._id);
    await ctx.db.delete(a.workspaceId);
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const mems = await ctx.db.query("memberships").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(200);
    const out = [];
    for (const m of mems) {
      const u = await ctx.db.get(m.userId);
      out.push({ userId: m.userId, role: m.role, name: (u as any)?.name ?? null, email: (u as any)?.email ?? null, since: m.createdAt });
    }
    return out.sort((a, b) => (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0));
  },
});

// admin+ changes roles; only owner may grant/revoke admin; the owner role itself is immutable here.
export const updateRole = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users"), role: v.string() },
  handler: async (ctx, a) => {
    const me = await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    if (!["admin", "member", "viewer"].includes(a.role)) throw bad("role must be admin|member|viewer");
    const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", a.workspaceId).eq("userId", a.userId)).unique();
    if (!m) throw bad("not a member");
    if (m.role === "owner") throw bad("the owner role is fixed (transfer ownership instead)");
    if (a.role === "admin" && me.role !== "owner") throw bad("only the owner can grant admin");
    await ctx.db.patch(m._id, { role: a.role });
  },
});

export const removeMember = mutation({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, a) => {
    const me = await requireWorkspaceRole(ctx, a.workspaceId, "admin");
    const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", a.workspaceId).eq("userId", a.userId)).unique();
    if (!m) return;
    if (m.role === "owner") throw bad("cannot remove the owner");
    if (m.role === "admin" && me.role !== "owner") throw bad("only the owner can remove an admin");
    await ctx.db.delete(m._id);
  },
});

export const leaveWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    const { userId, role } = await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const ws = await ctx.db.get(a.workspaceId);
    if (ws?.personal) throw bad("cannot leave your personal workspace");
    if (role === "owner") throw bad("transfer ownership before leaving");
    const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", a.workspaceId).eq("userId", userId)).unique();
    if (m) await ctx.db.delete(m._id);
  },
});
