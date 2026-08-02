// combos slice — table defs (spread into convex/schema.ts, the byok tablesExport pattern).
// A combo is a model-ref indirection: a client targets one stable name (`combo/<name>`) that maps
// to several concrete "provider/model" refs, chosen at call time by `strategy`. Rotation state lives
// ON the row (OCC-safe — Convex is stateless; 9router keeps it in-memory, we can't).
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const comboTables = {
  combos: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(), // slug — addressed as 'combo/<name>'
    refs: v.array(v.string()), // ordered 'provider/model' refs, max 5
    strategy: v.string(), // 'fallback' | 'round_robin'
    rotationIndex: v.optional(v.number()), // round_robin cursor (advanced by bumpRotation)
    stickyLimit: v.optional(v.number()), // reserved: calls to hold on a ref before advancing (default 1)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ws", ["workspaceId"])
    .index("by_ws_name", ["workspaceId", "name"]), // lookup by (workspace, name)
};
