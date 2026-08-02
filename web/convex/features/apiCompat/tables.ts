// api-compat slice — table defs (spread into convex/schema.ts). Workspace-bound API keys let any
// OpenAI/Anthropic-compatible tool (Claude Code, Cursor, Codex) point at /v1 and act inside ONE
// workspace. Only sha256(key) is stored; the raw `sk-rr-…` is shown once (mcpTokens pattern).
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const apiCompatTables = {
  apiKeys: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"), // the key acts inside this workspace
    keyHash: v.string(), // sha256(raw)
    prefix: v.string(), // first ~12 chars for the UI (sk-rr-xxxx…)
    label: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revoked: v.optional(v.boolean()),
  }).index("by_hash", ["keyHash"]).index("by_user", ["userId"]).index("by_ws", ["workspaceId"]),
};
