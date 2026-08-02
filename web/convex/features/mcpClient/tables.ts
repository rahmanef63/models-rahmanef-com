// mcp-client slice — table defs (spread into convex/schema.ts). OUTBOUND MCP: we are the CLIENT.
// Lets agents consume tools from external MCP servers (HTTP/SSE). Custom auth headers are stored
// AES-256-GCM (convex/crypto.ts) — never in list responses. toolCache is a probe snapshot so we
// don't reconnect to enumerate tools on every chat turn; execute() reconnects per call.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mcpClientTables = {
  mcpServers: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(), // slug → tool namespace mcp__<name>__*
    url: v.string(),
    transport: v.string(), // 'http' | 'sse'
    headersCiphertext: v.optional(v.string()), // AES-256-GCM JSON of custom headers (encryptSecret)
    enabled: v.optional(v.boolean()),
    toolCache: v.optional(
      v.array(v.object({ name: v.string(), description: v.string(), inputSchema: v.any() })),
    ),
    lastProbeAt: v.optional(v.number()),
    lastProbeOk: v.optional(v.boolean()),
    lastProbeError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ws", ["workspaceId"]),
};
