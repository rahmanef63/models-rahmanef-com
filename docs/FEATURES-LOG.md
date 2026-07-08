# FEATURES LOG — models.rahmanef.com

Shipped inventory, moved out of `MASTER-PLAN.md` §5 (the plan keeps the design:
§3 data model, §6 per-pillar detail, §7 steal-from, §8 non-goals).

**Verified against code 2026-07-08** (5-agent per-phase audit vs actual `web/convex` +
`web/frontend/slices`). Ship date **2026-07-04** unless noted. Legend: ✅ confirmed in
code · 🟡 shipped but narrower than the plan text (v0.1 scope) · see the v0.2 backlog for
the deltas.

The app is a working **v0.1** across all five phases: workspace tenancy, BYOK model
gateway (`/v1` OpenAI + Anthropic), memory, four inbound channels, scheduled agents, and
usage/caps/audit. The 🟡 items are documented-narrow scope, not regressions.

---

## Phase 1 — Workspaces (tenant boundary)

- ✅ **1.1** Schema spine — `workspaces`/`memberships`/`invites` + `workspaceId` retrofits on modelCreds/usage/threads/agentDefs/agentRuns/mcpTokens/settings + indexes (`features/workspaces/tables.ts`, `schema.ts`).
- ✅ **1.2** Authz core — `ROLE_RANK` + `requireWorkspaceRole` + action twin (`_shared/auth.ts`).
- ✅ **1.3** Workspace fns — ensurePersonal/myWorkspaces/create/rename/remove/listMembers/updateRole/removeMember/leave/transferOwnership (owner immutable, owner-only admin role changes; `transferOwnership` hands off owner→admin, promotes the target).
- ✅ **1.4** Frontend — `WorkspaceProvider` + switcher, self-heal on `forbidden`.
- ⏭️ **1.5** Backfill — deliberately SKIPPED (personal reads stay `by_user`; no prod migration).
- ✅ **1.6** Scope retrofit — spend paths require `'member'` (viewers never reach `callForUser`); reads stay creator-private `by_user`.
- 🟡 **1.7** BYOK shared creds — **READ half only**: `resolveCred` honors `credPolicy`, team-create nudges `workspace-first`. Write half (promote / Workspace-tab paste) unbuilt → workspace-shared creds can't be created yet. *(v0.2)*
- ✅ **1.8** Invites — 32-byte token, sha256 at rest, raw shown once, `/invite/[token]` accept flow.
- ✅ **1.9** MCP workspace binding — token issue takes workspaceId; per-call `checkMembership` (revocation works). *(minor: per-call check asserts membership, not `≥member`)*
- ✅ **1.10** `workspaces` slice trio. *(minor: `byok` slice still tagged 0.1.0, no optional `workspaces` peer)*

## Phase 2 — Model gateway + memory

- ✅ **2.1** API keys — `sk-rr-…` + b64url(32B), sha256 at rest, shown once, workspace-bound; issue/list/revoke + card.
- 🟡 **2.2** `/v1` non-streaming + pseudo-stream — Bearer/x-api-key auth, rate buckets, OpenAI + `/v1/models`. *(v0.2: `/v1/models` omits `combo/*`+`agent/*` pseudo-models; usage rows lack `source:'api'`/`apiKeyId`; internal errors map to 400 not 500)*
- ✅ **2.3** provider-pool — pool fields, `fallbackRules` (429 exp-backoff / 5xx cooldown / 402 quota→failover to next pooled cred + 240s cooldown / terminal→dead), `pickCredentials` priority-then-LRU, ≤3-attempt loop in `callForUser`.
- 🟡 **2.4** combos — table + CRUD + `combo/`+`agent/` prefix resolution + `round_robin` rotation (`resolveCombo` returns the comboId, `callForUser` calls `bumpRotation` after each pick). *(v0.2: fallback returns `refs[0]` only)*
- ✅ **2.5** mcp-client — `@modelcontextprotocol/sdk`, SSRF-guarded, secret-redacted errors, `mcp__*` merged into gateway tools (agent-surface only), probe + toolCache.
- ⬜ **2.6** `/v1` real streaming + **tool passthrough** — **unbuilt**. Client `tools`/`tool_choice` dropped; messages flattened to strings; no `callForUserRaw`. Blocks external agent tool-loops via `/v1`. *(v0.2 — see backlog)*
- ✅ **2.7** Anthropic `/v1/messages` translator — Claude Code (`ANTHROPIC_BASE_URL` + `sk-rr-…`) works; full SSE shape.
- 🟡 **2.8** memory schema + CRUD — budgets (1400/2000/2200/1500), dup-reject, fence-strip, remove+ambiguity. *(v0.2: no `replace` op; over-budget returns plain string not `{error,currentEntries}`; 60-char preview vs 80)*
- 🟡 **2.9** memory injection + tools — fenced block + header, wired in `callForUser`, `recall_memory` FTS. *(v0.2: `_buildContext` injects user+workspace scope only — agent-scope + thread-summary rows never injected; recall bumps unwritten)*
- ✅ **2.10** memory auto-summarize + panel + curation cron — opt-in, off-turn, BYOK, budget bars, archive-only daily cron.
- ✅ **2.11** slice trios (api-compat, provider-pool, combos, mcp-client, memory).

