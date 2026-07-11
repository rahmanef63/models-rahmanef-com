// RAG (retrieval-augmented generation): user documents chunked + embedded for vector search, then
// the top matches are injected into the chat system prompt. The BYOK "variable embedding dim" problem
// is solved by standardizing on ONE embedding model (OpenAI text-embedding-3-small → 1536 dims), so a
// single fixed-dimension Convex vectorIndex works for everyone.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const ragTables = {
  // one uploaded/pasted source document
  ragDocs: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    charCount: v.number(),
    chunkCount: v.number(),
    status: v.string(), // "ready" | "error"
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ws", ["workspaceId"]),
  // one embedded chunk of a document. Fixed 1536-dim vector; retrieval filters by userId (personal RAG).
  ragChunks: defineTable({
    docId: v.id("ragDocs"),
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    text: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_doc", ["docId"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536, filterFields: ["userId"] }),
};
