// scheduled-agents slice — table defs (spread into convex/schema.ts, the byok tablesExport pattern).
// A schedule runs one saved agent on a recurring interval, AS its creator, spending that workspace's
// creds. Spend is bounded by the enabled-gate + the 15-min interval floor (see scheduledAgents.ts).
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const scheduledAgentTables = {
  agentSchedules: defineTable({
    userId: v.id("users"), // creator + cred-resolution identity — the schedule runs AS this user
    workspaceId: v.id("workspaces"), // tenant boundary; creds resolved in this workspace
    agentId: v.id("agentDefs"), // the saved agent to run (must belong to userId)
    prompt: v.string(), // the user turn fed to the agent each tick
    everyMinutes: v.number(), // interval; clamped >= 15 at write time (spend floor)
    enabled: v.optional(v.boolean()), // gate — only enabled schedules are swept
    lastRunAt: v.optional(v.number()), // set at claim time (prevents double-claim) + on finish
    lastStatus: v.optional(v.string()), // 'ok' | 'error'
    lastResult: v.optional(v.string()), // last output text (or error detail), truncated
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ws", ["workspaceId"]) // list a workspace's schedules
    .index("by_user", ["userId"]) // a user's schedules across workspaces
    .index("by_enabled", ["enabled"]), // the cron sweep — bounded scan of enabled rows
};
