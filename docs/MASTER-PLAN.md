# MASTER PLAN — models.rahmanef.com → Workspace AI Platform

> Consolidates the five pillar designs (workspaces-rbac, channels, memory, model-connection, workspace-ux-ops) into one sequenced build plan. Best-of hermes + openclaw + 9router, re-expressed on Next 16 + Convex as droppable rr slices.
>
> Status: PLAN. Checkboxes below double as the build tracker. Companion docs: `docs/AI-SLICES-PROGRESS.md`, `docs/COMPARISON-hermes-openclaw-9router.md`.

---

## 1. Vision

Turn models.rahmanef.com from a per-user BYOK chat workbench into a **workspace-based AI platform**: an org, team, or individual gets one tenant boundary (the workspace) inside which they share provider credentials, talk to agents from any surface (web, Telegram/Slack/WhatsApp/Discord, any OpenAI/Anthropic-compatible tool, MCP), and those agents remember, run on schedules, and account for every token spent.

**Guiding constraints (non-negotiable):**

1. **Every capability ships as a droppable rr slice** — `frontend/slices/<slug>` + `convex/features/<slug>` + the metadata trio, props-driven, no hardcoded consumer specifics. This app is the exemplar consumer, not the only one.
2. **The workspace is THE tenant boundary.** An individual is a personal workspace of one (auto-created, `personal: true`). No "solo vs team" code fork anywhere — every query scopes by `workspaceId`, period.
3. **Ponytail / laziest-that-works.** One pipeline (`callForUser`) touches provider creds; every new surface is a thin shim over it. Reuse our own proven patterns (sha256-shown-once tokens, `toolRegistry`, OCC leases, crons sweeps) instead of inventing. Everything in §8 stays unbuilt until a trigger fires.

---

## 2. Target architecture

```
                       INBOUND SURFACES                        OUTBOUND / CLIENTS
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    ┌──────────────────────┐
  │ Telegram │ │  Slack   │ │ WhatsApp │ │ Discord  │    │ Claude Code / Cursor  │
  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │ Codex / any OpenAI-   │
       │ webhooks (sig-verified, ACK<3s)      │          │ or Anthropic-compat   │
       ▼            ▼            ▼            ▼          │ client  + MCP clients │
  ┌─────────────────────────────────────────────────┐    └──────────┬───────────┘
  │ convex.site httpRouter                          │               │ sk-rr-… key
  │  /channels/<kind>/<slug>   (channels-core)      │◄──────────────┤ /v1/chat/completions
  │  /v1/*                     (api-compat)         │               │ /v1/messages /v1/models
  │  /mcp                      (existing MCP server)│◄──────────────┘ MCP bearer (ws-bound)
  └───────────────┬─────────────────────────────────┘
                  │ ingest → dedupe → pairing → thread upsert → scheduler
                  ▼
      ╔═══════════════════════════════════════════════════╗
      ║              W O R K S P A C E                    ║   ← tenant boundary
      ║  memberships (owner>admin>member>viewer)          ║   requireWorkspaceRole()
      ║  invites (hash-only links) · credPolicy · caps    ║   on EVERY function
      ║                                                   ║
      ║   ┌─────────┐   ┌──────────────────────────────┐  ║
      ║   │ agents  │──▶│  callForUser (ONE pipeline)  │  ║
      ║   │ defs +  │   │  resolveModelRef: combo/agent│  ║
      ║   │schedules│   │  resolveCred: personal⇄shared│  ║
      ║   └─────────┘   │  pickCredential: pool+backoff│  ║
      ║   ┌─────────┐   │  tools: registry + mcp__*    │  ║
      ║   │ memory  │──▶│  system: <memory-context>    │  ║
      ║   │ budgeted│   └───────────┬──────────────────┘  ║
      ║   └─────────┘               │                     ║
      ║   usage rows → daily rollups → est cost → caps    ║
      ║   auditEvents (append-only, 90d)                  ║
      ╚═══════════════════╤═══════════════════════════════╝
                          │ BYOK creds (AES-256-GCM, MODELS_ENC_KEY)
                          ▼
        OpenAI · Anthropic · OpenRouter · … (providers)   +  external MCP servers (HTTP/SSE)
```

Data flow rule: **replies always go back to the surface they came from** (openclaw deterministic routing — the model never picks a channel), and **every path lands in `callForUser`** (openclaw same-codepath principle — it is the only code that decrypts provider creds).

---

## 3. Unified data model

### 3.0 Conflict resolutions between pillars (decided here, binding)

| Conflict | Resolution |
|---|---|
| `workspaces` defined by both workspaces-rbac and workspace-ux-ops | ONE table, union of fields: rbac's `personal` + `credPolicy` + ux-ops' `capUsdPerMonth` + `capTokensPerDay`. Owned by the `workspaces` slice. |
| `memberships` (rbac) vs `workspaceMembers` (ux-ops) | `memberships`, index names `by_ws_user` / `by_user` / `by_ws` (rbac naming wins — it ships first). |
| `invites` (rbac, `tokenHash`) vs `workspaceInvites` (ux-ops, `codeHash`) | `invites` with `tokenHash`. Copy-link only; ux-ops' invite-by-code is the same thing. |
| `requireWorkspaceRole` (rbac) vs `requireMember` (ux-ops) | ONE helper: `requireWorkspaceRole(ctx, workspaceId, minRole)` in `web/convex/_shared/auth.ts` + action twin. ux-ops' `_shared/workspace.ts` is dropped. |
| memory `workspaceId: v.optional(v.string())` (standalone hedge) | In THIS repo: `v.optional(v.id('workspaces'))` — workspaces ships in Phase 1, before memory. The distributed slice manifest lists `workspaces` as an optional peer; standalone installs degrade to user-scope only. |
| channels bind to `userId` (no workspaces yet, per channels pillar) | Channels ship AFTER workspaces (Phase 3), so `channels.workspaceId: v.id('workspaces')` from day one; `userId` stays as creator attribution + cred-resolution identity. No migration needed. |
| `usage` index `by_ws_at` (rbac) vs `by_workspace_at` (ux-ops) | `by_ws_at`. |
| `agentSchedules.deliver` target format vs channels addressing | Standardized: `deliver: { kind: 'none'|'channel', channelId?: v.id('channels'), peerKey?: v.string() }` — reuses channels' peerKey shape exactly. |
| `workspace-shell` slice (ux-ops) vs `workspaces` slice (rbac) | Dissolved. Tables + authz + WorkspaceProvider/Switcher/Members/Invites → `workspaces` slice. The role-gated NAV lookup map is **app-level config** in `web/app/app` (nav entries `{id, label, minRole, render}` injected per consumer), not a distributable slice. `usage-rollups` and `audit-log` remain their own slices. |

### 3.1 NEW tables

