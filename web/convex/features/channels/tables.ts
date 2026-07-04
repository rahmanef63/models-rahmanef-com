// channels slice — table defs (spread into convex/schema.ts, the byok tablesExport pattern).
// Inbound messaging surface: a workspace pastes a bot token, an external user DMs the bot, the
// bound agent replies — always back to the SAME surface (deterministic routing). Every reply path
// lands in callForUser. Only sha256/ciphertext is stored for secrets; raw shown once.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const channelTables = {
  // one inbound surface (a Telegram bot, etc.) bound to a workspace + optional default agent.
  channels: defineTable({
    workspaceId: v.id("workspaces"), // tenant boundary
    userId: v.id("users"), // creator — the identity callForUser runs as (whose creds are spent)
    kind: v.string(), // 'telegram' | 'slack' | 'whatsapp' | 'discord' (registry-driven later)
    name: v.string(),
    slug: v.string(), // random url segment: <origin>/channels/<kind>/<slug> — LOOKUP ONLY, auth = platform secret
    secretCiphertext: v.string(), // AES-256-GCM JSON {botToken, secretToken} (crypto.ts)
    config: v.optional(v.any()), // per-kind extras (e.g. { model } fallback)
    // access policy: who may spend the owner's tokens via this bot. 'open' = any inbound sender;
    // 'allowlist' (default when unset — safe) = only channelIdentities flagged allowed (+ paired owner).
    accessPolicy: v.optional(v.string()), // 'open' | 'allowlist'
    agentId: v.optional(v.id("agentDefs")), // bound agent; unset → config.model fallback
    enabled: v.optional(v.boolean()),
    lastInboundAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_ws", ["workspaceId"]).index("by_slug", ["slug"]),

  // maps a platform sender (externalUserId) to a persisted thread (so the convo shows up in the web
  // workbench for free) and, later, to a paired app user. One row per (channel, external sender).
  channelIdentities: defineTable({
    channelId: v.id("channels"),
    externalUserId: v.string(), // platform sender id
    userId: v.optional(v.id("users")), // paired app user (optional; unset = runs as channel owner)
    threadId: v.optional(v.id("threads")), // the conversation thread for this sender
    displayName: v.optional(v.string()),
    allowed: v.optional(v.boolean()), // allowlist policy: true = this sender may spend (owner-approved)
    denyNotifiedAt: v.optional(v.number()), // one-time "ask the owner to add you" sent → don't repeat
    createdAt: v.number(),
  }).index("by_channel_external", ["channelId", "externalUserId"]),

  // at-least-once webhook dedupe + a thin inbound/outbound audit trail (cron-pruned).
  channelEvents: defineTable({
    channelId: v.id("channels"),
    dedupeKey: v.string(), // '<kind>:<channelId>:<update_id>' — reject on repeat (OCC-safe)
    direction: v.string(), // 'in' | 'out'
    payload: v.string(), // short preview (≤200 chars) — never full secrets
    at: v.number(),
  }).index("by_dedupe", ["dedupeKey"]).index("by_channel_at", ["channelId", "at"]).index("by_at", ["at"]),
};
