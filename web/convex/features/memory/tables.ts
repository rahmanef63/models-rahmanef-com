// memory slice — table defs (spread into convex/schema.ts). Curated, budgeted memory (hermes
// model): facts/preferences/summaries recalled into the system prompt across sessions. Curation
// ARCHIVES, never hard-deletes. embedding slot is reserved for a later semantic-recall phase.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const memoryTables = {
  memories: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    scope: v.string(), // 'user' | 'workspace' | 'agent' | 'note' (vault doc — never injected)
    agentId: v.optional(v.id("agentDefs")), // required when scope='agent'
    kind: v.string(), // 'fact' | 'preference' | 'summary' | 'note'
    text: v.string(), // fence-tags stripped at write; char-budgeted per scope
    title: v.optional(v.string()),  // vault node name — drives the tree label + [[Title]] link target
    format: v.optional(v.string()), // 'md' (default) | 'json' — how the vault editor renders `text`
    source: v.string(), // 'explicit-tool' | 'ui' | 'auto-summary'
    sourceThreadId: v.optional(v.id("threads")),
    summarizedMsgCount: v.optional(v.number()), // watermark: msg count at last auto-summary (summary rows)
    summarizedChars: v.optional(v.number()), // watermark: transcript chars at last auto-summary
    pinned: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
    lastRecalledAt: v.optional(v.number()),
    recallCount: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())), // reserved (semantic recall, later)
    embeddingModel: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_scope", ["userId", "scope", "archived"]) // hot-path injection read
    .index("by_user_thread", ["userId", "sourceThreadId"]) // summary upsert key
    .index("by_workspace_scope", ["workspaceId", "scope", "archived"])
    .searchIndex("search_text", { searchField: "text", filterFields: ["userId", "scope", "archived"] }),
};
