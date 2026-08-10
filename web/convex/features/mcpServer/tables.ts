// mcp-server slice — table defs (spread into convex/schema.ts). INBOUND MCP: we are the SERVER.
// Only sha256 digests are stored — the raw bearer is shown to the user exactly once at mint, and
// the raw auth code exists only in flight between the consent page and /oauth/token.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mcpServerTables = {
  // MCP access tokens — one per issued bearer. We store only sha256(token); raw shown once.
  mcpTokens: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")), // bearer acts in this workspace; unset legacy = issuer's personal ws
    tokenHash: v.string(),
    label: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // optional so pre-existing tokens stay valid — absent = no expiry
    lastUsedAt: v.optional(v.number()),
    revoked: v.optional(v.boolean()),
    clientId: v.optional(v.string()), // set when issued via the OAuth flow
    scope: v.optional(v.string()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user", ["userId"]),
  // OAuth 2.1 dynamically-registered clients (public clients — PKCE, no secret).
  mcpClients: defineTable({
    clientId: v.string(),
    name: v.string(),
    redirectUris: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_clientId", ["clientId"]),
  // Short-lived, single-use authorization codes (store only sha256(code)).
  mcpAuthCodes: defineTable({
    codeHash: v.string(),
    userId: v.id("users"),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(), // S256
    scope: v.string(),
    expiresAt: v.number(),
    used: v.optional(v.boolean()),
  }).index("by_codeHash", ["codeHash"]),
};