```ts
// ── tenancy (slice: workspaces) ──────────────────────────────────────────
workspaces: defineTable({
  name: v.string(), slug: v.string(),
  personal: v.boolean(),                     // personal ws of one — auto-created
  ownerId: v.id('users'),
  credPolicy: v.optional(v.string()),        // 'personal-first'(default)|'workspace-first'|'workspace-only'|'personal-only'
  capUsdPerMonth: v.optional(v.number()),    // spend caps (Phase 5)
  capTokensPerDay: v.optional(v.number()),
  createdAt: v.number(),
}).index('by_slug', ['slug']).index('by_owner', ['ownerId']),

memberships: defineTable({
  workspaceId: v.id('workspaces'), userId: v.id('users'),
  role: v.string(),                          // 'owner'|'admin'|'member'|'viewer'
  invitedBy: v.optional(v.id('users')), createdAt: v.number(),
}).index('by_ws_user', ['workspaceId','userId'])   // unique — the authz hot path
  .index('by_user', ['userId'])                    // switcher: my workspaces
  .index('by_ws', ['workspaceId']),                // members table

invites: defineTable({
  workspaceId: v.id('workspaces'),
  email: v.string(),                         // lowercase, informational in v1
  role: v.string(),                          // admin|member|viewer — never owner
  tokenHash: v.string(),                     // sha256(raw); raw shown once (mcpTokens pattern)
  invitedBy: v.id('users'), expiresAt: v.number(),          // now+7d
  acceptedBy: v.optional(v.id('users')), revoked: v.optional(v.boolean()),
  createdAt: v.number(),
}).index('by_tokenHash', ['tokenHash']).index('by_ws', ['workspaceId']),

// ── model gateway (slices: api-compat, mcp-client, combos) ───────────────
apiKeys: defineTable({
  userId: v.id('users'), workspaceId: v.id('workspaces'),   // key acts inside ONE workspace
  keyHash: v.string(),                       // sha256; raw `sk-rr-<43ch b64url>` shown once
  prefix: v.string(),                        // first 12 chars for UI
  label: v.string(), createdAt: v.number(),
  lastUsedAt: v.optional(v.number()), revoked: v.optional(v.boolean()),
}).index('by_hash', ['keyHash']).index('by_user', ['userId']).index('by_ws', ['workspaceId']),

mcpServers: defineTable({                     // OUTBOUND MCP (we are the client)
  userId: v.id('users'), workspaceId: v.optional(v.id('workspaces')),
  name: v.string(),                          // slug → tool namespace mcp__<name>__*
  url: v.string(), transport: v.string(),    // 'http'|'sse'
  headersCiphertext: v.optional(v.string()), // AES-256-GCM JSON (convex/crypto.ts)
  enabled: v.boolean(),
  toolCache: v.optional(v.array(v.object({ name: v.string(), description: v.string(), inputSchema: v.any() }))),
  toolsCachedAt: v.optional(v.number()),
  lastProbeAt: v.optional(v.number()), lastProbeOk: v.optional(v.boolean()), lastProbeError: v.optional(v.string()),
  createdAt: v.number(), updatedAt: v.number(),
}).index('by_user', ['userId']).index('by_user_name', ['userId','name']),

combos: defineTable({
  userId: v.id('users'), workspaceId: v.optional(v.id('workspaces')),
  name: v.string(),                          // addressed as 'combo/<name>'
  models: v.array(v.string()),               // ordered 'provider/model' refs, max 5
  strategy: v.string(),                      // 'fallback'|'round_robin'
  stickyLimit: v.optional(v.number()),       // default 1
  rotationIndex: v.optional(v.number()), useCount: v.optional(v.number()),
  createdAt: v.number(), updatedAt: v.number(),
}).index('by_user', ['userId']).index('by_user_name', ['userId','name']),
// rotation state lives ON the row (OCC-safe) — 9router keeps it in-memory; Convex is stateless

// ── memory (slice: memory) ───────────────────────────────────────────────
memories: defineTable({
  userId: v.id('users'), workspaceId: v.optional(v.id('workspaces')),
  scope: v.string(),                         // 'user'|'workspace'|'agent'
  agentId: v.optional(v.id('agentDefs')),    // required when scope='agent'
  kind: v.string(),                          // 'fact'|'preference'|'summary'
  text: v.string(),                          // fence-tags stripped at write; char-budgeted per scope
  source: v.string(),                        // 'explicit-tool'|'ui'|'auto-summary'
  sourceThreadId: v.optional(v.id('threads')),// summary upsert key
  pinned: v.optional(v.boolean()), archived: v.optional(v.boolean()),   // curation ARCHIVES, never deletes
  lastRecalledAt: v.optional(v.number()), recallCount: v.optional(v.number()),
  embedding: v.optional(v.array(v.float64())), embeddingModel: v.optional(v.string()),  // phase-2 slot, unused at launch
  createdAt: v.number(), updatedAt: v.number(),
}).index('by_user_scope', ['userId','scope','archived'])        // hot-path injection read
  .index('by_user_thread', ['userId','sourceThreadId'])         // summary upsert
  .index('by_workspace_scope', ['workspaceId','scope','archived'])
  .searchIndex('search_text', { searchField: 'text', filterFields: ['userId','scope','kind','archived'] }),
// PHASE-2 ONLY: .vectorIndex('by_embedding', { vectorField:'embedding', dimensions:1536, filterFields:['userId','scope'] })

// ── channels (slice: channels-core) ──────────────────────────────────────
channels: defineTable({
  workspaceId: v.id('workspaces'), userId: v.id('users'),     // ws = tenant; userId = creator + cred identity
  kind: v.string(),                          // 'telegram'|'slack'|'whatsapp'|'discord' (registry-driven)
  name: v.string(), status: v.string(),      // 'active'|'paused'|'error'
  secretCiphertext: v.string(),              // AES-256-GCM JSON {botToken?,signingSecret?,appSecret?,verifyToken?,publicKey?,phoneNumberId?,applicationId?}
  webhookSlug: v.string(),                   // random 24-char URL token — LOOKUP ONLY, auth = platform signature
  agentDefId: v.optional(v.id('agentDefs')), // default agent
  model: v.optional(v.string()),             // fallback 'provider/model' (API-key models only — no codex/claude-oauth tool loops)
  dmPolicy: v.string(),                      // 'pairing'(default)|'allowlist'|'open' ('open' needs explicit UI confirm)
  groupPolicy: v.optional(v.string()),       // 'mention'(default)|'always'|'off'
  botConfig: v.optional(v.object({ replyPrefix: v.optional(v.string()), maxChars: v.optional(v.number()), typingIndicator: v.optional(v.boolean()) })),
  routing: v.optional(v.array(v.object({ peerKind: v.string(), peerId: v.string(), agentDefId: v.id('agentDefs') }))),  // first-match
  lastInboundAt: v.optional(v.number()), lastError: v.optional(v.string()), lastErrorAt: v.optional(v.number()),
  createdAt: v.number(), updatedAt: v.number(),
}).index('by_ws', ['workspaceId']).index('by_slug', ['webhookSlug']),

channelIdentities: defineTable({
  channelId: v.id('channels'), channelUserId: v.string(),     // platform sender id
  displayName: v.optional(v.string()), handle: v.optional(v.string()),
  status: v.string(),                        // 'pending'|'approved'|'blocked'
  pairingCode: v.optional(v.string()),       // 8 chars uppercase, no 0O1I (openclaw pairing)
  pairingExpiresAt: v.optional(v.number()),  // +1h; max 3 pending per channel
  linkedUserId: v.optional(v.id('users')),   // future guest→member link, unused wave 1
  firstSeenAt: v.number(), approvedAt: v.optional(v.number()),
}).index('by_channel_user', ['channelId','channelUserId']).index('by_channel_status', ['channelId','status']),

channelEvents: defineTable({                  // at-least-once webhook dedupe
  channelId: v.id('channels'), externalEventId: v.string(), at: v.number(),
}).index('by_channel_event', ['channelId','externalEventId']).index('by_at', ['at']),  // cron-pruned >48h

// ── ops (slices: scheduled-agents, usage-rollups, audit-log) ─────────────
agentSchedules: defineTable({
  workspaceId: v.id('workspaces'), userId: v.id('users'),
  agentId: v.id('agentDefs'), agentName: v.string(),          // denormalized (agentRuns pattern)
  task: v.string(),
  schedule: v.object({ kind: v.string() /* 'once'|'interval'|'daily' — 'cron' deferred */,
    minutes: v.optional(v.number()), at: v.optional(v.number()),
    hh: v.optional(v.number()), mm: v.optional(v.number()), tz: v.optional(v.string()) }),
  enabled: v.boolean(), nextRunAt: v.number(),
  lastRunAt: v.optional(v.number()), lastStatus: v.optional(v.string()), lastError: v.optional(v.string()),
  runCount: v.number(), consecutiveErrors: v.number(),        // auto-pause at 5
  deliver: v.optional(v.object({ kind: v.string() /* 'none'|'channel' */,
    channelId: v.optional(v.id('channels')), peerKey: v.optional(v.string()) })),
  createdAt: v.number(), updatedAt: v.number(),
}).index('by_ws', ['workspaceId']).index('by_enabled_next', ['enabled','nextRunAt']),

workspaceUsageDaily: defineTable({            // one OCC-upserted row per (workspace, UTC day)
  workspaceId: v.id('workspaces'), day: v.string(),           // 'YYYY-MM-DD'
  requests: v.number(), promptTokens: v.number(), completionTokens: v.number(),
  errors: v.number(), estCostUsd: v.number(),
  unpricedTokens: v.number(),                // honesty valve — tokens with no known rate
  byModel: v.record(v.string(), v.object({ requests: v.number(), prompt: v.number(), completion: v.number(), estCostUsd: v.number() })),
  byUser:  v.record(v.string(), v.object({ requests: v.number(), prompt: v.number(), completion: v.number() })),
}).index('by_workspace_day', ['workspaceId','day']),

modelRates: defineTable({                     // daily snapshot from models.dev catalog
  model: v.string(),                          // 'provider/model'
  inputPerM: v.number(), outputPerM: v.number(),
  cacheReadPerM: v.optional(v.number()), cacheWritePerM: v.optional(v.number()),
  fetchedAt: v.number(),
}).index('by_model', ['model']),

auditEvents: defineTable({                    // append-only, 90-day sweep
  workspaceId: v.id('workspaces'), actorUserId: v.id('users'),
  action: v.string(),                         // dotted verbs: 'cred.set','member.role','schedule.create','token.issue','cap.set',…
  targetType: v.optional(v.string()), targetId: v.optional(v.string()),
  summary: v.string(),                        // human one-liner — NEVER secret material
  at: v.number(),
}).index('by_workspace_at', ['workspaceId','at']).index('by_at', ['at']),
```