## Phase 3 — Channels

- 🟡 **3.1** Schema — `channels`/`channelIdentities`/`channelEvents` shipped; sender→thread via `channelIdentities.threadId` (threads has no `channelId`/`peerKey` — works differently than the plan's peerKey design).
- 🟡 **3.2** Contract — adapters are plain per-file modules + per-kind branches in the route; no `ChannelAdapter` interface / `CHANNEL_REGISTRY` artifact. Functionally fine.
- ✅ **3.3** Ingress — Next route `channels/[kind]/[slug]`, raw-bytes-before-parse sig verify, dedupe-insert in-txn, model deferred via scheduler, WhatsApp GET handshake.
- 🟡 **3.4** Access policy — pairing-codes redesigned into open/allowlist policy (`channelsAccess.ts`); no 8-char code / `mention` group policy.
- 🟡 **3.5** Dispatch — loads history + resolves agent + `callForUser` (caps apply) + chunked send. *(v0.2: `.take(20)` not 30, no routing first-match, no `source:'channel'` tag, no per-chunk delay)*
- 🟡 **3.6** Telegram — token verify, chunk 4096, setWebhook, connect UI. *(v0.2: no forum-topic `:topic:` normalize, no sendChatAction)*
- 🟡 **3.7** Channels admin UI — list + health + create wizard + agent bind + allowlist inbox. *(v0.2: no routing editor / pending inbox / oauth-model filter / `open` explicit-confirm)*
- ✅ **3.8** Slack — url_verification echo, v0 HMAC 5-min window, event_id dedupe, bot_id skip, thread_ts.
- 🟡 **3.9** WhatsApp — hub handshake, X-Hub-Signature-256, graph send, errors→lastError. *(v0.2: no Meta setup README)*
- ⬜ **3.10** Discord — **broken on realistic latency**: uses type-4 inline reply, not type-5 deferred ack + follow-up webhook → a full LLM turn can miss Discord's 3s window ("app did not respond"). No `/ask` registration. *(v0.2 — see backlog)*
- 🟡 **3.11** Housekeeping cron — `channelEvents` >48h pruned (12h cron); pending-identity prune moot (pairing redesigned away).
- 🟡 **3.12** Ship — ONE consolidated `channels` slice trio (not five separate). All files ≤200 lines.

## Phase 4 — Scheduled agents

- 🟡 **4.1** Table + CRUD + tick — CRUD (`member`) + OCC single-flight claim, **5-min sweep** over `everyMinutes` (15-min floor). *(v0.2: no `computeNextRun`/once/daily-tz/DST — interval-only, honestly documented v0.1 in the manifest)*
- ⬜ **4.2** runForSchedule — runs the agent via `callForUser` (caps + pool apply), records last status/result. **Missing**: no `agentRuns` trace row → scheduled runs invisible in the trace viewer; no `consecutiveErrors`/auto-pause-at-5; no `source:'schedule'` tag. *(v0.2 — see backlog)*
- 🟡 **4.3** Schedules UI — agent + prompt + interval + pause/resume + last-status. *(v0.2: no cadence radio / next-run countdown / trace link / deliver-to-channel picker)*
- ✅ **4.4** Slice trio (manifest honestly scopes v0.1).
- ⏭️ **4.5** `manage_schedules` agent tool — deferred (gated).

## Phase 5 — Workspace ops (usage · cost · caps · audit)

- 🟡 **5.1** Rollup — `workspaceUsageDaily` via a **6h cron** (not inline `usage.log` upsert); no `byUser` field.
- 🟡 **5.2** Cost — static rates map (ponytail-commented), no models.dev rates cron; `estCostUsd` computed at rollup, not at log time.
- ✅ **5.3** Spend caps — monthly USD cap, `checkSpendCap` precheck (**fails closed on read truncation** — was silently undercounting → under-enforcing; `truncated` flag now surfaced in `SpendCapCard`). **Cap-bypass in `runAgent` fixed 2026-07-05** (it called `generateText` directly, skipping the guard). *(minor: `setSpendCap` not yet audited)*
- 🟡 **5.4** Usage card — per-workspace per-day/model table (viewer-gated, not a cross-tenant leak). *(v0.2: no per-member breakdown — needs `byUser` from 5.1)*
- 🟡 **5.5** audit-log — `auditEvents` table + prune cron + card; 5 reachable call sites wired (role_changed, removed, member.left, invite.accepted, workspace.ownership_transferred) + cred.deleted latent (shared-cred only, until a shared-cred WRITE path ships), no `logAudit` helper, non-paginated card. *(v0.2)*
- 🟡 **5.6** Slice trios + nav. *(minor: nav order differs from spec; Members/Audit buttons rely on card self-gating)*

## Dashboard shell + graph (shipped 2026-07-08)

- ✅ **App-shell** — `page.tsx` is now a thin ~156-line shell (was a 1200-line monolith): 72px icon `NavigationRail` + secondary sidebar (sub-sections of the active group) + optional docked AI dock + light/dark theme toggle + inline section switch.
- ✅ **Mobile dock** — CareerPack-style bottom-nav: 3 primary group tabs + center AI FAB + "More" overflow sheet (quick-create + all sub-sections + theme toggle + sign-out); replaces the old crude <640px rail-flip, restores a mobile AI entry point.
- ✅ **memory-graph slice** — `frontend/slices/memory-graph` (v0.2.0): Obsidian-style force-directed graph over memories + agents + built-in skills + tools with agent→skill/tool cross-links; pan/zoom/drag + force sim + filters + node inspector + `@/[Title]` node-linking via MD/JSON import + add-memory dock. Portable `<MemoryGraph>` renderer (Convex-free) + wired `<MemoryGraphPanel>` adapter over existing memory/agentDefs queries; scoped `<style>`; NO new Convex table/fn. Full metadata trio.
- ✅ **audit.md** — repo-root best-practice + CRUD compliance scorecard for all 20 features (20 auditors + 1 critic).

---

## v0.2 backlog — verified gaps in shipped slices

Real deltas between the plan text and the code. None block v0.1 use; each is a scoped follow-up.

| # | Slice | Gap | Impact |
|---|---|---|---|
| 2.6 | api-compat | `/v1` tool passthrough (client `tools`→execute-less→return `tool_calls`) + real streaming | external agent tool-loops via `/v1` don't work |
| 3.10 | channels | Discord type-5 deferred ack + follow-up webhook + `/ask` reg | Discord replies fail on realistic latency |
| 1.7 | byok | shared-cred WRITE (promote / workspace-tab paste) | teams can't share a provider key yet |
| 4.2 | scheduled-agents | `agentRuns` trace row + `consecutiveErrors` auto-pause + `source:'schedule'` | scheduled runs invisible in trace; failing schedule not auto-paused |
| 4.3 | scheduled-agents | cadence radio + next-run countdown + deliver-to-channel picker | can't deliver schedule output to a channel |
| 5.4 | usage-rollups | `byUser` in rollup + per-member usage table | no per-member cost view |
| 2.4 | combos | fallback ref iteration (`round_robin` rotation ✅ shipped) | fallback still returns `refs[0]` only |
| 2.9 | memory | inject agent-scope + thread-summary rows; write recall bumps | agent memories + auto-summaries never reach the model |
| 2.2/3.5 | api-compat/channels | thread `source` tag (`api`/`channel`/`schedule`) through `usage.log` | usage attribution by surface missing |
| 5.5 | audit-log | remaining audit sites + `logAudit` helper + paginate card (member.left/invite.accepted/cred.deleted now wired) | thinner audit trail |
| 2.8 | memory | `replace` op + structured over-budget error | memory self-curation weaker than hermes spec |

## Deferred (trigger-gated) — unchanged, see MASTER-PLAN §8

Vector/hybrid memory recall · sidecar channel bridge (whatsapp-web/Baileys/signal) ·
`/v1/responses` · thin CLI · email invites. All wait on an explicit trigger.
