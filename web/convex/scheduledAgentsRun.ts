"use node";
// runDue — the cron target (kept in a "use node" module so it can import callForUser directly). It
// claims the due enabled schedules (bounded 50), then runs each through the SAME cred pipeline as a
// normal agent run — callForUser with an `agent/<id>` model ref, which resolves the agent's fixed
// model before the provider split — and records the last-run status/result. Runs AS the schedule's
// creator, spending that workspace's creds. Spend is bounded by the enabled-gate + the 15-min interval
// floor + the 50-row claim cap, so a runaway loop can't drain a workspace.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callForUser } from "./callForUser";

export const runDue = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const due = await ctx.runMutation(internal.scheduledAgents._claimDue, {});
    for (const s of due) {
      let status = "ok";
      let result = "";
      try {
        const r = await callForUser(ctx, s.userId, s.workspaceId, `agent/${s.agentId}`, [{ role: "user", content: s.prompt }]);
        result = r.text || "(no output)";
      } catch (e: any) {
        status = "error";
        const detail = e?.data && typeof e.data === "object" ? (e.data.detail ?? e.data.code) : String(e?.message ?? e);
        result = String(detail).slice(0, 500);
      }
      await ctx.runMutation(internal.scheduledAgents._markRun, { scheduleId: s.id, status, result });
    }
  },
});