### 3.2 RETROFIT of existing tables (all additive/optional — zero migration for existing rows)

| Table | New fields | New indexes | Notes |
|---|---|---|---|
| `modelCreds` | `workspaceId?` (set = workspace-SHARED cred; unset = personal) · pool: `label?`, `priority?` (default 100), `status?` ('ok'\|'exhausted'\|'dead'), `cooldownUntil?`, `backoffLevel?`, `lastErrorCode?` | `by_ws_provider ['workspaceId','provider']` | Existing rows already correct as personal creds. `.unique()` reads on `by_user_provider` become `.take(10)` pool reads. |
| `threads` | `workspaceId?`, `channelId?`, `peerKey?` ('<kind>:dm:<id>' \| ':group:<id>' \| ':topic:<id>'), `summarizedUpTo?`, `msgCharCount?` | `by_ws_user_at ['workspaceId','userId','at']`, `by_channel_peer ['channelId','peerKey']` | Channel conversations reuse threads/messages → appear in the chat workbench for free. Threads stay creator-private in v1. |
| `agentDefs` | `workspaceId?`, `visibility?` ('private' default \| 'workspace') | `by_ws ['workspaceId']` | Workspace-shared agents editable by admin+. |
| `agentRuns` | `workspaceId?`, `scheduleId?: v.id('agentSchedules')` | `by_ws_at ['workspaceId','at']` | Scheduled runs reuse the existing trace viewer — no scheduleRuns table. |
| `usage` | `workspaceId?`, `source?` ('web'\|'mcp'\|'api'\|'channel'\|'schedule'), `apiKeyId?` | `by_ws_at ['workspaceId','at']`, `by_apiKey ['apiKeyId','at']` | Written with BOTH userId and workspaceId. Member sees own rows; admin+ sees workspace burn. |
| `mcpTokens` | `workspaceId?` (bearer acts in this workspace; unset legacy = issuer's personal ws) | — | `verify()` returns `{userId, workspaceId}`; dispatch re-checks live membership per call. |
| `settings` | `activeWorkspaceId?`, `memoryEnabled?` (default ON), `memoryAutoSummarize?` (default OFF — spends user's BYOK) | — | User prefs stay per-user; workspace knobs (credPolicy, caps) live ON the workspaces row. |

**UNCHANGED:** `oauthFlows` (always personal; workspace sharing = explicit "promote" after connect), `mcpClients`, `mcpAuthCodes`, `messages` (scoped via thread), `rateLimits` (reused as-is with new buckets `v1key:<apiKeyId>`, `v1ip:<ip>`, `chanid:<identityId>`).

**Authz core** (not a table): `web/convex/_shared/auth.ts` exports `ROLE_RANK = { viewer:0, member:1, admin:2, owner:3 }`, `requireWorkspaceRole(ctx, workspaceId, minRole)` → `requireUser` → `memberships.by_ws_user.unique()` → throw `ConvexError({code:'forbidden'})` or return `{userId, workspaceId, role}`; plus `requireWorkspaceRoleAction` for ActionCtx via `internal.workspaces.checkMembership` (same db-isolation trick as `credentials.ts`). `isSuperAdmin`/`requireAdmin` remain the cross-tenant host-operator tier above owner. Also `_shared/audit.ts` → `logAudit(ctx, evt)` plain-insert helper. This single helper closes the "3 inline auth idioms" audit gap for all new code.

---

## 4. Slice catalog

Sequenced; each row = one rr slice with the metadata trio unless marked EXTEND/APP.

| # | Slug | Kind | Owns | Deps (peers) | Phase |
|---|------|------|------|--------------|-------|
| 1 | `workspaces` | NEW | workspaces/memberships/invites tables · `requireWorkspaceRole` (+action twin) · `WorkspaceProvider`/`WorkspaceSwitcher`/`MembersTable`/`InviteDialog` · `/invite/[token]` page · backfill migration | `@convex-dev/auth` | 1 |
| 2 | `byok` v0.2 | EXTEND | workspace-shared creds tab · `promoteToWorkspace`/demote · credPolicy selector · `resolveCred` read-through | `workspaces` (optional — degrades to personal-only) | 1 |
| 3 | `api-compat` | NEW | apiKeys table + mint/list/revoke · `/v1/*` httpActions (v1Auth, v1ChatCompletions, v1Models, sse, translators/anthropic) · Next rewrite · API-keys card + client setup snippets | `byok` (callForUser), `workspaces` | 2 |
| 4 | `provider-pool` | EXTEND byok | modelCreds pool fields · `pickCredential`/`markCredResult` · `fallbackRules.ts` · ≤3-attempt loop in callForUser · multi-key UI (priority drag, cooldown badges) | `byok` | 2 |
| 5 | `combos` | NEW | combos table + CRUD · `resolveModelRef()` (`combo/<name>` + `agent/<id>`) · rotation mutation · combo builder UI | `byok`, `provider-pool` | 2 |
| 6 | `mcp-client` | NEW | mcpServers table + CRUD + probe · `mcpClientLib.ts` (AI-SDK `experimental_createMCPClient`, HTTP/SSE) · `mcp__<server>__<tool>` merger into gatewayTools · server list/probe/tool-browser UI | crypto + toolRegistry conventions | 2 |
| 7 | `memory` | NEW | memories table · crud/budgets/inject/recall/summarize/curation/toolHandlers · `memory` + `recall_memory` registry tools · MemoryPanel (scope tabs, budget bars) · daily curation cron | `@convex-dev/auth`; `workspaces` optional | 2 |
| 8 | `channels-core` | NEW | channels/channelIdentities/channelEvents tables · `ChannelAdapter` contract + `CHANNEL_REGISTRY` · generic `/channels/` httpAction ingress · ingest mutation · dispatch action · pairing mutations · Channels admin UI · prune cron | `workspaces`, `byok` | 3 |
| 9 | `channel-telegram` | NEW | Telegram adapter · setWebhook register action · TelegramConnectCard | `channels-core` | 3 |
| 10 | `channel-slack` | NEW | Slack adapter (challenge, v0 HMAC, bot_id loop guard, thread_ts) | `channels-core` | 3 |
| 11 | `channel-whatsapp` | NEW | Meta Cloud API adapter (hub handshake, X-Hub-Signature-256, 24h-window errors) | `channels-core` | 3 |
| 12 | `channel-discord` | NEW | Interactions-endpoint adapter (@noble/ed25519, type-5 deferred ack, follow-up webhook, /ask registration) | `channels-core` | 3 |
| 13 | `scheduled-agents` | NEW | agentSchedules table + CRUD · minute-tick cron + OCC claim · `runForSchedule` → existing runAgent · deliver-to-channel · Schedules card | `workspaces`; `channels-core` optional (deliver) | 4 |
| 14 | `usage-rollups` | NEW | workspaceUsageDaily + modelRates tables · estCostUsd hook in usage.log · daily rates cron · `assertUnderCap` · Usage card (per-member, per-model, cap editor) | `workspaces` | 5 |
| 15 | `audit-log` | NEW | auditEvents table · `logAudit` helper · retention sweep · admin Audit card (paginated, filter pills) | `workspaces` | 5 |
| — | role-gated NAV map | APP (not a slice) | `web/app/app` nav config `{id,label,minRole,render}` — other slices' sections drop in as entries | — | 1→5 |

---

## 5. Phased roadmap

Sizing: S ≈ hours, M ≈ a day, L ≈ multi-day. Each phase is independently shippable; push-to-main per delivery rules after `npx tsc --noEmit` + validate.

### Phase 1 — Workspaces: the tenant boundary (slices: `workspaces`, `byok` v0.2)

> **Progress (2026-07-04):** 1.1–1.4 shipped + live (schema spine, authz, workspace CRUD, provider+switcher). Next: 1.5 backfill + 1.6 scope retrofit (the risky L step).

**Definition of done:** every public Convex function is workspace-scoped; a second user can be invited via link, share a provider key under credPolicy, both burn tokens on it, and removing them instantly revokes everything including live MCP bearers.

- [x] (S) **1.1 Schema spine** — add workspaces/memberships/invites + ALL optional `workspaceId` retrofits + indexes from §3 to `web/convex/schema.ts` (table defs re-exported from `convex/features/workspaces/tables.ts`, byok tablesExport pattern). Nothing reads them — zero risk.
- [x] (M) **1.2 Authz core** — `ROLE_RANK` + `requireWorkspaceRole` + `requireWorkspaceRoleAction` in `web/convex/_shared/auth.ts` (~40 lines). Super-admin tier untouched.
- [x] (M) **1.3 Workspace functions** — `ensurePersonal` (idempotent), `myWorkspaces` (`by_user` join, `.take(50)`), create/rename/delete, listMembers/updateRole/removeMember (admin+; only owner touches admin roles; owner immutable except transfer), leaveWorkspace.
- [x] (M) **1.4 Frontend slice** — `WorkspaceProvider` context `{workspaceId, role, personal, switchTo}` (bootstrap: ensurePersonal → `settings.activeWorkspaceId ?? personal`); `WorkspaceSwitcher` dropdown in the app header; on any `forbidden` throw, self-heal to personal (prevents the hard-loop). Wire into `web/app/app` shell; convert the nav array to the role-gated NAV map at the same time.
- [ ] (M) **1.5 Backfill** — `convex/features/workspaces/migrate.ts` internalMutation: paginate users → ensurePersonal; then threads/agentDefs/agentRuns/usage/mcpTokens in 200-row `.paginate` batches, patch `workspaceId = personalWsOf(userId)`, self-reschedule via `ctx.scheduler.runAfter(0,…)`. Runbook: `npx convex run workspaces:migrate`. No bare `.collect()`.
- [ ] (L) **1.6 Scope retrofit** — every public fn in `threads.ts`, `agentDefs.ts`, `agents.ts`, `usage.ts`, `chat.ts` gains `workspaceId` arg + `requireWorkspaceRole` ('viewer' for reads, **'member' for anything that can spend tokens** — viewers must never reach callForUser). Two-step deploy: (a) arg optional, missing → resolve to personal server-side; client updated to always pass; (b) tighten to required. Reads fall back to `by_user_at` until backfill confirmed done.
- [ ] (M) **1.7 BYOK shared creds** — `resolveCred({userId, workspaceId, provider})` in callForUser honoring `credPolicy` ('personal-first' default: `by_user_provider` then `by_ws_provider`; 'workspace-first' reversed; '-only' skips fallback). byok UI: Workspace tab (admin+ paste key, or "Promote my <provider> connection" — re-inserts ciphertext with workspaceId, personal row kept; document that upstream OAuth revocation kills the copy). Team-workspace creation nudges 'workspace-first'. `lastCheckedOk` health badge prominent on shared creds (a revoked refresh token bricks the whole team).
- [ ] (M) **1.8 Invites** — createInvite (admin+; 32-byte token, store sha256, raw link `/invite/<token>` shown once), revokeInvite, acceptInvite (checks !revoked, !acceptedBy, unexpired) + `app/invite/[token]` route (sign-in gate → accept → switch). UI copy: "this link is a bearer secret" (no email verification in v1).
- [ ] (S) **1.9 MCP workspace binding** — token-issue UI gains workspace picker; `verify()` returns `{userId, workspaceId ?? personal}`; MCP dispatch calls `checkMembership(…, 'member')` per request.
- [ ] (S) **1.10 Ship trio** — `workspaces` slice.json (tablesExport `workspaces,memberships,invites`) + contract + manifest; byok → 0.2.0 with optional `workspaces` peer; tsc + validate + `docs/AI-SLICES-PROGRESS.md` entry. All files ≤200 lines.

### Phase 2 — Model gateway + memory (slices: `api-compat`, `provider-pool`, `combos`, `mcp-client`, `memory`)

**Definition of done:** Claude Code and Cursor point at `https://models.rahmanef.com/v1` with an `sk-rr-` key bound to a workspace and complete a real tool-call loop; agents consume external MCP servers as tools; agents remember corrections/preferences across sessions within char budgets.

- [ ] (S) **2.1 API keys** — apiKeys table + issue (`sk-rr-` + b64url(32B), sha256 at rest, shown once, workspace-bound) / list / revoke; UI card. Copy mcpTokens shape from `web/convex/mcp.ts` verbatim-in-spirit.
- [ ] (M) **2.2 /v1 non-streaming** — `http.route('/v1/chat/completions')` + GET `/v1/models`(+prefix). `v1Auth.ts`: accept `Authorization: Bearer` AND `x-api-key`; hash → `by_hash`; rate buckets `v1key:<id>` (120/min) + pre-auth `v1ip:<ip>`; **never falls back to session auth**. Map ConvexError→OpenAI error JSON (401/402/404/429/500). `stream:true` → pseudo-stream SSE (role Δ, content Δ, finish, `[DONE]`). `/v1/models` = connected providers × models.dev catalog + `combo/<name>` + `agent/<id>` pseudo-models. Next rewrite: `{ source: '/v1/:path*', destination: '<CONVEX_SITE_URL>/v1/:path*' }`. Usage logged with `source:'api'` + `apiKeyId`.
- [ ] (M) **2.3 provider-pool** — modelCreds pool fields; `fallbackRules.ts` ordered rule table (429→exp backoff 1s·2^n cap 4min; 5xx→short cooldown; 401/invalid_grant/token_revoked/invalid_token→`dead`, excluded until re-auth); `pickCredential` (`by_user_provider`/`by_ws_provider` `.take(10)`, filter live, sort priority-then-LRU); `markCredResult`; ≤3-attempt loop replacing the single getCiphertext at `callForUser.ts:44`. Refresh-lease already per-row → OAuth creds pool for free. byok UI: "+ add another key", priority, cooldown countdown.
- [ ] (S) **2.4 combos** — table + CRUD (slug name, ≤5 'provider/model' refs); `resolveModelRef()` at top of callForUser: reserved prefixes `combo/` `agent/` checked BEFORE provider split ('combo'/'agent' rejected as provider slugs in byok); fallback iterates on fallback-worthy errors; round_robin reads rotationIndex, bumps via mutation at stickyLimit.
- [ ] (M) **2.5 mcp-client** — mcpServers CRUD (headers via encryptSecret) + probe action ('use node', `experimental_createMCPClient`, HTTP + SSE transports) → toolCache + lastProbe*; `mcpClientTools(ctx,userId)` exposes cached tools as `mcp__<server>__<tool>` AI-SDK tools (per-call connect/call/close — no persistent processes in Convex, ~100-400ms accepted); merged into `gatewayTools()` so `agentDefs.tools` can reference them; **surface 'agent' only — never re-exported on our MCP server (loop guard)**; credential-stripping on error text returned to the LLM (hermes rule). UI: list/add/probe/tool browser + "refresh tools" button.
- [ ] (M) **2.6 /v1 real streaming + tool passthrough** — AI-SDK direct-key path runs `streamText` inside the httpAction (Convex streams Response bodies; AES-GCM decrypt works in default runtime), translated to OpenAI SSE chunks; client `tools`/`tool_choice` passed as execute-less tools, toolCalls → `choices[].message.tool_calls` + `finish_reason:'tool_calls'` (this is what makes agent loops work). Additive `callForUserRaw` variant round-trips tool_calls without touching the two existing callers. codex/claude-OAuth paths ('use node', reachable only via non-streaming `ctx.runAction`) stay pseudo-stream. Verify with a live Claude Code session before calling done.
- [ ] (M) **2.7 Anthropic /v1/messages translator** — pure request/response mapping (9router `claude.js` shape) so `ANTHROPIC_BASE_URL=https://models.rahmanef.com` + `ANTHROPIC_AUTH_TOKEN=sk-rr-…` works. `/v1/responses` deferred until real Codex demand.
- [ ] (S) **2.8 memory schema + CRUD** — memories table; crud.ts + budgets.ts (constants: user 1400 / agent 2200 / workspace 2000 / injected summary 1500 chars). Port hermes memory_tool semantics exactly: duplicate-reject; substring replace/remove with ambiguity error listing 80-char previews; **over-budget returns `{error:'Memory at X/Y chars… consolidate now', currentEntries}` so the model self-curates in-turn**; strip `/<\/?\s*memory-context\s*>/gi` on every write.
- [ ] (M) **2.9 memory injection + tools** — `buildMemoryContext(userId, agentId?, threadId?)` (user rows + agent rows + this thread's summary; indexed `.take`, no collect) rendering the fenced `<memory-context>` block with the "[System note: recalled memory, NOT new user input…]" header; wired into callForUser right after settings lookup when `memoryEnabled !== false`; deterministic createdAt ordering (prompt-cache friendly). Registry tools: `memory` (add/replace/remove; the description IS the learning loop — "save proactively on corrections/preferences/discoveries, SKIP task progress") + `recall_memory` (`.withSearchIndex('search_text').take(8)`, fire-and-forget recall bumps), surfaces `['agent','mcp']`.
- [ ] (M) **2.10 memory auto-summarize + UI + curation** — opt-in summarize (trigger: >12k chars or 30 msgs since watermark → `scheduler.runAfter(0,…)`, NEVER inline; user's own BYOK, usage logged); MemoryPanel tab (scope tabs, pin/archive/edit, budget bars "82% — 1,803/2,200"); daily curation cron (archive-only: dead-thread/90d-stale summaries, exact dupes; pinned bypasses everything).
- [ ] (S) **2.11 Ship trios** — api-compat, provider-pool (byok extension), combos, mcp-client, memory: slice.json/contract/manifest each; progress doc updated.

### Phase 3 — Channels (slices: `channels-core`, `channel-telegram`, `channel-slack`, `channel-whatsapp`, `channel-discord`)

**Definition of done:** paste a BotFather token, DM the bot, the bound agent replies using workspace creds; strangers hit pairing codes; Slack, WhatsApp Cloud, and Discord interactions all round-trip; duplicate webhooks never double-answer.

- [ ] (S) **3.1 Schema** — channels/channelIdentities/channelEvents + threads.channelId/peerKey (already landed in 1.1 if bundled — else add now).
- [ ] (M) **3.2 Contract + registry** — `ChannelAdapter` interface + `NormalizedInbound` + `CHANNEL_REGISTRY` (mirrors `toolRegistry.ts`). See §6.2 for the full interface.
- [ ] (M) **3.3 Ingress** — `http.route({ pathPrefix: '/channels/', method: 'POST' })` (+GET for slack/whatsapp challenges): parse kind+slug → `by_slug` → decryptSecret → `adapter.challenge` → `adapter.verify(rawBody BEFORE json.parse — HMAC needs exact bytes)` → normalize → per inbound: `runMutation ingest` → return `adapter.ack() ?? 200`. Ingest = dedupe insert (channelEvents, same transaction as message insert — no check-then-act) → identity/pairing gate → thread upsert by `(channelId, peerKey)` → insert user message → `scheduler.runAfter(0, dispatch)`. **NEVER call the model inside the httpAction** (3s ACK windows) — encoded in the slice contract docs.
- [ ] (S) **3.4 Pairing + policy** — unknown sender under 'pairing' → pending identity + 8-char code sent back once, message dropped until approved; 3-pending cap, 1h expiry. groupPolicy 'mention' via adapter `wasMentioned` flag. Per-identity rate limiting reuses `rateLimits` (`chanid:<id>`).
- [ ] (M) **3.5 Dispatch** — load channel + last 30 thread messages (`.take`); resolve agent = routing first-match → `channel.agentDefId` → `channel.model`; build system/skills like chat.ts's agentId branch; `callForUser(ctx, channel.userId, …)` with workspace credPolicy resolution; **`assertUnderCap` once Phase 5 lands**; log usage `source:'channel'`; chunk to `adapter.chunkLimit` with per-chunk delay; `adapter.send` back to origin peer; on error: `lastError` + short friendly text to the peer.
- [ ] (M) **3.6 channel-telegram** — first shipping channel: secret_token verify, Update normalize (forum topics → `:topic:<id>`), sendMessage/sendChatAction, chunk 4096, `setWebhook{url, secret_token}` register action, TelegramConnectCard (paste token → auto setWebhook → health badge). End-to-end demo gate for the phase.
- [ ] (M) **3.7 Channels admin UI** — list + health badges, create wizard (kind picker from CHANNEL_REGISTRY keys — dynamic), agent binding (filter out codex/claude-oauth models), routing editor, pending-pairings inbox, 'open' dmPolicy explicit-confirm.
- [ ] (M) **3.8 channel-slack** — url_verification echo, `v0=` HMAC (5-min ts window), event_id dedupe, skip `bot_id` (loop protection), chat.postMessage + thread_ts, chunk 4000.
- [ ] (M) **3.9 channel-whatsapp** — GET hub.verify_token/challenge handshake, X-Hub-Signature-256, graph.facebook.com send, 24h-window errors surfaced as lastError; Meta app setup README.
- [ ] (M) **3.10 channel-discord** — @noble/ed25519 verify (pure JS — validate in Convex default runtime FIRST), type-5 deferred ack, follow-up webhook reply, `/ask` command registration.
- [ ] (S) **3.11 Housekeeping cron** — prune channelEvents >48h + expired pending identities (indexed `.take` batches).
- [ ] (S) **3.12 Ship trios** — five slices, all ≤200-line files, progress doc.

### Phase 4 — Scheduled agents (slice: `scheduled-agents`)

**Definition of done:** a daily-scheduled agent runs unattended off the minute tick, its run appears in the existing agentRuns trace viewer, its result is delivered to a Telegram peer, and it auto-pauses after 5 consecutive errors.

- [ ] (M) **4.1 Table + CRUD + tick** — agentSchedules + CRUD (`requireWorkspaceRole 'member'`); `computeNextRun` for once/interval/daily-with-tz (~40 lines, `Intl.DateTimeFormat`, **unit-test DST transitions**, no cron lib); `crons.interval('tick agent schedules', {minutes:1}, …)`: `by_enabled_next .lte(now).take(10)` (natural stagger), CLAIM by advancing nextRunAt in the same mutation (OCC single-flight, refreshLeaseUntil trick), early-exit when no rows, then `scheduler.runAfter(0, runForSchedule)`.
- [ ] (M) **4.2 runForSchedule** — execute bound agentDef via the EXISTING runAgent loop with `agentRuns.scheduleId` + `workspaceId` set; usage `source:'schedule'`; success → clear consecutiveErrors, 'once' soft-disables itself (history stays); error → increment, auto-pause at 5 with lastError.
- [ ] (S) **4.3 Schedules UI + deliver** — Schedules card (pick agentDef, task, cadence radio — **default daily, not interval**, unattended BYOK burn), next-run countdown, last-status badge, pause/resume, trace link; deliver select options props-driven: 'none' + 'channel' (channelId + peerKey picker from channels-core when present — optional peer, zero edits here when absent).
- [ ] (S) **4.4 Ship trio** + progress doc.
- [ ] (S) **4.5 (later, gated)** `manage_schedules` registry tool so agents create/pause their own schedules — per-agentDef explicit opt-in only.

### Phase 5 — Workspace ops: usage, cost, caps, audit (slices: `usage-rollups`, `audit-log`)

**Definition of done:** an admin sees per-member and per-model **estimated** cost, sets a monthly USD cap that blocks new calls when exceeded, and reads a filterable 90-day audit trail — the "a company can use this" MVP bar is met end-to-end.

- [ ] (M) **5.1 Rollup write path** — inside `usage.log`: upsert the `(workspaceId, day)` workspaceUsageDaily row incrementing totals + byModel + byUser (OCC retries make concurrent increments safe — same argument as the rateLimits comment; fallback if contended: shard by user, schema-compatible). Thread workspaceId through ALL entrypoints: chat, runAgent, MCP dispatch, /v1, channels, schedules — **a missed entrypoint silently escapes caps; grep-audit the callForUser call sites**.
- [ ] (S) **5.2 modelRates + cost** — daily cron upserts rates from the models.dev catalog we already fetch (`chatProviders.ts`); usage.log adds estCostUsd, counts `unpricedTokens` when no rate (never guess); cache-token pricing skipped until usage logs cache tokens.
- [ ] (S) **5.3 Spend caps** — capUsdPerMonth/capTokensPerDay editor (admin+, `cap.set` audited); `assertUnderCap(ctx, workspaceId)` sums ≤31 daily docs via `by_workspace_day` range, throws a classifyError-friendly code; called at chat send, runAgent, /v1, channel dispatch, schedule run. Precheck-only; UI labels everything "estimated".
- [ ] (S) **5.4 Usage card** — per-member table (byUser), per-model cost, cap progress bar, member sees own rows / admin+ sees workspace via `by_ws_at`.
- [ ] (M) **5.5 audit-log** — auditEvents + `logAudit` + wire ~12 call sites (cred set/delete, member add/role/remove, invite create, agentDef CUD, schedule CUD, token issue/revoke, cap.set, workspace.rename); admin-only Audit card (`usePaginatedQuery`, action-prefix filter pills — extract the filter-pill component, second occurrence); 90-day sweep cron (copy rateLimit.sweep).
- [ ] (S) **5.6 Ship trios** + finalize nav map order: Overview, Chat, Agents, Schedules, Providers, Memory, Channels, Usage, Members(admin), Audit(admin), MCP/API keys, Settings(admin).

### Phase 6 — Deferred wave 2 (build only when the trigger fires — see §8)

- [ ] Vector/hybrid memory recall (trigger: >200 summaries/user or observed bilingual recall misses) — uncomment vectorIndex, embed on write via BYOK text-embedding-3-small, hybrid merge with FTS.
- [ ] Sidecar bridge template + channelOutbox (trigger: someone needs whatsapp-web/Baileys, signal-cli, or Discord gateway) — VPS Node process (Dokploy app), inbound POST to the same httpAction with HMAC, outbound via Convex client subscription.
- [ ] `/v1/responses` (trigger: a real Codex user asks) — 9router responsesHandler shape.
- [ ] Thin CLI `npx @rr/models` (trigger: compat API shipped AND someone asks) — wraps /v1 + 3 REST admin reads.
- [ ] Email invites via sc-resend (trigger: a real team outgrows copy-link).

---

## 6. Per-pillar detail

### 6.1 Workspaces & RBAC

**Authz pattern (the one idiom):**
```ts
// web/convex/_shared/auth.ts
export const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 } as const;
export async function requireWorkspaceRole(ctx, workspaceId, minRole) {
  const userId = await requireUser(ctx);
  const m = await ctx.db.query('memberships')
    .withIndex('by_ws_user', q => q.eq('workspaceId', workspaceId).eq('userId', userId)).unique();
  if (!m || ROLE_RANK[m.role] < ROLE_RANK[minRole]) throw new ConvexError({ code: 'forbidden' });
  return { userId, workspaceId, role: m.role };
}
// + requireWorkspaceRoleAction(ctx, …) → ctx.runQuery(internal.workspaces.checkMembership, …)
```
- Client passes activeWorkspaceId explicitly (validated arg) from `WorkspaceProvider` (persisted `settings.activeWorkspaceId` + localStorage); **server never trusts it** — membership checked per call via `by_ws_user`, so removal = instant total revocation (web, MCP bearers, /v1 keys, channels).
- Role floor rule: 'viewer' for read-only lists; **'member' for anything reaching callForUser** (viewers can never burn shared keys via a crafted client).
- Personal workspace: `ensurePersonal` idempotent on first bootstrap; no solo/team fork anywhere.
- credPolicy read-through (openclaw auth-profile idea): `resolveCred({userId, workspaceId, provider})` — 'personal-first' (default) | 'workspace-first' (nudged for teams) | 'workspace-only' | 'personal-only'. Promote = re-insert ciphertext with workspaceId (upstream OAuth revocation kills the copy — documented). Shared OAuth creds inherit the single-flight `refreshLeaseUntil` lease, now contended by N members — health badge is load-bearing.
- Invites: 32-byte token, sha256 at rest (mcpTokens pattern), link `https://models.rahmanef.com/invite/<token>`, 7-day expiry, role ≤ admin, copy-link only; the link is a bearer secret (Password provider doesn't verify email anyway) — say so in the UI.
- Known risk playbook: step-1.6 two-phase deploy (optional→required arg) because the pre-push hook deploys Convex before the frontend; mixed-workspaceId reads fall back to `by_user_at` until backfill runbook confirms done; WorkspaceProvider self-heals stale activeWorkspaceId on `forbidden`.

### 6.2 Channels

**Webhook URLs** (Convex httpRouter, existing `web/convex/http.ts`):
`https://<deployment>.convex.site/channels/<kind>/<webhookSlug>` — slug is lookup-only; **real auth is always the platform signature**; a channel with a misconfigured secret rejects inbound (never slug-as-auth).

**ChannelAdapter contract** (channels-core, registered in `CHANNEL_REGISTRY` — same pattern as `toolRegistry.ts`):
```ts
interface ChannelAdapter {
  kind: string; chunkLimit: number;
  challenge?(req: Request, ch: ChannelRow, secrets: Record<string,string>): Response | null;
  verify(req: Request, rawBody: string, ch: ChannelRow, secrets: Record<string,string>): Promise<boolean>;
  normalize(body: unknown, ch: ChannelRow): NormalizedInbound[];
  ack?(inbound: NormalizedInbound): Response | null;             // e.g. Discord type-5 deferred
  send(ch, secrets, peer: Peer, msg: { text: string; replyToExternalId?: string }): Promise<{ externalId?: string }>;
  sendTyping?(ch, secrets, peer): Promise<void>;
  register?(ch, secrets, webhookUrl: string): Promise<void>;     // e.g. Telegram setWebhook
  healthcheck?(ch, secrets): Promise<{ ok: boolean; detail?: string }>;
}
type NormalizedInbound = { externalEventId: string;
  peer: { kind: 'dm'|'group'|'channel'; id: string; threadId?: string };
  sender: { id: string; name?: string }; text: string;
  attachments: { type: 'image'|'audio'|'document'; url?: string; mime?: string }[]; at: number };
```

Per-channel verification: Telegram `X-Telegram-Bot-Api-Secret-Token` header · Slack `v0=HMAC-SHA256(signingSecret, ts:body)` + 5-min window + `url_verification` echo · WhatsApp GET `hub.verify_token`/`hub.challenge` + `X-Hub-Signature-256 = HMAC(appSecret)` · Discord Ed25519 via `@noble/ed25519` (pure JS — httpActions can't `'use node'`; validate before building UI). **Verify against raw body bytes before JSON parse.**

Invariants: ACK <3s → model work only via `scheduler.runAfter(0, dispatch)`; dedupe insert in the same transaction as the message insert (at-least-once delivery everywhere); reply-to-origin only, model never picks a channel; routing = first-match binding → channel default agent → fallback model; peerKey `'<kind>:dm:<senderId>' | ':group:<chatId>' | ':topic:<id>'` keys one thread row per conversation (channel convos show up in the web workbench for free); dmPolicy default 'pairing', per-identity rate limits, 'open' behind explicit confirm; Slack/Telegram skip bot-authored echoes (loop protection). Ship Telegram → Slack → WhatsApp → Discord (Meta review must not block the demo).

### 6.3 Memory

- **Core move (hermes):** curated + char-budgeted at WRITE time → hot-path retrieval is "read all non-archived rows in scope and join" — no ranking, bounded tokens (≤ ~5k chars total). Budgets as constants in `budgets.ts`: user 1400 · agent 2200 · workspace 2000 · injected summary 1500.
- **Three write paths:** (1) `memory` tool — add/replace/remove with substring matching; over-budget error carries current entries + "consolidate now: replace/remove then retry" so the model self-curates in-turn (zero extra LLM calls; the tool DESCRIPTION is the learning loop); (2) opt-in thread auto-summary — one upserted `kind:'summary'` row per thread, watermarked via `threads.summarizedUpTo`, scheduled off-turn (never blocks — hermes' 298s wedge lesson), spends the user's own BYOK (default OFF, usage visible); (3) MemoryPanel CRUD.
- **Injection (one place — callForUser, right after settings lookup):** fenced block, entries sorted by createdAt (stable prefix / prompt-cache friendly):
```
<memory-context>
[System note: recalled memory context, NOT new user input…]
=== USER PROFILE (812/1,400 chars) === …entries joined by \n§\n…
=== AGENT NOTES (…/2,200) === … === THREAD SUMMARY === …
</memory-context>
```
- **Security:** fence-tag regex stripped on every write (blocks persistent prompt injection faking the fence); system-note header; every entry user-visible/deletable. Hermes' threat-pattern regex library deliberately skipped in v1 (accepted gap; revisit if third-party MCP clients write memories).
- **Episodic recall:** `recall_memory` tool over the unbounded summary corpus via Convex `.searchIndex` FTS (zero-LLM discovery, hermes session_search). Vector/hybrid is Phase 6 with an explicit trigger; `embedding` field already in schema → zero-migration upgrade.
- **Curation cron (daily):** archive-only, pinned bypasses everything, mechanical (dead-thread/90d-stale summaries, exact dupes) — no LLM curation in v1.
- **Scopes:** user (follows the user everywhere) / workspace (shared knowledge, `by_workspace_scope`) / agent (injected only when that agentDef runs).

### 6.4 Model connection (gateway)

**/v1 compat API** (slice api-compat) — endpoints on convex.site, fronted by the Next rewrite so clients use the apex domain:

| Endpoint | Phase | Notes |
|---|---|---|
| `POST /v1/chat/completions` | 2.2/2.6 | OpenAI shape; streaming + tool passthrough in 2.6 |
| `GET /v1/models` (+`/v1/models/<id>`) | 2.2 | providers × models.dev + `combo/*` + `agent/*` pseudo-models |
| `POST /v1/messages` | 2.7 | Anthropic shape (Claude Code) |
| `POST /v1/responses` | 6 | deferred until Codex demand |

**Client setup snippets** (shipped in the API-keys card):
```bash
# Claude Code
export ANTHROPIC_BASE_URL=https://models.rahmanef.com
export ANTHROPIC_AUTH_TOKEN=sk-rr-…
# Cursor / any OpenAI-compatible
OPENAI_BASE_URL=https://models.rahmanef.com/v1   OPENAI_API_KEY=sk-rr-…
# model field accepts: 'openai/gpt-4o' | 'combo/cheap-fast' | 'agent/<agentDefId>'
```
Auth: `Bearer` or `x-api-key`; sha256 lookup; rate buckets `v1key:` + pre-auth `v1ip:`; keys are workspace-bound, revocable, never grant beyond the owner's role in that workspace; **/v1 never falls back to session auth**. Every request = a normal `callForUser` run (openclaw same-codepath) → memory injection, credPolicy, pool, caps, usage attribution (`source:'api'`, `apiKeyId`) all apply automatically.

**Credential pool** (provider-pool): statuses ok/exhausted/dead (hermes), terminal-auth set → dead verbatim (`invalid_grant`, `token_revoked`, `invalid_token`, …), config-driven rule table (9router ERROR_RULES) with exponential cooldown 1s·2^n cap 4min; fixed priority-then-LRU selection (replaces hermes' 4 strategies + 9router options — zero settings UI); ≤3 attempts per request (caps cost-multiplication of a mis-keyed provider); cooldown badges make failures visible.

**Combos:** `combo/<name>` resolved at the top of callForUser; fallback or sticky round-robin; rotation state on the row (OCC replaces 9router's in-memory Map); `stickyLimit>1` default for round_robin to dampen OCC contention. **Agent-first contract (openclaw):** `agent/<agentDefId>` applies the saved agent's model+instructions+skills+tools — works from /v1, channels, and schedules alike.

**MCP client** (mcp-client): HTTP/SSE only (no stdio — Convex can't spawn processes; the single biggest refusal), per-call connect (documented latency), probe-before-use with toolCache, header secrets encrypted, error text credential-stripped, `mcp__*` tools are agent-surface only (never re-exported on our MCP server — loop guard).

### 6.5 Workspace UX & ops

- **Dashboard IA:** the existing single-page section switcher in `web/app/app` stays; nav array → role-gated lookup map `{id, label, minRole, render}` (dynamic-over-hardcoded + 200-line cap); WorkspaceSwitcher in the header; other slices' sections drop in as one nav entry each. No `/app/[workspace]/[section]` router restructure (deferred polish).
- **Usage & cost:** raw `usage` rows (drill-down) + `workspaceUsageDaily` rollup (9router usageDaily keyed by workspace+day); `modelRates` daily snapshot from the models.dev catalog we already fetch → `estCostUsd` at log time (hermes per-million rates, `unpricedTokens` instead of guessing); labeled "estimated" everywhere.
- **Spend caps:** advisory BYOK guardrails, NOT billing — monthly USD + daily tokens on the workspaces row, `assertUnderCap` precheck (≤31-doc range read) at every spend entrypoint; no mid-stream enforcement; single huge run can overshoot (accepted).
- **Scheduled agents:** hermes cron shape (kinds once/interval/daily, nextRunAt, deliver, consecutive-error auto-pause) on one minute-tick Convex cron; OCC claim = advance nextRunAt (refreshLeaseUntil trick); self-healing after downtime (overdue = `lte now`); runs land in existing agentRuns (trace viewer free); 'once' soft-disables (openclaw auto-delete idea, but history kept); deliver via channels peerKey addressing; safety stack for unattended BYOK burn = maxSteps clamp + auto-pause@5 + daily token cap + default-daily cadence.
- **Audit:** append-only auditEvents, `logAudit` inside ~12 mutations, summaries never contain secret material, admin-only paginated card with filter pills, 90-day sweep (crons.ts pattern). No export/webhook/SIEM.
- **Surfaces answer:** web + /v1 compat + MCP server ARE the surfaces. No new CLI/TUI/desktop from this plan (hermes/openclaw ship CLIs because their CLI is the runtime; ours would be a thin HTTP client with no urgency).

### 6.6 Env & config (complete list — deliberately near-zero new env)

| Var / config | Where | Notes |
|---|---|---|
| `MODELS_ENC_KEY` | Convex env (existing) | ONE AES-256-GCM master key — reused for BYOK creds, channel secrets, MCP headers. No per-tenant KMS. |
| `NEXT_PUBLIC_CONVEX_URL` / `CONVEX_SITE_URL` | existing | convex.site base for /v1, /channels, /mcp, OAuth callbacks. |
| Next rewrite `/v1/:path*` → `<CONVEX_SITE_URL>/v1/:path*` | `web/next.config` | makes `models.rahmanef.com/v1` the client-facing base. |
| Channel webhook URL | per channel row | `https://<deployment>.convex.site/channels/<kind>/<webhookSlug>` — Telegram auto-set via register(); Slack/Meta/Discord pasted into their consoles. |
| Invite link | generated | `https://models.rahmanef.com/invite/<token>` — bearer secret, 7d. |
| API key format | generated | `sk-rr-<43ch base64url>`, sha256 at rest, shown once. |
| Per-channel secrets | encrypted rows, NOT env | botToken / signingSecret / appSecret / verifyToken / publicKey / phoneNumberId — all in `secretCiphertext`. |
| NEW server env vars | — | **none.** All secrets are user-supplied BYOK or per-row ciphertext. Slices' `slice.json env: []` stays honest. |

---

## 7. STEAL FROM appendix

| Idea | Source | Our slice |
|---|---|---|
| Auth-profile read-through (fallback order personal⇄shared; don't clone OAuth refresh semantics) | openclaw `docs/concepts/multi-agent.md` | byok v0.2 (`credPolicy`, promote) |
| Agent = full per-persona isolation scope, single tenant key on everything | openclaw same doc (`~/.openclaw/agents/<id>/`) | workspaces (workspaceId on every table) |
| Isolated per-profile state roots + discoverable profile list; read-only cross-profile aggregation | hermes `hermes_constants.py:121-144`, `hermes_state.py:410-417` | workspaces (`by_user` switcher; super-admin read-only stats) |
| Hash-only token storage, raw shown once | OUR `web/convex/mcp.ts:9-18` + schema mcpTokens | workspaces (invites), api-compat (apiKeys) |
| Deterministic reply-to-origin + first-match binding ladder (model never picks a channel) | openclaw `docs/channels/channel-routing.md` | channels-core (dispatch, routing) |
| Session-key shape `<channel>:group:<id>:thread:<t>` | openclaw channel-routing.md | channels-core (`threads.peerKey`) |
| DM pairing: 8-char no-0O1I codes, 1h expiry, 3-pending cap, message dropped until approved | openclaw `docs/channels/pairing.md` | channels-core (channelIdentities) |
| ACK fast, process async (webhook → scheduler) | openclaw `docs/channels/telegram.md` L867-874 | channels-core (ingress split) |
| Bot-loop protection (skip own/bot echoes) | openclaw `docs/channels/bot-loop-protection.md` | channel-slack, channel-telegram |
| Sidecar bridge contract (POST inbound / outbox outbound / chunk delay) | hermes `scripts/whatsapp-bridge/bridge.js` | Phase 6 bridge template (design-only) |
| Adapter method surface (send/sendTyping/lifecycle) | hermes `plugins/platforms/discord/adapter.py` | channels-core (ChannelAdapter, trimmed) |
| Registry-of-implementations | OUR `web/convex/toolRegistry.ts` | channels-core (CHANNEL_REGISTRY) |
| Char-budgeted curated memory + "consolidate now" back-pressure error | hermes `tools/memory_tool.py:297-347` | memory (budgets.ts, crud.ts) |
| Proactive-save guidance living in the TOOL DESCRIPTION (zero-cost extraction) | hermes memory_tool MEMORY_SCHEMA L659-708 | memory (`memory` tool registration) |
| Fenced `<memory-context>` + "NOT new user input" note + fence-strip on write | hermes `agent/memory_manager.py:51-249` | memory (inject.ts) |
| Substring replace/remove with ambiguity previews (no IDs to the model) | hermes memory_tool L349-448 | memory (crud.ts) |
| Zero-LLM FTS episodic discovery | hermes `tools/session_search_tool.py` | memory (`recall_memory`, searchIndex) |
| Post-turn memory work never blocks the turn (298s wedge) | hermes memory_manager.sync_all | memory (scheduler summarize) |
| Archive-only curation, pinned bypasses | hermes `agent/curator.py` | memory (curation cron) |
| Config-driven error rules + exponential cooldown | 9router `/app/open-sse/services/accountFallback.js` | provider-pool (fallbackRules.ts) |
| Credential statuses ok/exhausted/dead + terminal-auth reason set | hermes `agent/credential_pool.py` | provider-pool |
| Combos: fallback + sticky round-robin | 9router `/app/open-sse/services/combo.js` | combos (rotation on-row, OCC) |
| Inbound API keys + per-key usage attribution | 9router `/app/src/lib/db/migrate.js:177` | api-compat (apiKeys, usage.apiKeyId) |
| Translator = stateless pure functions per format | 9router `/app/open-sse/translator/formats/*` | api-compat (translators/anthropic.ts) |
| `/v1` endpoint set + agent-as-model contract + same-codepath principle | openclaw `docs/gateway/openai-http-api.md` | api-compat (`agent/<id>`), callForUser |
| MCP server defs + probe-before-use | openclaw `docs/cli/mcp.md` | mcp-client (probe, toolCache) |
| MCP per-server config + credential-stripping in errors | hermes `tools/mcp_tool.py` | mcp-client |
| Daily usage rollup row alongside raw log | 9router migrate.js:191 (usageDaily) | usage-rollups (workspaceUsageDaily) |
| Per-million pricing with cache tiers + zero-cost fallback for unknown models | hermes `agent/usage_pricing.py:12,58-62` | usage-rollups (modelRates, unpricedTokens) |
| Cron job shape (kinds, next_run_at, deliver, auto-pause) + single tick loop | hermes `cron/jobs.py:214-417`, `cron/scheduler.py:2016` | scheduled-agents |
| One-shot soft-disable, tick-take stagger, unified run ledger, skip cron-expr (DOM/DOW footgun) | openclaw `docs/automation/cron-jobs.md` | scheduled-agents |
| Agent-managed schedules via tools (with prompt scanning) | hermes `tools/cronjob_tools.py:213` | scheduled-agents 4.5 (gated) |
| OCC read-modify-write (rateLimits comment), refreshLeaseUntil single-flight, crons sweep, agentName denormalization | OUR OWN codebase | rollup upserts · tick claim · audit sweep · agentSchedules |
| Multi-tenant isolation itself | 9router has none (comparison doc line 158: "unique to us") | the whole plan — this is the moat |

---

## 8. NON-GOALS / deferred (ponytail YAGNI)

Everything here is a deliberate cut with a re-entry trigger. The tenancy key (`workspaceId`) and forward-compat field slots land NOW, so none of these ever touch the schema spine again.

**Tenancy / RBAC**
- No email invite delivery (copy-link covers founder-invites-3-people; trigger: a real team asks → sc-resend).
- No granular permissions matrix (per-tool/per-provider grants) — 4 fixed roles + rank map; hermes/openclaw ship without one. `agentDefs.visibility` reserves the future per-workspace tool-allowlist hook.
- No shared/collab threads (workspaceId + reserved visibility only; sharing is a later pillar).
- No personal→team workspace converter, no per-workspace encryption keys (one MODELS_ENC_KEY), no org-above-workspace nesting, no seats, no renaming existing userId columns (they stay as attribution).

**Channels**
- No sidecar channels wave 1 (whatsapp-web/Baileys, signal-cli, iMessage, Discord gateway) and no channelOutbox table until then.
- No long-polling mode, no streaming/edit-as-you-generate replies, no media out / vision in (attachments = metadata only; modalities are a future pillar), no multi-account-per-channel (want 2 bots → 2 rows), no broadcast/multi-agent per peer, no voice.

**Memory**
- No vectors/embeddings at launch (budgeted store injects whole; trigger: >200 summaries/user or bilingual recall misses — field already in schema, zero migration).
- No post-turn LLM fact-extraction observer (tool description does it free), no MemoryProvider abstraction (one backend), no LLM-driven curation, no threat-pattern regex library (accepted gap until third-party MCP writes are common).

**Model gateway**
- No stdio MCP transport (Convex can't spawn processes — the biggest refusal), no MCP sampling/parallel-call opt-ins/outbound OAuth login, no pool-strategy config (fixed priority-then-LRU), no capability-based combo reordering (text-only), no `/v1/embeddings`/images/tts/stt, `/v1/responses` last and demand-gated, no per-key scopes/expiry (revoke + rate-limit suffices), no new router hub (every endpoint ≤200-line shim over callForUser).

**Ops / UX**
- No cron-expression schedules (interval/daily/once ≈ 95%; croner DOM/DOW footgun avoided; 'cron' kind is a pure extension later).
- No billing/Stripe/seats — caps are advisory BYOK guardrails, not metering (sc-stripe stays a stub).
- No mid-stream budget enforcement, per-member quotas, or budget alerts (byUser map makes per-member a query away when needed).
- No audit export/webhook/SIEM, no cache-token pricing until usage logs cache tokens ("estimated" label over fake precision).
- No CLI until /v1 ships and someone asks; no TUI/desktop ever from this plan; no deep-link router restructure of the dashboard.

---

*Every proposed change above honors: `requireWorkspaceRole` server-side authz on every mutation · args validators on all public functions · `.withIndex`/`.take` (no bare `.collect()`) · 200-line file cap via single-purpose feature files · slices + metadata trio + props-driven portability · shadcn/theme tokens for all new UI · conventional commits, push direct to main, Dokploy auto-deploy.*
