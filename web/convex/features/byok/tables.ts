// BYOK slice — table defs (spread into convex/schema.ts).
// modelCreds = one row per (user, provider); ciphertext = AES-256-GCM(base64 iv||ct).
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const byokTables = {
  // kind: "api_key" (ciphertext = the key) | "oauth" (ciphertext = JSON {access,refresh,expires,accountId})
  modelCreds: defineTable({
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")), // set = workspace-SHARED cred; unset = personal
    provider: v.string(),
    kind: v.optional(v.string()),
    ciphertext: v.string(),
    endpoint: v.optional(v.string()), // custom baseURL (BYOK custom provider); unset = built-in host
    protocol: v.optional(v.string()), // custom-provider wire protocol: 'anthropic' (Messages API) | unset = OpenAI /chat/completions
    models: v.optional(v.array(v.string())), // manually-entered model ids for a custom provider (no models.dev catalog) — feeds the chat picker
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
};
