// Super-admin gate. Two env allowlists on the Convex deployment (comma-separated):
//   SUPER_ADMIN_USER_IDS  — Convex users._id values. NON-FORGEABLE (server-assigned). Preferred.
//   SUPER_ADMIN_EMAILS    — emails. Convenient, but the Password provider does NOT verify email
//                           ownership, so an email only becomes trustworthy once its account is
//                           CLAIMED (emails are unique — first Password signup locks it). Do not
//                           rely on the email gate for an unclaimed address on an open-signup app.
// Change admins by editing the env var — no code change, no redeploy of code.
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// The current user's identity + admin flag, for the UI (and for pinning their id as admin).
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    return { id: userId, email: user?.email ?? null, isSuperAdmin: await isSuperAdmin(ctx) };
  },
});

// Aggregate stats — SUPER-ADMIN ONLY, and only aggregates (no keys, no per-user emails).
export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) throw new Error("forbidden");
    const users = await ctx.db.query("users").collect();
    const creds = await ctx.db.query("modelCreds").collect();
    const byProvider: Record<string, number> = {};
    let oauth = 0;
    for (const c of creds) {
      byProvider[c.provider] = (byProvider[c.provider] ?? 0) + 1;
      if (c.kind === "oauth") oauth++;
    }
    return { users: users.length, connections: creds.length, oauth, byProvider };
  },
});
