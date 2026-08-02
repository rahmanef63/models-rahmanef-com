// workspaces slice — table defs (spread into convex/schema.ts, the byok tablesExport pattern).
// The workspace is THE tenant boundary: an org / team / individual each get one; an individual is
// a personal workspace of one (personal: true, auto-created). Every scoped query filters by workspaceId.
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const workspaceTables = {
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    personal: v.boolean(), // personal ws of one — auto-created on first load
    ownerId: v.id("users"),
    credPolicy: v.optional(v.string()), // 'personal-first'(default)|'workspace-first'|'workspace-only'|'personal-only'
    capUsdPerMonth: v.optional(v.number()), // spend caps (Phase 5)
    capTokensPerDay: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]).index("by_owner", ["ownerId"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.string(), // 'owner'|'admin'|'member'|'viewer'
    invitedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_ws_user", ["workspaceId", "userId"]) // unique — the authz hot path
    .index("by_user", ["userId"]) // switcher: my workspaces
    .index("by_ws", ["workspaceId"]), // members table

  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(), // lowercase, informational in v1 (no email verification)
    role: v.string(), // admin|member|viewer — never owner
    tokenHash: v.string(), // sha256(raw); raw link shown once (mcpTokens pattern)
    invitedBy: v.id("users"),
    expiresAt: v.number(), // now + 7d
    acceptedBy: v.optional(v.id("users")),
    revoked: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]).index("by_ws", ["workspaceId"]),
};
