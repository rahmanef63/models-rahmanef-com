import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { workspaceTables } from "./features/workspaces/tables";
import { apiCompatTables } from "./features/apiCompat/tables";
import { memoryTables } from "./features/memory/tables";
import { comboTables } from "./features/combos/tables";
import { mcpClientTables } from "./features/mcpClient/tables";
import { channelTables } from "./features/channels/tables";
import { scheduledAgentTables } from "./features/scheduledAgents/tables";
import { usageRollupTables } from "./features/usageRollups/tables";
import { auditLogTables } from "./features/auditLog/tables";

// authTables = users, authAccounts, authSessions, ... (from @convex-dev/auth).
// workspaceTables = workspaces/memberships/invites (the tenant boundary — see features/workspaces).
// modelCreds = one row per (user, provider); ciphertext = AES-256-GCM(base64 iv||ct).
export default defineSchema({
  ...authTables,
  ...workspaceTables,
  ...apiCompatTables,
  ...memoryTables,
  ...comboTables,
  ...mcpClientTables,
  ...channelTables,
  ...scheduledAgentTables,
  ...usageRollupTables,
  ...auditLogTables,
  // kind: "api_key" (ciphertext = the key) | "oauth" (ciphertext = JSON {access,refresh,expires,accountId})
  modelCreds: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")), // set = workspace-SHARED cred; unset = personal
    provider: v.string(),
    kind: v.optional(v.string()),
    ciphertext: v.string(),
    endpoint: v.optional(v.string()), // custom OpenAI-compatible baseURL (BYOK custom provider); unset = built-in host
    updatedAt: v.number(),
    expires: v.optional(v.number()), // plaintext token expiry (oauth) — lets the lease check staleness without decrypting
    refreshLeaseUntil: v.optional(v.number()), // single-flight refresh lease
    // provider-pool (2.3) — graceful multi-credential failover. All additive/optional; existing rows
    // read as a single-cred pool (undefined priority = default, undefined status = live).
    label: v.optional(v.string()),          // human tag for this key in the multi-key UI
    priority: v.optional(v.number()),       // pool order, asc (default 100); lower tried first
    status: v.optional(v.string()),         // 'ok' | 'exhausted' (cooling) | 'dead' (excluded until re-auth)
    cooldownUntil: v.optional(v.number()),  // epoch ms; while now < this the cred is skipped
    backoffLevel: v.optional(v.number()),   // consecutive-failure count → exponential 429 cooldown
    lastErrorCode: v.optional(v.string()),  // last classifyError() code (429 → rate_limited, etc.)
    // last connectivity test result (a real 1-token call through the SAME path chat uses) —
    // lets the Providers list show a health badge instead of only failing deep in a chat.
    lastCheckedAt: v.optional(v.number()),
    lastCheckedOk: v.optional(v.boolean()),
    lastCheckedCode: v.optional(v.string()),
    lastCheckedDetail: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "provider"])
    .index("by_ws_provider", ["workspaceId", "provider"]),
  // per-call usage log — powers the stats dashboard (like 9router's usageHistory)
  usage: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    provider: v.string(),
    model: v.string(), // full "provider/model" ref
    promptTokens: v.number(),
    completionTokens: v.number(),
    status: v.string(), // "ok" | "error"
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_at", ["at"])
    .index("by_ws_at", ["workspaceId", "at"]),
  // per-user token-saver settings (Caveman/Ponytail system-prompt injection)
  settings: defineTable({
    userId: v.id("users"),
    activeWorkspaceId: v.optional(v.id("workspaces")), // last-selected workspace (switcher persistence)
    memoryEnabled: v.optional(v.boolean()), // inject recalled memory into chat (default ON)
    memoryAutoSummarize: v.optional(v.boolean()), // opt-in per-thread auto-summary (default OFF)
    cavemanEnabled: v.optional(v.boolean()),
    cavemanLevel: v.optional(v.string()),
    ponytailEnabled: v.optional(v.boolean()),
    ponytailLevel: v.optional(v.string()),
    agentMode: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
  // AI Agents: one row per task run. steps = a compact trace (assistant text + tool names per step).
  agentRuns: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    task: v.string(),
    model: v.string(),
    agentId: v.optional(v.id("agentDefs")), // set when run via a saved agent (vs an ad-hoc model+task)
    agentName: v.optional(v.string()), // denormalized so the trace still reads fine if the agent is later renamed/deleted
    status: v.string(), // "running" | "done" | "error"
    steps: v.optional(v.array(v.object({ text: v.string(), tools: v.array(v.string()) }))),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()), // structured classifyError() code — lets the client show a FRIENDLY message to non-admins
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    at: v.number(),
    finishedAt: v.optional(v.number()), // set by finish() → per-run duration = finishedAt - at
  }).index("by_user_at", ["userId", "at"]).index("by_ws_at", ["workspaceId", "at"]),
  // AI Agents: saved, reusable agent configs (named: skill × model × tools × max-iter).
  agentDefs: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.optional(v.string()), // 'private'(default) | 'workspace' (admin+ editable, all members see)
    name: v.string(),
    model: v.string(), // "provider/model" — the agent's fixed model
    instructions: v.optional(v.string()), // system prompt / skill description
    tools: v.array(v.string()), // enabled tool ids (see convex/toolRegistry.ts)
    skills: v.optional(v.array(v.string())), // instruction-bundle ids (see convex/skillsRegistry.ts), concatenated into the system prompt at run time
    maxSteps: v.number(), // tool-loop step budget, clamped [1,20]
    temperature: v.optional(v.number()), // clamped [0,2]; unset = provider default
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_ws", ["workspaceId"]),
  // AI Chat workbench: persisted threaded conversations. messages owned via their thread.
  threads: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    model: v.string(), // denormalized from the bound agent's model when agentId is set (see agentDefs.model)
    agentId: v.optional(v.id("agentDefs")), // set = replies route through this agent's instructions/skills/tools
    agentName: v.optional(v.string()), // denormalized so the thread list still reads fine if the agent is later renamed/deleted (matches agentRuns' pattern)
    at: v.number(),
  }).index("by_user_at", ["userId", "at"]).index("by_ws_user_at", ["workspaceId", "userId", "at"]),
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.string(), // "user" | "assistant"
    content: v.string(),
    at: v.number(),
  }).index("by_thread", ["threadId", "at"]),
  // MCP access tokens — one per issued bearer. We store only sha256(token); raw shown once.
  mcpTokens: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")), // bearer acts in this workspace; unset legacy = issuer's personal ws
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
  // Anti-abuse fixed-window counters (OAuth DCR / token / MCP). One row per "<bucket>:<key>";
  // Convex OCC makes the read-modify-write race-safe, so no rate-limiter library or lock is needed.
  rateLimits: defineTable({
    key: v.string(), // "<bucket>:<ip-or-token>", e.g. "dcr:1.2.3.4"
    count: v.number(),
    resetAt: v.number(), // window end (ms epoch); past it the window resets
  }).index("by_key", ["key"]).index("by_reset", ["resetAt"]),
});
