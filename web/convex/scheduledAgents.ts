// scheduled-agents — run a saved agent on a recurring interval. CRUD is workspace-scoped ('member'
// to write/read). _claimDue + _markRun are the deterministic DB halves of the cron loop; the model
// call itself lives in scheduledAgentsRun.ts ("use node", so it can import callForUser). A schedule
// runs AS its creator, spending that workspace's creds — so create/toggle/remove require the caller
// to BE the creator (or a workspace admin). Spend is bounded by the enabled-gate + 15-min floor.
import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireWorkspaceRole } from "./_shared/auth";

const MIN_INTERVAL = 15; // minutes — the spend floor
const clampInterval = (n: number) => Math.max(MIN_INTERVAL, Number.isFinite(n) ? Math.round(n) : MIN_INTERVAL);

const view = (s: any) => ({
  id: s._id, agentId: s.agentId, prompt: s.prompt, everyMinutes: s.everyMinutes,
  enabled: s.enabled !== false, lastRunAt: s.lastRunAt, lastStatus: s.lastStatus,
  lastResult: s.lastResult, createdAt: s.createdAt,
});

// ── CRUD ──
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, a) => {
    await requireWorkspaceRole(ctx, a.workspaceId, "viewer");
    const rows = await ctx.db.query("agentSchedules").withIndex("by_ws", (q) => q.eq("workspaceId", a.workspaceId)).take(100);
    return rows.sort((x, y) => y.createdAt - x.createdAt).map(view);
  },
});

export const create = mutation({
  args: { workspaceId: v.id("workspaces"), agentId: v.id("agentDefs"), prompt: v.string(), everyMinutes: v.number() },
  handler: async (ctx, a) => {
    const { userId } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const prompt = a.prompt.trim().slice(0, 4000);
    if (!prompt) throw new ConvexError({ code: "invalid_request", detail: "prompt required" });
    // agent must belong to the caller (same ownership guard as internal.agentDefs.getOwned, inlined
    // for the mutation ctx) — you can only schedule an agent you own; it runs under YOUR creds.
    const agent = await ctx.db.get(a.agentId);
    if (!agent || agent.userId !== userId) throw new ConvexError({ code: "not_found", detail: "agent not found" });
    const now = Date.now();
    return await ctx.db.insert("agentSchedules", {
      userId, workspaceId: a.workspaceId, agentId: a.agentId, prompt,
      everyMinutes: clampInterval(a.everyMinutes), enabled: true, createdAt: now, updatedAt: now,
    });
  },
});

// creator-or-admin guard: a plain member can't flip/delete a peer's schedule (it spends the peer's creds).
async function ownedSchedule(ctx: any, workspaceId: any, scheduleId: any, userId: any, role: string) {
  const row = await ctx.db.get(scheduleId);
  if (!row || row.workspaceId !== workspaceId) throw new ConvexError({ code: "not_found", detail: "schedule not found" });
  const isAdmin = role === "admin" || role === "owner";
  if (row.userId !== userId && !isAdmin) throw new ConvexError({ code: "forbidden", detail: "Only the creator or a workspace admin can change this schedule." });
  return row;
}

export const toggle = mutation({
  args: { workspaceId: v.id("workspaces"), scheduleId: v.id("agentSchedules"), enabled: v.boolean() },
  handler: async (ctx, a) => {
    const { userId, role } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    await ownedSchedule(ctx, a.workspaceId, a.scheduleId, userId, role);
    await ctx.db.patch(a.scheduleId, { enabled: a.enabled, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: { workspaceId: v.id("workspaces"), scheduleId: v.id("agentSchedules"), agentId: v.id("agentDefs"), prompt: v.string(), everyMinutes: v.number() },
  handler: async (ctx, a) => {
    const { userId, role } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const row = await ownedSchedule(ctx, a.workspaceId, a.scheduleId, userId, role);
    const prompt = a.prompt.trim().slice(0, 4000);
    if (!prompt) throw new ConvexError({ code: "invalid_request", detail: "prompt required" });
    // the schedule runs as its OWNER, so the (possibly new) agent must belong to that owner, not the
    // admin doing the edit — keeps the "runs your own agent under your creds" invariant.
    const agent = await ctx.db.get(a.agentId);
    if (!agent || agent.userId !== row.userId) throw new ConvexError({ code: "not_found", detail: "agent not found" });
    await ctx.db.patch(a.scheduleId, { agentId: a.agentId, prompt, everyMinutes: clampInterval(a.everyMinutes), updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), scheduleId: v.id("agentSchedules") },
  handler: async (ctx, a) => {
    const { userId, role } = await requireWorkspaceRole(ctx, a.workspaceId, "member");
    const row = await ctx.db.get(a.scheduleId);
    if (!row || row.workspaceId !== a.workspaceId) return; // idempotent delete
    const isAdmin = role === "admin" || role === "owner";
    if (row.userId !== userId && !isAdmin) throw new ConvexError({ code: "forbidden", detail: "Only the creator or a workspace admin can remove this schedule." });
    await ctx.db.delete(a.scheduleId);
  },
});

// ── cron halves (called by scheduledAgentsRun.runDue) ──
// Claim due enabled schedules: bounded scan (take 50) of enabled rows via by_enabled, JS-filtered on
// the per-row interval (everyMinutes varies, so no single range index fits). CLAIMS by stamping
// lastRunAt=now up front so a slow/failed run isn't re-picked by the next 5-min tick. OCC-safe patches.
export const _claimDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("agentSchedules").withIndex("by_enabled", (q) => q.eq("enabled", true)).take(50);
    const due = rows.filter((r) => (r.lastRunAt ?? 0) + r.everyMinutes * 60_000 <= now);
    for (const r of due) await ctx.db.patch(r._id, { lastRunAt: now });
    return due.map((r) => ({ id: r._id, userId: r.userId, workspaceId: r.workspaceId, agentId: r.agentId, prompt: r.prompt }));
  },
});

// record the outcome of a run (lastRunAt already stamped at claim time).
export const _markRun = internalMutation({
  args: { scheduleId: v.id("agentSchedules"), status: v.string(), result: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.scheduleId);
    if (!row) return;
    await ctx.db.patch(a.scheduleId, { lastStatus: a.status, lastResult: a.result.slice(0, 4000), updatedAt: Date.now() });
  },
});
