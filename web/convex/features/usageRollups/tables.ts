// usage-rollups slice — table defs (spread into convex/schema.ts). Per-workspace daily aggregates
// of the raw `usage` rows, with an ESTIMATED cost from a static rate map (see ./rates). One row per
// (workspace, day, provider, model). estCostUsd is an estimate, never a bill.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const usageRollupTables = {
  workspaceUsageDaily: defineTable({
    workspaceId: v.id("workspaces"),
    day: v.string(), // YYYY-MM-DD (UTC)
    provider: v.string(),
    model: v.string(), // full "provider/model" ref
    calls: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    estCostUsd: v.number(), // estimate from RATES; 0 when no rate matched (see hasRate)
    hasRate: v.optional(v.boolean()), // false = no rate for this model, cost floored to 0
    updatedAt: v.number(),
  })
    .index("by_ws_day", ["workspaceId", "day"]) // upsert key + per-day read
    .index("by_ws", ["workspaceId"]), // dashboard: all days for a workspace
};
