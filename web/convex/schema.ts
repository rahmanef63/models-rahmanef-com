import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// authTables = users, authAccounts, authSessions, ... (from @convex-dev/auth).
// modelCreds = one row per (user, provider); ciphertext = AES-256-GCM(base64 iv||ct).
export default defineSchema({
  ...authTables,
  // kind: "api_key" (ciphertext = the key) | "oauth" (ciphertext = JSON {access,refresh,expires,accountId})
  modelCreds: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    kind: v.optional(v.string()),
    ciphertext: v.string(),
    updatedAt: v.number(),
    expires: v.optional(v.number()), // plaintext token expiry (oauth) — lets the lease check staleness without decrypting
    refreshLeaseUntil: v.optional(v.number()), // single-flight refresh lease
    // last connectivity test result (a real 1-token call through the SAME path chat uses) —
    // lets the Providers list show a health badge instead of only failing deep in a chat.
    lastCheckedAt: v.optional(v.number()),
    lastCheckedOk: v.optional(v.boolean()),
    lastCheckedCode: v.optional(v.string()),
    lastCheckedDetail: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"]),
  // per-call usage log — powers the stats dashboard (like 9router's usageHistory)
  usage: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    model: v.string(), // full "provider/model" ref
    promptTokens: v.number(),
    completionTokens: v.number(),
    status: v.string(), // "ok" | "error"
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_at", ["at"]),
  // per-user token-saver settings (Caveman/Ponytail system-prompt injection)
  settings: defineTable({
    userId: v.id("users"),
    cavemanEnabled: v.optional(v.boolean()),
    cavemanLevel: v.optional(v.string()),
    ponytailEnabled: v.optional(v.boolean()),
    ponytailLevel: v.optional(v.string()),
    agentMode: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
  // AI Agents: one row per task run. steps = a compact trace (assistant text + tool names per step).
  agentRuns: defineTable({
    userId: v.id("users"),
    task: v.string(),
    model: v.string(),
    status: v.string(), // "running" | "done" | "error"
    steps: v.optional(v.array(v.object({ text: v.string(), tools: v.array(v.string()) }))),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()), // structured classifyError() code — lets the client show a FRIENDLY message to non-admins
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    at: v.number(),
  }).index("by_user_at", ["userId", "at"]),
  // AI Chat workbench: persisted threaded conversations. messages owned via their thread.
  threads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    model: v.string(),
    at: v.number(),
  }).index("by_user_at", ["userId", "at"]),
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    at: v.number(),
  }).index("by_thread", ["threadId", "at"]),
  // MCP access tokens — one per issued bearer. We store only sha256(token); raw shown once.
  mcpTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    label: v.string(),
    createdAt: v.number(),
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
  // short-lived OAuth handshake state (PKCE verifier / device-code ids), keyed per user+provider
  oauthFlows: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    verifier: v.optional(v.string()),
    deviceAuthId: v.optional(v.string()),
    userCode: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_provider", ["userId", "provider"]),
});
