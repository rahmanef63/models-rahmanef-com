// Single source of truth for "is there an authed user" / "is this user a super-admin" — every
// mutation/query/action in this app should derive its identity through here, never inline
// getAuthUserId + a throw. Queries that intentionally degrade gracefully for a logged-out caller
// (e.g. "list my threads" -> [] instead of an error) should keep calling getAuthUserId directly —
// requireUser()/requireAdmin() are specifically for the "this call needs a signed-in user or it's
// an error" case.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx | ActionCtx;

export async function requireUser(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Please sign in.");
  return userId;
}

// Env allowlists on the Convex deployment (comma-separated):
//   SUPER_ADMIN_USER_IDS — Convex users._id values. NON-FORGEABLE (server-assigned). Preferred.
//   SUPER_ADMIN_EMAILS   — emails. Convenient, but the Password provider does NOT verify email
//                          ownership, so an email only becomes trustworthy once its account is
//                          CLAIMED (emails are unique — first Password signup locks it).
// Change admins by editing the env var — no code change, no redeploy of code.
const list = (v: string | undefined) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

// Usable in queries/mutations (needs ctx.db). Actions must call this via runQuery(api.admin.me).
export async function isSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (list(process.env.SUPER_ADMIN_USER_IDS).includes(userId)) return true; // non-forgeable
  const user = await ctx.db.get(userId);
  const email = (user?.email || "").toLowerCase();
  return !!email && list(process.env.SUPER_ADMIN_EMAILS).map((e) => e.toLowerCase()).includes(email);
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  if (!(await isSuperAdmin(ctx))) throw new ConvexError({ code: "forbidden", detail: "Admin only." });
  return userId;
}

// ── workspace RBAC (the tenant boundary) ─────────────────────────────────────
// owner > admin > member > viewer. isSuperAdmin/requireAdmin stay the cross-tenant host tier ABOVE.
export const ROLE_RANK: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
const forbidden = () => new ConvexError({ code: "forbidden", detail: "Not a member of this workspace (or insufficient role)." });

// Assert the authed user is a member of `workspaceId` with at least `minRole`. Query/mutation ctx.
export async function requireWorkspaceRole(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">, minRole: string) {
  const userId = await requireUser(ctx);
  const m = await ctx.db.query("memberships").withIndex("by_ws_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId)).unique();
  if (!m || (ROLE_RANK[m.role] ?? -1) < (ROLE_RANK[minRole] ?? 99)) throw forbidden();
  return { userId, workspaceId, role: m.role };
}

// Action variant — no ctx.db; delegates to the internal checkMembership query (credentials.ts trick).
export async function requireWorkspaceRoleAction(ctx: ActionCtx, workspaceId: Id<"workspaces">, minRole: string) {
  const userId = await requireUser(ctx);
  const m = await ctx.runQuery(internal.workspaces.checkMembership, { userId, workspaceId });
  if (!m || (ROLE_RANK[m.role] ?? -1) < (ROLE_RANK[minRole] ?? 99)) throw forbidden();
  return { userId, workspaceId, role: m.role };
}
