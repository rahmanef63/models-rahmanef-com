# Feature Audit — models.rahmanef.com

> Best-practice + CRUD compliance scorecard for **every feature**. Produced by a 20-auditor + 1-critic pass (2026-07-07). Each auditor read the feature's source and cited `file:line` evidence; a skeptical critic then re-checked the scores for inflation.
>
> **Scope:** this file scores *quality & rule-compliance* (CRUD completeness, Convex rules, rr conventions, UI rules, security). It complements — does not replace — `docs/FEATURES-LOG.md` (verified shipped scope) and `docs/AI-SLICES-PROGRESS.md` (rr-parity coverage %).
>
> **Rubric:** CRUD completeness · rr conventions (trio/version, barrel-only imports, ≤200-line files, SRP) · Convex rules (args validators, no bare `.collect()`, in-handler authz, `.withIndex`) · UI rules (shadcn, theme tokens, responsive) · security & portability. Grades: A ≥90 · B 80–89 · C 70–79 · D 60–69 · F &lt;60.

## Progress

**All 20/20 features audited ✅** · avg **85.5/100** · as-audited 1×A 19×B (critic revises api-compat A→B, audit-log B→C ⇒ effective **19×B 1×C**) · **1 HIGH + 31 MED** critiques open.

- [x] workspaces
- [x] byok
- [x] api-compat
- [x] memory
- [x] memory-graph
- [x] combos
- [x] mcp-client
- [x] audit-log
- [x] channels
- [x] scheduled-agents
- [x] usage-rollups
- [x] provider-pool
- [x] spend-caps
- [x] ai-chat
- [x] ai-agents
- [x] mcp-server-inbound
- [x] ai-admin
- [x] skills-tools-registry
- [x] auth-oauth
- [x] dashboard-shell

## Scoreboard

CRUD legend: ✓ full · ◐ partial · ✗ missing · – n/a.

| # | Feature | Score | Grade | C | R | U | D | Bottom line |
|---|---|:---:|:---:|:-:|:-:|:-:|:-:|---|
| 1 | [api-compat](#api-compat) | 90 → **88** | A → **B** | ✓ | ✓ | – | ✓ | Tight, security-first gateway slice: complete-for-shape CRUD, full Convex validator/authz/index compliance, strong key hygiene, and clean portability — only low |
| 2 | [ai-chat](#ai-chat) | 89 | B | ✓ | ✓ | ◐ | ✓ | Exemplary Convex backend (validators, indexing, authz, spend-caps, modularity all clean); dinged only by a partial thread-Update, a dangling-user-message edge c |
| 3 | [mcp-client](#mcp-client) | 88 | B | ✓ | ✓ | ◐ | ✓ | Clean, security-forward external-MCP slice — full trio, airtight Convex validation/authz/encryption and thoughtful SSRF+redaction+loop guards; held back from an |
| 4 | [spend-caps](#spend-caps) | 88 | B | ✓ | ✓ | ✓ | ✓ | Tight, correctly-scoped enforcement slice — reuses an existing field, actually wires the cap into the model hot path, and passes every Convex rule; docked mainl |
| 5 | [workspaces](#workspaces) | 87 | B | ✓ | ✓ | ✓ | ✓ | Excellent Convex/RBAC/invite core with full CRUD and zero validator/collect/authz violations; docked to a B by one real functional dead-end (no transferOwnershi |
| 6 | [byok](#byok) | 87 | B | ✓ | ✓ | ◐ | ✓ | Clean, security-minded BYOK slice: encryption + tenant derivation + validators + trio are textbook; deductions are a latent .unique()/.first() inconsistency, an |
| 7 | [memory](#memory) | 87 | B | ✓ | ✓ | ✓ | ✓ | Strong, well-wired slice: complete CRUD (archive-only by design), textbook Convex hygiene, and injection-hardened — docked mainly for a stale barrel version, de |
| 8 | [scheduled-agents](#scheduled-agents) | 87 | B | ✓ | ✓ | ◐ | ✓ | Tight, secure, well-documented cron slice — Convex rules fully honored and files tiny; held to B by toggle-only Update (no cadence edit), raw-HTML UI (project b |
| 9 | [memory-graph](#memory-graph) | 86 | B | ✓ | ✓ | ◐ | ✓ | Strong, highly-modular, genuinely portable frontend slice — trio + version + barrel + file-cap all green; main real gap is that the 'add child' UI promises a me |
| 10 | [channels](#channels) | 86 | B | ✓ | ✓ | ◐ | ✓ | Backend is A-grade (flawless Convex compliance + strong crypto/abuse defense); dinged to a solid B by a missing cascade-delete, a setModel path that's implement |
| 11 | [mcp-server-inbound](#mcp-server-inbound) | 85 | B | ✓ | ✓ | ◐ | ◐ | Security-first, tightly-scoped MCP inbound layer that nails the hard parts (hashed secrets, PKCE, correct IP trust, per-call workspace re-check) — dinged only b |
| 12 | [skills-tools-registry](#skills-tools-registry) | 85 | B | – | ✓ | – | – | Clean, well-factored cross-cutting registry — single source of truth for both tool surfaces, tiny files, upstream authz correct; main ding is that the declared  |
| 13 | [auth-oauth](#auth-oauth) | 85 | B | ✓ | ✓ | ✓ | ◐ | Clean, secure, convention-abiding OAuth/BYOK-connect layer — validators, per-action requireUser, encrypted-at-rest tokens, all indexed, no bare collects; docked |
| 14 | [dashboard-shell](#dashboard-shell) | 85 | B | – | – | – | – | A clean, well-decomposed, token-themed app shell that honors the file-size cap and barrel-import rules and has strong a11y; held back from an A by client-only n |
| 15 | [usage-rollups](#usage-rollups) | 84 | B | ✓ | ✓ | ✓ | ✗ | Clean, well-bounded ponytail-style slice — Convex rules fully honored (validators, no bare collect, indexed, correct authz layering) and trio complete; docked m |
| 16 | [ai-agents](#ai-agents) | 84 | B | ✓ | ✓ | ◐ | ◐ | Careful, ownership-tight backend with full CRUD on agent configs; B-grade dinged by two unbounded .collect()s, no delete/retention for run history, and a worksp |
| 17 | [provider-pool](#provider-pool) | 83 | B | – | ✓ | ◐ | – | Clean, small, well-tested failover ENGINE (429/5xx/dead all fail over correctly); dinged for a 402/quota case that aborts instead of failing over — the core mul |
| 18 | [ai-admin](#ai-admin) | 83 | B | – | ✓ | – | – | Clean, simple, correctly-gated read-only operator console that nails Convex authz + validators + no-bare-collect; the one real flaw is aggregate totals silently |
| 19 | [combos](#combos) | 81 | B | ✓ | ✓ | ◐ | ✓ | Clean, rr-compliant, well-scoped slice with textbook Convex authz/validation — but round_robin is a silent no-op (bumpRotation never called) and update is thin  |
| 20 | [audit-log](#audit-log) | 80 → **76** | B → **C** | ✓ | ✓ | – | ◐ | Well-engineered append-only slice (clean Convex, matched trio, transaction-local writes) that under-delivers on its own advertised scope — only 2 of ~5 claimed  |

_Scores with → were revised down by the critic (see below)._

## Portfolio review (skeptical critic)

Backend Convex hygiene is the portfolio's real strength and is scored honestly: args-validators, in-handler requireUser/requireWorkspaceRole/requireAdmin, and .withIndex usage are uniformly high and well-evidenced with line numbers across ~all slices. Strongest: ai-chat (89) plus the Convex/RBAC cores (workspaces, byok, channels, spend-caps). Weakest: audit-log — a security/compliance feature that misrepresents its own coverage (only 2 of ~5 claimed events actually insert rows, verified) — and the recurring 'advertised-but-unwired' cluster. Systemic pattern: uniform backend compliance masks a repeated gap between what a slice ADVERTISES (schema fields, error strings, manifest notes, UI copy) and what it IMPLEMENTS. Scoring is internally consistent on the Convex/rr axes but slightly lenient on functional dead-ends: they are repeatedly logged as 'med' even when they defeat the feature's core value prop (combos round_robin no-op, provider-pool 402 not failing over, channels setModel never wired). Grade spread is compressed — 19 of 20 land 80-90 (all B) with a single A (api-compat, 90) that is not clearly the best in class; recommend nudging api-compat into the B band and dropping audit-log below the pack so the numeric spread reflects real risk. No strong deflation cases found; combos (81) reads slightly harsh but its manifest openly advertises a strategy that is a verified no-op, so the dock is defensible.

### Score adjustments

| Feature | From | To | Why |
|---|:-:|:-:|---|
| api-compat | 90 | 88 | Sole A in the set but carries an authz-generosity gap (any member mints a durable workspace-spend credential; arguably admin-only) plus a verified take(50)-then-filter that silently hides active keys past 50, and a root-file structural deviation from the vertical-slice rule. Not clearly above the 'exemplary' ai-chat (89); belongs at the top of the B band, not alone in A. |
| audit-log | 80 | 76 | Verified HIGH: a security/compliance feature whose UI copy and manifest claim cred.deleted / invite.accepted / member.left are audited, but only member.role_changed and member.removed insert rows (auditEvents written at just workspaces.ts:123,136). Misrepresenting security coverage is a trust hazard that should sit clearly below the B pack, not one point under a clean slice like combos. |

### Cross-cutting gaps (no single feature owns these)

- No shared table-retention/GC convention: crons prune only rateLimits, memory, channelEvents, and audit — but workspaceUsageDaily, the raw usage log, agentRuns, mcpAuthCodes, mcpClients, oauthFlows, and orphaned channelIdentities/threads/messages (channels has no cascade delete) all grow unbounded. No feature owns lifecycle policy; each slice re-decides ad hoc.
- Ad-hoc silent read truncation with no overflow signal: take(50)/(500)/(2000)/(4000)/(10000) are chosen per-feature and the ones that truncate silently are the billing/spend/security surfaces — api-compat hides active keys, spend-caps under-enforces the cap, ai-admin freezes totals. No shared paginate/aggregate helper and no 'capped' flag convention.
- 'Advertised != implemented' is systemic: schema fields, error strings, manifest notes, and UI copy promise capabilities no code ships — transferOwnership (workspaces), round_robin/bumpRotation (combos), channelsCore.setModel wiring (channels), 3 of 5 audit hooks (audit-log), pool priority/label (provider-pool), memory 'agent' scope + recall columns, agentDefs workspace visibility, CredStatusBadge dead UI (provider-pool). No owner keeps the advertised surface equal to the shipped surface.
- The 'no bare .collect()' rr rule is quietly violated in byok (credentials.ts:26,36), ai-agents (agentDefs.ts:63,149), and mcp-server-inbound (mcp.ts:32,53) — 6 verified sites, all per-user-scoped so 'bounded in practice' but unbounded by rule. There is no lint/audit gate enforcing it, so the drift spreads.
- Spend-control safety falls between features with no end-to-end owner: provider-pool's 402/quota aborts instead of failing over, spend-caps' take(4000) undercounts and under-enforces, and api-compat lets members mint unbounded-lifetime spend keys. Each is 'low/med' locally but together they leave real holes at the seams of the platform's core value prop.
- Type-safety escape hatches at the Convex Id client boundary ('as never' / 'as any') recur across ~8 slices (workspaces, byok, api-compat, memory-graph, audit-log, mcp-client, usage-rollups, mcp-server-inbound). No shared typed-Id helper for the query/mutation call boundary, so strict TS is defeated exactly where crafted-client input arrives.
- App-wide UI baseline (no shadcn primitives, raw button/input/select, native confirm/prompt/alert, desktop-first CSS inverted from the mobile-first rule) is documented/tracked but is a genuine portability/lift blocker spanning every slice and owned by no single feature.

### Per-feature flags

- **api-compat** — Authz too generous: issueApiKey gates on 'member' (verified apiKeys.ts:17), so any member mints a durable sk-rr key that spends workspace provider creds indefinitely — a lasting spend credential should require admin. Also listApiKeys take(50)-then-filter-revoked hides active keys once &gt;50 keys accumulate. These undercut the sole A grade.
- **audit-log** — CRUD 'create: yes' overstates reality: auditEvents is inserted at only 2 sites (workspaces.ts:123,136 — member.role_changed/removed). cred.deleted, invite.accepted, member.left insert nothing (verified), yet UI copy + manifest claim they are audited. audit.record internalMutation has zero callers (dead). HIGH is real for a security feature.
- **provider-pool** — CRUD 'update: complete' is generous — pool config (label/priority) is read by pickCredentials but no mutation ever writes it, so ordering is always default LRU. 402/quota aborts instead of failing to the next key (bumpRotation-adjacent) — the exact case a multi-key pool exists for.
- **combos** — round_robin is a verified silent no-op (bumpRotation defined at combos.ts:92, zero callers) yet the manifest advertises it as advanced by bumpRotation. Update 'partial' is generous: renameCombo is unwired in the UI, so client-side update is effectively none.
- **channels** — setModel mutation is never called from any frontend file (verified — all setModel hits are React useState setters), so a no-agent channel can never get a fallback model and permanently returns 'not configured'. deleteChannel orphans channelIdentities/threads/messages with no cascade.
- **memory** — lastRecalledAt/recallCount are declared but never written; curation staleness keys off updatedAt/createdAt instead, so actively-recalled summaries get archived at 90d despite use. Advertised 'agent' scope has no read/write path. One of its two 'med' flags (stale barrel comment) is cosmetic and shouldn't offset the real curation bug.
- **ai-agents** — CRUD update/delete 'partial' hides that agentDefs visibility/workspaceId/by_ws are in schema but unwired — a 'workspace'-shared agent is unreachable by any member. agentRuns has no delete/retention. Two bare .collect() (agentDefs.ts:63,149, verified).
- **memory-graph** — 'Add child under X' UI affords a hierarchy the flat backend silently discards (onAddMemory drops parentId; addMemory args are {text} only). Update is pin-only despite CRUD listing update:partial.
- **workspaces** — Two error messages tell owners to transfer ownership but no transferOwnership mutation exists (verified grep) — a team owner cannot leave or demote self and can only delete the whole workspace. Logged as 'med'; it is a functional dead-end for the primary owner-handoff flow.
- **usage-rollups** — Owned aggregate workspaceUsageDaily has no prune/Delete and no backfill; a missed cron leaves permanent holes, and take(500) existing-row preload can produce duplicate INSERTs (double-count) on high-cardinality ws-days.
- **ai-admin** — Aggregate totals silently cap at a 10k scan and render as exact, while a usageRollups table already exists to give true numbers — a counts-console showing wrong counts. Read-only with zero operator mutations (no revoke/disable/reset).
- **mcp-server-inbound** — mcpAuthCodes and mcpClients grow unbounded (no GC cron, unlike rateLimits); no per-user token cap plus two uncapped by_user .collect() (mcp.ts:32,53, verified). Open DCR registration with no revoke path.
- **spend-caps** — Enforcement scan take(4000) silently truncates and under-enforces the cap on high-cardinality workspaces — the wrong failure mode for a billing guardrail; a cap can be exceeded with no detection.
- **byok** — Pool/shared write surface (workspaceId/label/priority) is read-plumbed by resolveCred/providerPool but has no writer, so it is dead schema today; .unique() (store/delete) vs .first() (getCiphertext) will throw the moment a shared-cred writer lands. provider is an unvalidated free string server-side.
- **scheduled-agents** — Update is toggle-only — no cadence/prompt/agent edit, so changing interval means delete+recreate (loses run history). Claim-before-run can leave a fresh lastRunAt paired with a stale 'ok' status if the node action crashes before _markRun.
- **ai-chat** — sendMessage persists the user turn before the model call, so a failed call leaves a dangling user-only message that is re-forwarded and can produce two consecutive user-role turns (some providers reject). Thread update is rebind-only (no rename).

## Per-feature detail

### api-compat

**Score 90 → 88 (critic) · Grade A → B** — Tight, security-first gateway slice: complete-for-shape CRUD, full Convex validator/authz/index compliance, strong key hygiene, and clean portability — only low-severity nits (take-then-filter, member-can-mint, root file placement, raw UI elements that are a known repo-wide gap). Solid A.

**CRUD:** C ✓ · R ✓ · U – · D ✓
<br/>Entity = apiKeys. Create: apiKeys.issueApiKey (`apiKeys.ts:14`). Read: apiKeys.listApiKeys (`apiKeys.ts:24`) + internal _validate read path (`apiKeys.ts:44`). Update: n/a by design — API keys are immutable; only internal _touch (`apiKeys.ts:53`) bumps lastUsedAt. No relabel, which is standard/correct for keys. Delete: apiKeys.revokeApiKey (`apiKeys.ts:33`) — soft-delete (revoked:true), append-only audit trail rather than hard delete. CRUD is complete-for-shape.

- **rr conventions:** CONFORMS. Trio present + all pinned 0.1.0: `slice.json:5`, `slice.contract.ts:20`, `slice.manifest.json`:'version'. Barrel `index.ts:1` carries version comment 'api-compat v0.1.0' and re-exports only ApiKeysCard. Cross-slice import is barrel-only — `api-keys-card.tsx:6` imports useWorkspace from '@/features/workspaces' (no deep @/features/x/lib/... reach-in). Single-responsibility per file. File-size cap fine: `apiV1.ts` 91, `route.ts` 76, `api-keys-card.tsx` 63, `apiKeys.ts` 56, `tables.ts` 18 — all well under 200. Minor structure nit: the Convex fns live at `convex/apiKeys.ts` + `convex/apiV1.ts` (root), not convex/features/apiCompat/ — only `tables.ts` is under the feature dir. This deviates from the 'convex/features/&lt;slug&gt;/' rule, but `slice.json:13` rootPaths declares them explicitly and manifest notes it mirrors the /mcp proxy pattern, so it's a documented deliberate choice.
- **Convex rules:** CONFORMS strongly. Args validators on 100% of public+internal fns: apiV1.handle (`apiV1.ts:18`), issueApiKey (`apiKeys.ts:15`), listApiKeys (:25), revokeApiKey (:34), _validate (:45), _touch (:54). No bare .collect() anywhere in scope (grep clean). Server-side authz inside every mutation: issueApiKey requireWorkspaceRole(...,'member') `apiKeys.ts:17`; revokeApiKey loads row then requireWorkspaceRole(row.workspaceId,'member') :38 (checks the KEY's workspace, not client-supplied — correct). Gateway action apiV1.handle uses API-key auth by design: sha256(key) → _validate (`apiV1.ts:25`) + per-IP (240/min) and per-key (120/min) rate limits (:23,:27). Indexes used throughout: listApiKeys .withIndex('by_ws').take(50) (:28), _validate .withIndex('by_hash').unique() (:47). Only nit: listApiKeys does take(50) THEN filters revoked in memory (:29), so in a workspace with &gt;50 keys (many revoked) some active keys could be hidden.
- **UI rules:** MOSTLY CONFORMS given project reality. Theme tokens only — no hex anywhere (grep clean), colors via CSS classes (card/sub/mono/muted/accent/btn/danger). Key value uses wordBreak:'break-all' so it won't overflow. VIOLATION per rubric: raw &lt;button&gt; (`api-keys-card.tsx:27,45`) and &lt;input&gt; (:26) instead of shadcn primitives — but CLAUDE.md explicitly states shadcn does NOT exist in this project yet (plain CSS tokens) and lists it as a tracked, deliberately-deferred gap, so this is project-wide, not feature sloppiness. No explicit mobile-first breakpoints, but it's a simple single-column card. 'as never' casts on workspaceId/id (:12,:29,:45) are a type-safety smell.

**Strengths**

- Excellent secret handling: only sha256(raw) stored (`apiKeys.ts:19`), raw sk-rr-… shown exactly once, 32 random bytes b64url — strong entropy, mirrors mcpTokens pattern
- Defense in depth on the gateway: per-IP + per-key rate limits + hash validation before any provider spend (`apiV1.ts:23-29`), all funneled through the single callForUser cred pipeline
- Thorough error mapping: provider error codes → correct HTTP status (401/402/404/429/400) for both OpenAI and Anthropic paths (`apiV1.ts:57,77`), JSON-parse guard at the route boundary (`route.ts:21`)
- Clean revoke authz — checks the key's own workspace role, not a client-supplied one (`apiKeys.ts:37-38`); idempotent on missing row
- Genuinely portable/minimal: base URL derived from window.location.origin (`api-keys-card.tsx:18`), no hardcoded consumer URLs/env; contract declares forbiddenTerms + consumer-locked level correctly

**Critiques**

- 🟡 LOW — listApiKeys takes 50 rows then filters revoked in memory, so active keys can be hidden once a workspace accumulates &gt;50 mostly-revoked keys — silent, not an error, but a scale foot-gun <br/>↳ `web/convex/apiKeys.ts:28-29`
- 🟡 LOW — Any workspace 'member' can mint an sk-rr key that spends the workspace's provider credentials indefinitely; a long-lived spend credential arguably warrants 'admin' role to issue <br/>↳ `web/convex/apiKeys.ts:17`
- 🟡 LOW — Convex fns placed at convex root (`apiKeys.ts`, `apiV1.ts`) instead of convex/features/apiCompat/ — deviates from the vertical-slice backend layout rule (declared in `slice.json` rootPaths + noted, but still split-brained: tables live in the feature dir, logic doesn't) <br/>↳ `web/frontend/slices/api-compat/slice.json:13`
- 🟡 LOW — Raw &lt;button&gt;/&lt;input&gt; instead of shadcn primitives — rubric violation, but a project-wide known/deferred gap (no shadcn in repo yet) per CLAUDE.md, not feature-specific <br/>↳ `web/frontend/slices/api-compat/components/api-keys-card.tsx:26-27`
- 🟡 LOW — 'as never' type casts on workspaceId/key ids paper over the Convex Id type at the client boundary; a typed Id&lt;'workspaces'&gt; would be safer <br/>↳ `web/frontend/slices/api-compat/components/api-keys-card.tsx:12`

**Suggestions**

- `S` In listApiKeys, add a compound index (e.g. by_ws_revoked) or query only non-revoked so active keys can never be hidden behind 50 tombstones.
- `S` Consider bumping issueApiKey to require 'admin' (not 'member') since an API key is a durable spend credential; revoke can stay at 'member'.
- `S` Drop the 'as never' casts in `api-keys-card.tsx` by typing workspaceId as Id&lt;'workspaces'&gt; and key id as Id&lt;'apiKeys'&gt; from the query result.
- `M` When shadcn lands project-wide, wrap the issue &lt;input&gt;/&lt;button&gt; in the shared primitives to close the one UI-rule gap; low urgency given the tracked repo-level deferral.

---

### ai-chat

**Score 89 · Grade B** — Exemplary Convex backend (validators, indexing, authz, spend-caps, modularity all clean); dinged only by a partial thread-Update, a dangling-user-message edge case, and raw-element UI that is a documented project-wide gap.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Owned entities: threads + messages. threads — Create yes (threads.createThread:26), Read yes (threads.listThreads:67 / threads.threadMessages:81), Update PARTIAL (threads.rebindThreadAgent:50 swaps agent binding + model, but NO title/rename mutation exists), Delete yes (threads.deleteThread:93 + async cascade threads._deleteMessages:108). messages — Create yes (threads._append:120 via sendMessage:140), Read yes (threadMessages:81), Update n/a (append-only chat log, correct by design — no edit/regenerate), Delete yes but only cascaded with the thread; no per-message delete (acceptable for a chat log). chat/runAgent/testCredential (`chat.ts`) are stateless model-call actions, not owners of persisted state (runAgent writes to the agents/usage tables owned by other features).

- **rr conventions:** NOT a slice yet (cross-cutting) — files live in convex/ root, not convex/features/ai-chat/, so no `slice.json`/manifest/contract trio is expected. Judged on the other rr axes: PASS. File-size cap PASS — all 6 files &lt;200 lines (chat 159, threads 162, callForUser 169, chatProviders 60, chatTools 28, chatErrors 39). SRP PASS — clean split: provider→model resolution (chatProviders), tool derivation (chatTools), error classification (chatErrors), shared core call (callForUser), public actions (chat), persistence (threads). Imports PASS — all relative (./chatProviders, ./chatTools, ./_shared/auth); no deep @/features/x/lib cross-slice reach-ins.
- **Convex rules:** STRONG PASS. Args validators 10/10 public+internal fns (`chat.ts:22`, runAgent:61, testCredential:142, createThread:27, rebindThreadAgent:51, listThreads:68, threadMessages:83, deleteThread:94, sendMessage:141, _append:121/_history:131/_deleteMessages:109). No bare .collect() — every read is .withIndex(...).take(N): listThreads by_user_at take(50) `threads.ts:72`, threadMessages/_history by_thread take(100):88/135, _deleteMessages take(200):111. Server-side authz inside every mutation: requireUser + ownership (createThread:29-38, rebindThreadAgent:53-62, deleteThread:96-98, _append:124/_history:134 verify t.userId===a.userId); actions add resolveWorkspaceAction(...,'member') RBAC (`chat.ts:31,64`). Spend cap enforced in callForUser:54-57 AND re-asserted in runAgent:69 to close the direct-generateText bypass. Errors classified into structured ConvexError and preserved across the node→V8 runAction boundary (`threads.ts:149-157`).
- **UI rules:** Partial pass with a known deviation. The chat surface (`app/app/_components/workbench.tsx`, 185 lines) uses RAW &lt;button&gt; (98,110,117,134,156,176) and &lt;textarea&gt; (175) instead of shadcn primitives — violates the 'shadcn primitives only' rule. Mitigating: this is the documented, tracked project-wide gap (CLAUDE.md: shadcn + Tailwind absent, plain-CSS tokens today), not a per-feature oversight; styling is via semantic CSS classes (card/btn/badge/muted/sub) with NO inline hex, so the 'theme tokens not hex' spirit holds. Loading/empty/error states handled (msgs===undefined, length===0, ErrorLine, busy typing indicator). No Tailwind means no md:/sm: mobile-first modifiers — responsiveness lives in external CSS (not verified here).

**Strengths**

- 100% args validators across all public + internal functions; zero bare .collect() — every query indexed and capped with take(N)
- Server-side authz on every mutation (requireUser + workspace RBAC + row-level ownership), never trusting route gates
- Spend-cap re-asserted in runAgent (`chat.ts:69`) to close the callForUser bypass — a genuinely thoughtful edge-case catch, documented in-comment
- Tight SRP modularity: 6 files all &lt;200 lines, provider/tools/errors/core-call/actions/persistence cleanly separated; core call shared with the MCP path so they can't diverge
- Robust error handling — classifyError maps SDK/provider failures to structured codes, preserved across the node→V8 runAction boundary; testCredential never throws on a bad key; BYOK secrets encrypted at rest

**Critiques**

- 🟠 MED — Chat UI uses raw &lt;button&gt;/&lt;textarea&gt; instead of shadcn primitives (ResponsiveDialog/wrapped controls) — violates the 'shadcn primitives only' UI rule. Known/tracked project-wide gap, not a fresh regression, but still a live deviation for a feature meant to become a droppable rr block. <br/>↳ `web/app/app/_components/workbench.tsx:98,117,175,176`
- 🟡 LOW — thread Update is incomplete: rebindThreadAgent swaps the agent binding + model, but there is no renameThread mutation — the title is fixed to the first message's first 60 chars at create time forever. <br/>↳ `web/convex/threads.ts:40` (createThread title), `threads.ts:50` (rebind is the only update path)
- 🟡 LOW — On a failed model call, sendMessage has already persisted the user message (via _append before the try) but writes no assistant reply, leaving a dangling user turn. It is re-forwarded to the model on the next send and can produce two consecutive user-role messages, which some providers reject. <br/>↳ `web/convex/threads.ts:144-157`
- 🟡 LOW — messages are append-only with no per-message edit/delete/regenerate — standard chat affordances (edit prompt, retry last) are absent. Acceptable as an append-only-by-design scope cut, noted for completeness. <br/>↳ `web/convex/threads.ts:120-128`

**Suggestions**

- `S` Add a renameThread mutation (args {threadId, title} + requireUser + ownership + slice(0,80)) to complete thread Update — mirrors the existing createThread title cap.
- `M` On sendMessage failure, roll back the just-appended user message (or mark it pending) so a retried turn doesn't leave/forward a dangling user-only turn to the model.
- `L` When the tracked shadcn/Tailwind migration lands, wrap `workbench.tsx` controls (Button/Textarea) and move it into frontend/slices/ai-chat with the metadata trio so this cross-cutting feature becomes a real droppable rr slice.

---

### mcp-client

**Score 88 · Grade B** — Clean, security-forward external-MCP slice — full trio, airtight Convex validation/authz/encryption and thoughtful SSRF+redaction+loop guards; held back from an A only by a missing update path and the plain-HTML (non-shadcn) form controls.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Single owned entity = mcpServers. probeServer (`mcpClientNode.ts`) writes a tool-list snapshot into toolCache via internal _recordProbe (`mcpServers.ts:127`). Missing: an updateServer to edit config/rotate creds in place.

- **rr conventions:** PASS. Trio present + versions matched: `slice.json` 0.1.0, `slice.manifest.json` 0.1.0, `slice.contract.ts` 0.1.0; barrel `index.ts:1` carries the versioned comment. Barrel-only cross-slice import (@/features/workspaces, `mcp-servers-card.tsx:8`) — no deep @/features/x/lib reach-in. SRP clean (registry CRUD vs node client/tool-derivation vs tables vs UI split across files). 200-line cap: all under — `mcpServers.ts` 145, `mcpClientNode.ts` 101, `mcp-servers-card.tsx` 85, `tables.ts` 28. Minor: `slice.manifest.json:8` deps.slices is [] but the component depends on the workspaces slice.
- **Convex rules:** STRONG. Args validators on all 5 public fns (listServers/addServer/toggleServer/removeServer/probeServer) + all 4 internal fns. Zero bare .collect() — every query uses .withIndex("by_user").take(100) (`mcpServers.ts:35,78,110`). Server-side authz inside every handler: requireUser on all public fns; ownership guard row.userId!==userId on toggle/remove (`mcpServers.ts:90,100`) and _getForProbe (`mcpClientNode.ts:46-47`); requireWorkspaceRoleAction("member") on workspace-scoped addServer (`mcpServers.ts:52`). Internal fns are internalMutation/internalQuery (not client-reachable). Indexes by_user/by_ws defined (`tables.ts:26-27`) and used. Nit: .take(100) silently truncates for a user with &gt;100 servers, and workspaceId is post-filtered in memory rather than via by_ws (`mcpServers.ts:36`).
- **UI rules:** DEVIATES (but consistent with documented baseline). Raw HTML form controls, not shadcn primitives: &lt;input&gt;/&lt;select&gt;/&lt;textarea&gt;/&lt;button&gt; (`mcp-servers-card.tsx:47-55`) and &lt;input type=checkbox&gt; (line 69) — violates the shadcn-only rule. Theme via CSS classes (card/sub/btn/mono/muted/danger) + var(--danger,#d33) rather than raw hex (one hex fallback at line 75); heavy inline style objects instead of tokens. No explicit mobile breakpoints but the card is single-column and simple. NOTE: project CLAUDE.md states shadcn does not exist app-wide yet (plain CSS) and says not to fix unprompted, so this matches sibling cards (memory/members) — a documented, tracked gap, not a slice regression.

**Strengths**

- Full metadata trio at matched v0.1.0 + versioned barrel; every file well under the 200-line cap (145/101/85/28)
- Airtight Convex layer: every public+internal fn args-validated, zero bare .collect (all .withIndex.take), requireUser + ownership check + workspace-role on every mutation/action
- Secrets handled right: custom headers AES-256-GCM at rest (`crypto.ts`), ciphertext never in the read projection (mapRow), MODELS_ENC_KEY is server-only process.env — never NEXT_PUBLIC
- Defense-in-depth SSRF guard (assertSafeUrl at both add-time and connect-time, `ssrf.ts`) + credential redaction stripping header values from any error text before it reaches the model (`mcpClientNode.ts:32-36,58,77`)
- Honest, documented limitations: loop guard (agent-surface-only, never re-exported on own /mcp), DNS-rebinding caveat, workspace-share deferred — all called out in code + manifest

**Critiques**

- 🟠 MED — No update path: only toggleServer(enabled) exists — url/name/transport/headers cannot be edited after creation, so fixing a typo'd URL or rotating a leaked header requires delete+recreate (losing the toolCache). <br/>↳ `web/convex/mcpServers.ts:85-103`
- 🟠 MED — Frontend uses raw HTML form controls (input/select/textarea/button/checkbox) instead of shadcn primitives, violating the shadcn-only UI rule. Contextual: this is an app-wide, documented plain-CSS baseline (CLAUDE.md says do not fix unprompted), consistent with sibling cards. <br/>↳ `web/frontend/slices/mcp-client/components/mcp-servers-card.tsx:47-55,69`
- 🟡 LOW — Undeclared slice dependency: the component imports @/features/workspaces but `slice.manifest.json` deps.slices is [] — a lift/CLI audit would miss the peer. <br/>↳ `web/frontend/slices/mcp-client/slice.manifest.json:8`
- 🟡 LOW — .take(100) silently truncates: a user with &gt;100 servers loses rows in listServers and _enabledServers (the latter drops agent tools), and workspaceId is filtered in-memory after the by_user index rather than via by_ws. <br/>↳ `web/convex/mcpServers.ts:35,110`
- 🟡 LOW — `as never` casts launder Convex Id&lt;&gt; types at the query/mutation call boundary in the component, defeating end-to-end type safety. <br/>↳ `web/frontend/slices/mcp-client/components/mcp-servers-card.tsx:18,34,68-70`

**Suggestions**

- `M` Add an updateServer action (edit url/name/transport + re-encrypt headers, re-run assertSafeUrl) so config/credential changes don't need delete+recreate; wire an inline edit affordance in McpServersCard.
- `S` Declare the workspaces frontend dependency in `slice.manifest.json` deps.slices so the CLptr audit and lift flow see the peer.
- `S` If &gt;100 servers per user is plausible, paginate listServers/_enabledServers or query the by_ws index directly for workspace-scoped reads instead of the take(100)+in-memory filter.

---

### spend-caps

**Score 88 · Grade B** — Tight, correctly-scoped enforcement slice — reuses an existing field, actually wires the cap into the model hot path, and passes every Convex rule; docked mainly for a silent .take(4000) undercount edge and raw (non-shadcn) UI primitives.

**CRUD:** C ✓ · R ✓ · U ✓ · D ✓
<br/>Entity is a single scalar config: workspaces.capUsdPerMonth (no owned table — reuses an existing field, by design). CREATE/UPDATE: setSpendCap (mutation, upsert-on-field) `spendCaps.ts:35`. DELETE = clear: setSpendCap with monthlyCapUsd omitted → ctx.db.patch drops the field; 'Clear' button `spend-cap-card.tsx:66` / `spendCaps.ts:41`. READ: getSpendStatus (viewer query) `spendCaps.ts:47` + checkSpendCap (internalQuery enforcement) `spendCaps.ts:29`. CRUD is complete and correctly scoped for a single-field config — no over-building, no missing operation.

- **rr conventions:** PASS. Trio present + versions matched at 0.1.0: `slice.json:4`, `slice.manifest.json:4`, `slice.contract.ts:19`; barrel comment carries version `index.ts:1`. Barrel-only cross-slice imports — `spend-cap-card.tsx:8` imports useWorkspace from @/features/workspaces (no deep @/features/x/lib/...). File-size cap OK: `spendCaps.ts` 53 lines, `spend-cap-card.tsx` 76 lines (both well under 200). SRP intact (one component; convex file is 3 cohesive fns + 1 helper). Minor: contract.requires.deps lists only @convex-dev/auth (`slice.contract.ts:21`) while manifest deps.slices lists workspaces + usage-rollups (`slice.manifest.json:8`) — contract understates real deps.
- **Convex rules:** PASS. Args validators on all 3 public/internal fns: checkSpendCap {workspaceId:v.id} :30, setSpendCap {workspaceId, monthlyCapUsd:v.optional(v.number())} :36, getSpendStatus {workspaceId} :48. NO bare .collect() — computeSpend uses .withIndex('by_ws_day').take(4000) `spendCaps.ts:21-22` (index defined `usageRollups/tables.ts:20`). Server-side authz inside handlers: requireWorkspaceRole(...,'admin') in setSpendCap :38, requireWorkspaceRole(...,'viewer') in getSpendStatus :50 (helper `_shared/auth.ts:51`); checkSpendCap is internalQuery, not client-reachable, callers pre-authorized — correct. One caveat: .take(4000) can silently truncate (undercount) on very high provider/model cardinality — see critiques.
- **UI rules:** PARTIAL. Theme-token-driven with hex fallbacks — var(--danger,#c55)/var(--warn,#d90)/var(--accent,#6a9)/var(--border,#2222) `spend-cap-card.tsx:41,58` (acceptable given project uses plain CSS tokens, not Tailwind/shadcn — a documented app-wide gap). Violates rr 'shadcn primitives only': raw &lt;input type=number&gt; :64 and raw &lt;button className=link&gt; :65-66. Responsive-lite (flexWrap:wrap :63); card, no full-height concern. A11y gap: input is placeholder-only, no &lt;label&gt;/aria-label :64.

**Strengths**

- Reuses existing workspaces.capUsdPerMonth field — adds NO new table/column (YAGNI; `tables.ts:14`)
- Enforcement actually wired, not just declared: checkSpendCap gates the model hot path at `callForUser.ts:55` and `chat.ts:69`
- Full Convex compliance: args validators on all fns, .withIndex+bounded .take (no bare collect), requireWorkspaceRole authz inside setSpendCap/getSpendStatus, internalQuery for the unauth gate
- Trust-boundary validation server-side (finite && &gt;=0) `spendCaps.ts:39`, mirrored client-side `spend-cap-card.tsx:31` — defense in depth
- Tight, single-purpose files (53/76 lines) with excellent header comments documenting the soft-guardrail + estimate-not-a-bill semantics

**Critiques**

- 🟠 MED — .take(4000) monthly scan silently truncates — a workspace logging &gt;~129 distinct provider/model rows/day for the month exceeds 4000 rows, undercounting spentUsd and under-enforcing the cap with no detection. For a billing guardrail, silent truncation is the wrong failure mode. <br/>↳ `web/convex/spendCaps.ts:22`
- 🟠 MED — Raw &lt;input&gt;/&lt;button&gt; instead of shadcn primitives (rr UI rule 'shadcn primitives only'). Consistent with the project's documented no-shadcn reality, but still a rule miss for a portable slice. <br/>↳ `web/frontend/slices/spend-caps/components/spend-cap-card.tsx:64`
- 🟡 LOW — Cap input is placeholder-only with no &lt;label&gt;/aria-label — screen-reader users have no accessible name for the field. <br/>↳ `web/frontend/slices/spend-caps/components/spend-cap-card.tsx:64`
- 🟡 LOW — contract.requires.deps lists only @convex-dev/auth but the slice reads workspaceUsageDaily (usage-rollups) and useWorkspace (workspaces); manifest.deps.slices lists both — the contract understates real dependencies, so a dep-peer audit could pass falsely. <br/>↳ `web/frontend/slices/spend-caps/slice.contract.ts:21`
- 🟡 LOW — A cap of exactly 0 evaluates spentUsd&gt;=0 → always over (blocks all calls), yet the bar renders empty at 0% — ambiguous vs 'no cap' which is expressed by Clear. Minor UX/edge overlap. <br/>↳ `web/convex/spendCaps.ts:25`

**Suggestions**

- `M` Replace the .take(4000) monthly scan with a pre-aggregated monthly rollup row (or reduce via pagination) so the cap can never be under-enforced on high-cardinality workspaces.
- `S` Add an aria-label/&lt;label&gt; to the cap &lt;input&gt; for accessibility.
- `S` Align contract.requires.deps with the manifest — add workspaces + usage-rollups slice deps so audits see the true dependency graph.
- `S` When the app adopts shadcn, wrap the raw button/input (Input + Button) — matches the app-wide migration plan.

---

### workspaces

**Score 87 · Grade B** — Excellent Convex/RBAC/invite core with full CRUD and zero validator/collect/authz violations; docked to a B by one real functional dead-end (no transferOwnership despite the UI telling owners to use it), a couple of take-limit edge cases, and the acknowledged non-shadcn UI.

**CRUD:** C ✓ · R ✓ · U ✓ · D ✓
<br/>3 entities, all well-covered. workspaces: C=create/ensurePersonal(`workspaces.ts:33,61`), R=myWorkspaces(:45), U=rename(:73), D=remove(:85, owner-only, blocks personal). memberships: C=via create/ensurePersonal/acceptInvite(`workspaceInvites.ts:73`), R=listMembers(:98), U=updateRole(:113), D=removeMember(:127)+leaveWorkspace(:140). invites: C=createInvite(:18), R=listInvites(:32)+inviteInfo(:54), U/soft-D=revokeInvite(:43, patch revoked)+acceptInvite(:65); invites hard-deleted on workspace remove(:93). Invites are append-only/soft-delete by design (documented). GAP: no transferOwnership fn despite two error messages telling owners to 'transfer ownership' (`workspaces.ts:120,146`) — grep confirms it does not exist, so a team owner is stuck (cannot leave/demote-self; can only delete the whole workspace).

- **rr conventions:** PASS. Metadata trio present + version-matched at 0.1.0 across `slice.json:4`, `slice.manifest.json:3`, `slice.contract.ts:20`; barrel comment says 'workspaces v0.1.0' (`index.ts:1`). Barrel-only imports: components import intra-slice '../context' (fine); no deep @/features/x/lib/... imports; `context.tsx` consumes api.settings.* via _generated api not a deep slice reach (`context.tsx:21-23`). SRP clean — one concern per file. File-size cap respected: largest is `convex/workspaces.ts` at 150 lines; all others &lt;100. Contract correctly self-declares consumer-locked with forbiddenTerms ['models-rahmanef','rahmanef'] (`slice.contract.ts:34`).
- **Convex rules:** STRONG PASS. args validators: 18/18 public+internal fns declare args with v.* (`workspaces.ts`, `workspaceInvites.ts`, `auth.ts` helpers). No bare .collect() anywhere — every scan is .withIndex(...).take(N) (`workspaces.ts:16,23,50,92,93,102,118`; `workspaceInvites.ts:36,58,70,72`). Server-side authz INSIDE every mutation: requireUser/requireWorkspaceRole(min role) on create(requireUser:64), rename(admin:76), remove(owner:88), updateRole(admin:116), removeMember(admin:130), leaveWorkspace(viewer:143), createInvite(admin:21), revokeInvite(get-then-admin:47-48), acceptInvite(requireUser+token:68); inviteInfo intentionally unauthed preview (token is the secret). RBAC ranking centralized in `_shared/auth.ts` (ROLE_RANK:47, requireWorkspaceRole:51). Minor edge cases (not P0): ensurePersonalWs uses by_owner .take(50)+.find(personal) — a user owning &gt;50 workspaces could miss the existing personal and create a duplicate; deterministic by_slug 'personal-{userId}' lookup would be safer (`workspaces.ts:23-25`). remove cleans up memberships/invites via .take(500) — &gt;500 rows would be orphaned (`workspaces.ts:92-93`). ensurePersonalWs typed (ctx:any,userId:any) in a strict-TS repo (`workspaces.ts:22`).
- **UI rules:** PARTIAL (acknowledged app-wide gap). Uses raw &lt;button&gt;/&lt;select&gt;/&lt;option&gt; plus window.prompt/window.alert instead of shadcn primitives (`members-card.tsx:35,49,52,64`; `workspace-switcher.tsx:23-27`; invite via prompt). This is the documented plain-CSS baseline (no Tailwind/shadcn yet) and the contract flags it consumer-locked + 'generalize to shadcn before UP push'. Positives: theme tokens not hex (CSS classes .card/.btn/.sub/.badge, var(--danger) at invite page:48); next/link used (invite page:38,56); portable URL via window.location.origin not hardcoded (`members-card.tsx:27`); WorkspaceProvider gates on ready to avoid flicker (`context.tsx:47`). Responsiveness is class-driven with width:100% inline — adequate for this small surface, no explicit md:/lg: breakpoints.

**Strengths**

- Invite security done right: only sha256(token) stored, raw link returned ONCE, 7-day TTL, revocable, accept re-checks revoked/accepted/expired (`workspaceInvites.ts:24-28,71`) — bearer-link model matched to no-email-verification reality
- Complete CRUD across all 3 owned entities plus a clean owner&gt;admin&gt;member&gt;viewer RBAC with owner-role immutability and admin-grant-requires-owner guards (`workspaces.ts:120-121,133-134`)
- Every mutation enforces authz in-handler via one shared helper (requireWorkspaceRole) — no reliance on route gates; audit events written on role change/member removal (`workspaces.ts:123,136`)
- Zero Convex rule violations on validators/collect/index — 18/18 args validators, all .withIndex().take(N)
- Idempotent OCC-safe personal-workspace bootstrap with an action-safe internal twin for actions that lack ctx.db (`workspaces.ts:22-43`)

**Critiques**

- 🟠 MED — transferOwnership referenced in two error messages but the mutation does not exist — a team-workspace owner cannot hand off and leave; leaveWorkspace and updateRole both dead-end them, and remove (delete everything) is the only escape. <br/>↳ `web/convex/workspaces.ts:120,146` (grep for transferOwnership returns only these two strings)
- 🟡 LOW — ensurePersonalWs scans by_owner with .take(50) then .find(personal); a user owning &gt;50 workspaces could fail to see their existing personal and insert a duplicate. Deterministic slug lookup via by_slug 'personal-{userId}' would be race-proof. <br/>↳ `web/convex/workspaces.ts:23-25`
- 🟡 LOW — remove deletes memberships/invites with a hard .take(500) cap — a workspace exceeding 500 of either would leave orphaned membership/invite rows after the workspace doc is deleted. <br/>↳ `web/convex/workspaces.ts:92-93`
- 🟡 LOW — Members UI and switcher use raw &lt;button&gt;/&lt;select&gt;/window.prompt/window.alert rather than shadcn primitives (ResponsiveDialog etc.). Acknowledged plain-CSS baseline + consumer-locked contract, but a real portability blocker for an UP push. <br/>↳ `web/frontend/slices/workspaces/components/members-card.tsx:22-28,49,52`
- 🟡 LOW — ensurePersonalWs is typed (ctx: any, userId: any) in a strict-TypeScript project, defeating type-checking on the hottest bootstrap path. <br/>↳ `web/convex/workspaces.ts:22`

**Suggestions**

- `M` Add a transferOwnership(workspaceId, toUserId) mutation (owner-only): patch target membership to owner + demote caller to admin + write an audit event, so the two 'transfer ownership' error messages become actionable and owners aren't stuck.
- `S` In ensurePersonalWs, look the personal workspace up directly by slug 'personal-{userId}' via the by_slug index instead of scanning by_owner .take(50).find(personal) — eliminates the duplicate-personal edge case.
- `S` Type ensurePersonalWs as (ctx: MutationCtx, userId: Id&lt;'users'&gt;) to restore strict-mode coverage.
- `S` For remove, either paginate the membership/invite cleanup or document the 500-row assumption explicitly; realistically fine, but a loop-until-empty avoids silent orphans.

---

### byok

**Score 87 · Grade B** — Clean, security-minded BYOK slice: encryption + tenant derivation + validators + trio are textbook; deductions are a latent .unique()/.first() inconsistency, an unvalidated provider string, and pool/shared plumbing that byok owns but can't yet write.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Entity = modelCreds (byok-owned). CREATE: setCredential action (`credentials.ts:41`) -&gt; internal store insert; also OAuth flows write via store. READ: listConfiguredProviders query (`credentials.ts:21`) returns masked rows (mapCred strips ciphertext, `credentials.ts:12`); internal providersForUser/getCiphertext/resolveCred for agent/MCP/chat paths. UPDATE: setCredential re-paste is upsert (store patches existing row, `credentials.ts:74`); _recordCheck patches health fields; claimRefresh patches lease. No dedicated relabel/reprioritize mutation despite schema label/priority/status pool fields existing (`schema.ts:40-45`) -&gt; pool-metadata update UNBUILT, hence partial. DELETE: deleteCredential mutation (`credentials.ts:97`), idempotent. Core credential CRUD complete; the workspace-shared + multi-key-pool write surface is read-plumbed (providerPool.getCandidates .take(10), resolveCred by_ws_provider) but has NO writer -- store never sets workspaceId/label/priority, so those features are read-only plumbing today.

- **rr conventions:** SLICE, and a clean one. Metadata trio all present + version-matched at 0.1.0: `slice.json`, `slice.manifest.json`, `slice.contract.ts`, plus `.kitab.json` (0.1.0) and the barrel comment (`index.ts:1` "byok v0.1.0"). File-size cap PASS — largest source is `providers.tsx` at 178 lines (connect-providers 127, `credentials.ts` 144, `crypto.ts` 30). Convex barrel (`features/byok/index.ts`) re-exports only the plain crypto helpers and honestly documents why registered fns stay at api.credentials.*. SRP nit: `providers.tsx` bundles cheapestModel + TestResultLine + runCredentialTest + ApiKeyForm + ConnectedCreds + CredBadge (6 concerns, cohesive but arguably 2-3 files). Cross-slice import: UI reaches into @/app/app/_components/shared (deep app import, not a barrel) — a consumer-lock blocker HONESTLY tracked in `slice.contract.ts:32-40` + `.kitab.json` blockers, not hidden.
- **Convex rules:** STRONG. Args validators 100% (setCredential/deleteCredential/listConfiguredProviders all declare args:{v.*}; internal store/getCiphertext/resolveCred/claimRefresh/_recordCheck/providersForUser too; testCredential in `chat.ts:142` too). Server-side authz inside every public write: setCredential requireUser (`credentials.ts:44`), deleteCredential requireUser (`credentials.ts:100`); internals take a pre-authorized userId arg. Every query uses .withIndex (by_user / by_user_provider / by_ws_provider — all exist in `schema.ts:53-55`). Nits: listConfiguredProviders (`credentials.ts:26`) and providersForUser (`credentials.ts:36`) use .withIndex(by_user).collect() — scoped to one user so bounded (~&lt;=22 provider rows) but not .take(N), technically uncapped. deleteCredential/store use .unique() on by_user_provider (`credentials.ts:59,72,103`) while getCiphertext deliberately uses .first() (`credentials.ts:120`) to survive a personal+shared duplicate — inconsistency becomes a real throw the moment any writer sets workspaceId with the same userId (none does today, so latent).
- **UI rules:** RAW controls, not shadcn: &lt;button&gt;/&lt;input&gt;/&lt;select&gt; used directly (`providers.tsx:73-100`, `connect-providers.tsx:92-120`) — but this is the project-wide baseline (CLAUDE.md notes Tailwind + shadcn absent, plain CSS tokens), not a byok regression. No hex in the tsx — styling is class-token driven (btn/link/badge/ok-line); CSS-grid layout (connect-grid) is responsive-capable. Inline styles are minimal + non-color. Acceptable within this repo's documented CSS-token convention.

**Strengths**

- Encryption done right: AES-256-GCM at rest, random 12-byte IV per encrypt (`crypto.ts:17`), master key from server-only process.env.MODELS_ENC_KEY, never NEXT_PUBLIC; 32-byte length validated (`crypto.ts:10`)
- tenantId ALWAYS derived from the authed session (getAuthUserId/requireUser), never from client input; ciphertext never leaves the server (mapCred whitelist strips it, `credentials.ts:12-19`)
- Metadata trio + .kitab + barrel comment all version-matched at 0.1.0; consumer-lock blockers documented honestly in contract + kitab rather than hidden
- 100% args validators + 100% .withIndex usage; single-flight OAuth refresh lease (claimRefresh) is a thoughtful concurrency guard
- Connectivity test records health via internal _recordCheck with best-effort try/catch so bookkeeping failures never surface as a false 'bad key' (`chat.ts:150,155`)

**Critiques**

- 🟠 MED — deleteCredential + store use .unique() on by_user_provider, but getCiphertext deliberately uses .first() to survive a personal+workspace-shared duplicate for the same (userId,provider). The moment any writer inserts a workspaceId-set row with that same userId, deleteCredential and store throw 'not unique' -- a latent inconsistency waiting on the shared-cred feature that resolveCred/providerPool already read for. <br/>↳ `web/convex/credentials.ts:103` (.unique) vs `credentials.ts:120` (.first)
- 🟡 LOW — provider is an unvalidated free string on setCredential/deleteCredential -- OAUTH_ONLY filtering exists only client-side in the dropdown (`providers.tsx:54-55`), so a crafted client can store creds under arbitrary/junk provider slugs. No real data leak (own encrypted data) but no server allowlist. <br/>↳ `web/convex/credentials.ts:42`
- 🟡 LOW — listConfiguredProviders and providersForUser end in .collect() (not .take(N)) after .withIndex(by_user) -- bounded per-user in practice but technically uncapped per the 'no bare collect' rule. <br/>↳ `web/convex/credentials.ts:26,36`
- 🟡 LOW — `providers.tsx` carries 6 distinct concerns (catalog cost-picker, result line, test runner, key form, cred list, badge) in one file -- cohesive but a mild SRP smell; cheapestModel is catalog logic, not UI. <br/>↳ `web/frontend/slices/byok/components/providers.tsx:11-178`
- 🟡 LOW — UI uses raw &lt;button&gt;/&lt;input&gt;/&lt;select&gt; rather than shadcn primitives per the UI rule -- but this is the repo-wide documented baseline (no Tailwind/shadcn adopted), so it is a project gap, not a byok defect. <br/>↳ `web/frontend/slices/byok/components/providers.tsx:73-100`

**Suggestions**

- `S` Make deleteCredential/store consistent with getCiphertext: filter workspaceId===undefined before .unique(), or switch to .first(), so the shared-cred feature can't turn them into runtime throws.
- `S` Add a server-side provider allowlist (reuse PROVIDER_LABEL keys / OAUTH_ONLY) in setCredential so junk provider slugs can't be persisted.
- `S` Cap the per-user reads: .withIndex(by_user).take(50) instead of .collect() in listConfiguredProviders/providersForUser to satisfy the rule literally and stay future-proof.
- `M` Extract cheapestModel + the test-runner helpers out of `providers.tsx` into a byok lib/ module so the file is purely UI components; tightens SRP and keeps it well under the cap.
- `M` Either wire the write side of the pool (a mutation to set label/priority and create a second key per provider) or drop the unused pool/shared read plumbing from byok's surface until channel-policy needs it -- right now modelCreds owns fields no byok mutation can populate.

---

### memory

**Score 87 · Grade B** — Strong, well-wired slice: complete CRUD (archive-only by design), textbook Convex hygiene, and injection-hardened — docked mainly for a stale barrel version, dead recall columns, and an advertised-but-unimplemented agent scope. Solid B.

**CRUD:** C ✓ · R ✓ · U ✓ · D ✓
<br/>Single entity: memories. CREATE=yes — addMemory (UI, `memory.ts:97`), _toolWrite add (agent tool, `memory.ts:44`), _upsertSummary insert (auto-summary, `memoryAutoSummary.ts:63`). READ=yes — listMemories (paginated UI, `memory.ts:61`), _toolSearch (recall_memory tool, `memory.ts:50`), _buildContext (system-prompt injection, `memory.ts:14`). UPDATE=yes — pinMemory pin/unpin (`memory.ts:83`), _upsertSummary patch (`memoryAutoSummary.ts:61`); no UI to edit an existing memory's TEXT (forget+re-add is the path — acceptable for tiny rows). DELETE=yes but SOFT/ARCHIVE-ONLY BY DESIGN (documented `memory.ts:1`, `memoryCuration.ts:1`) — removeMemory (`memory.ts:106`), _toolWrite remove (`memory.ts:35`), curateMemories cron (`memoryCuration.ts:11`) all set archived:true, never hard-delete. Plus a settings toggle setMemoryEnabled (`memory.ts:115`). CRUD is complete.

- **rr conventions:** Trio present and version-matched at 0.2.0: `slice.json:3`, `slice.manifest.json:4`, `slice.contract.ts:19-20` all agree. BUT the barrel comment is stale: `frontend/slices/memory/index.ts:1` still says "memory v0.1.0" — the one version-match miss the criteria call out. Barrel-only imports: `memory-panel.tsx` imports intra-slice ./memory-list and generated @/convex/_generated/api only — no deep @/features/x/lib/... reach-ins. SRP clean: list extracted from panel (`memory-list.tsx:2` documents the split). File-size cap: all files well under 200 (max is `memory.ts` at 123). Portability enforced by `contract.ts:33` forbiddenTerms ["models-rahmanef","rahmanef"] (grep of slice source finds none) and workspaceId is a prop (`memory-panel.tsx:18`).
- **Convex rules:** PASS. Validators: every public + internal fn declares args:{} with v.* — listMemories/pinMemory/addMemory/removeMemory/setMemoryEnabled (`memory.ts:62,84,98,107,116`) and internals _buildContext/_toolWrite/_toolSearch (`memory.ts:15,27,51`), _threadForSummary/_upsertSummary/maybeSummarize (`memoryAutoSummary.ts:38,53,74`), summarizeThread (`memorySummarize.ts:16`), curateMemories (`memoryCuration.ts:12`). No bare .collect() anywhere — all reads are .withIndex(...).take(N) (`memory.ts:17-18,29,71,74`) or .withSearchIndex(...).take(8) (`memory.ts:53`); curation uses .order("asc").take(200) on the system index (`memoryCuration.ts:16`). Authz inside handlers: requireUser on all 5 public mutations/queries + requireWorkspaceRole for workspace scope (`memory.ts:64,70,86,91,100,109,117`); ownership re-checked before patch (`memory.ts:89,111`). Indexes defined in `tables.ts:28-31` (by_user_scope/by_user_thread/by_workspace_scope + search_text) and used. Minor: _buildContext (`memory.ts:18`) reads workspace memories by workspaceId without re-verifying membership, but it is internalQuery gated upstream by `callForUser.ts:77` which sources workspaceId from the caller's own thread context — acceptable.
- **UI rules:** PARTIAL — matches project baseline, not rr ideal. Raw primitives used, not shadcn: &lt;button&gt; and &lt;input type=checkbox|text&gt; throughout `memory-panel.tsx:37,41,47,53,54` and link buttons in `memory-list.tsx:39-40`. This is the known project-wide gap (plain CSS, no shadcn/Tailwind per CLAUDE.md compliance snapshot), not slice-specific negligence. Theme: token-first via className ("card","btn accent","mono muted") with CSS-var inline styles carrying hex fallbacks — var(--border,#2a2a2a)/var(--danger,#e5484d)/var(--accent,#6ee7b7) (`memory-list.tsx:15-16`) — tokens win, hex is only a fallback. Loading (`memory-panel.tsx:71`) and empty (`memory-list.tsx:30`) states handled; needs-workspace guard at `memory-panel.tsx:58`. No explicit mobile breakpoints and no fixed-height scroll container for the list, but take(200) caps row count so no unbounded growth.

**Strengths**

- Convex hygiene is textbook: 100% args validators, zero bare .collect(), .withIndex/.withSearchIndex everywhere, requireUser + requireWorkspaceRole authz inside every handler with ownership re-checks before patch
- CRUD complete with append/archive-only soft-delete that is deliberate and documented (curation + tool-remove + UI-remove all archive; pinned rows bypass curation)
- Prompt-injection hardened: stripFence() strips &lt;memory-context&gt; tags at every write boundary (`memory.ts:39,101`; `memoryAutoSummary.ts:55`) and the injected block carries an explicit 'System note ... NOT new user input' guard (`memory.ts:21`)
- Small, single-responsibility files (all &lt;130 lines; list extracted from panel) and fully wired end-to-end — registry tools (`toolHandlers.ts:29-30`, `toolRegistry.ts:36`), cron (`crons.ts:7`), threads.sendMessage hook (`threads.ts:159`), callForUser injection gated by memoryEnabled (`callForUser.ts:76-79`)
- Auto-summarize is correctly off-turn scheduled (never inline), opt-in default-OFF so it never silently spends the user's BYOK, and watermark-bounded (`memoryAutoSummary.ts:77,87-88`)

**Critiques**

- 🟠 MED — Barrel comment version is stale — `index.ts` still says 'memory v0.1.0' while the trio (`slice.json`/manifest/contract) is all 0.2.0. This is exactly the barrel-comment version-match the rr criteria flag. <br/>↳ `web/frontend/slices/memory/index.ts:1`
- 🟠 MED — lastRecalledAt and recallCount are declared but NEVER written anywhere — dead columns. Curation's staleness ('no recall in 90d') actually keys off updatedAt/createdAt because lastRecalledAt is always undefined, so a summary that is actively recalled every turn but not re-summarized gets archived at 90d despite real use; the comment misrepresents behavior. <br/>↳ `web/convex/memoryCuration.ts:32` (read) vs no writer; declared `web/convex/features/memory/tables.ts:21-22`
- 🟡 LOW — 'agent' scope is advertised (schema comment, `slice.json` description, BUDGET.agent=2200) but has no read or write path — _buildContext only injects user+workspace scopes and nothing inserts scope='agent'. Advertised surface is non-functional/reserved. <br/>↳ `web/convex/memory.ts:9,17-18` vs `web/convex/features/memory/tables.ts:11-12`
- 🟡 LOW — UI addMemory skips the per-scope char-budget guard that the agent tool _toolWrite enforces — the UI can push the user scope over BUDGET.user (BudgetBar just turns red). Inconsistent trust-boundary behavior between the two write paths; not data loss. <br/>↳ `web/convex/memory.ts:97-104` (no budget check) vs `memory.ts:42-43` (enforced)
- 🟡 LOW — _toolSearch applies active() AFTER take(8), so archived rows consume slots and recall can return fewer than 8 (or 0) active hits even when more active matches exist. The search index's 'archived' filterField goes unused. <br/>↳ `web/convex/memory.ts:53-54`; index at `web/convex/features/memory/tables.ts:31`

**Suggestions**

- `S` Bump `index.ts` barrel comment from 'memory v0.1.0' to v0.2.0 to match the trio.
- `S` Either write lastRecalledAt/recallCount (patch them in _buildContext when a summary is recalled) or drop the two columns and re-word the curation staleness comment to say it keys off updatedAt/createdAt.
- `S` Add the same budget guard to UI addMemory (`memory.ts:97`) that _toolWrite uses, or explicitly document that UI add is intentionally unbudgeted.
- `M` Either implement agent-scope recall in _buildContext (read by scope='agent' + agentId) or delete BUDGET.agent and the agent-scope mentions from `schema/slice.json` until the phase lands, so the advertised surface matches reality.
- `S` In _toolSearch, add an archived filter to the search query (or take(16) then active().slice(0,8)) so archived rows don't crowd out active recall hits.

---

### scheduled-agents

**Score 87 · Grade B** — Tight, secure, well-documented cron slice — Convex rules fully honored and files tiny; held to B by toggle-only Update (no cadence edit), raw-HTML UI (project baseline), and a couple of minor metadata/doc drifts.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Entity = agentSchedules. Full C/R/D + partial U. Internal cron halves _claimDue (line 81, claims by stamping lastRunAt up front) + _markRun (line 93) are internalMutation, not client CRUD. The toggle-only Update is the one real gap: changing a schedule's interval or prompt requires delete+recreate, which resets last-run history. Reasonable minimalism but genuinely incomplete for a 'schedule' where tweaking cadence is common.

- **rr conventions:** PASS (with 1 minor). Trio present + version-matched at 0.1.0: `slice.json`, `slice.manifest.json`, `slice.contract.ts`, and barrel comment (`index.ts:1` 'scheduled-agents v0.1.0'). Barrel-only cross-slice import: card imports `@/features/workspaces` (`schedules-card.tsx:9`), no deep `@/features/x/lib/...`. File-size cap: all tiny — `scheduledAgents.ts` 100, `schedules-card.tsx` 96, `scheduledAgentsRun.ts` 30, `tables.ts` 24 (all &lt;200). SRP clean: DB halves in default-runtime module, model call isolated in 'use node' `scheduledAgentsRun.ts`, one UI component. MINOR: `slice.json:15` declares `"configExport":"scheduledAgentsConfig"` but the barrel (`index.ts`) exports only SchedulesCard — that config export does not exist.
- **Convex rules:** PASS. Args validators on all 6 fns: list/create/toggle/remove/_claimDue({})/_markRun all declare args with v.* (`scheduledAgents.ts:21,30,57,66,83,94`). No bare .collect() — list uses .withIndex('by_ws').take(100) (line 24), _claimDue uses .withIndex('by_enabled').take(50) (line 85). Server-side authz INSIDE every client mutation: requireWorkspaceRole('member') + ownedSchedule creator-or-admin guard on create/toggle/remove (lines 32,59-60,68-72); list requires 'viewer' (line 23); internal _claimDue/_markRun correctly skip authz (internalMutation, cron-only). .withIndex on all reads. runDue try/catch per schedule so one failure doesn't abort the sweep (`scheduledAgentsRun.ts:19-27`).
- **UI rules:** PARTIAL. Theme tokens honored — class tokens (card/sub/muted/btn accent/link danger), no hex in the component. BUT uses raw `&lt;select&gt;` (`schedules-card.tsx:54`), `&lt;input type=number&gt;` (60), `&lt;textarea&gt;` (63), `&lt;button&gt;` (66,83,84) instead of shadcn primitives — violates 'shadcn primitives only'. This is consistent with the project-wide plain-CSS baseline (CLAUDE.md snapshot: shadcn does NOT exist yet), so it's a known project gap not a slice regression. Loading/empty/no-agents states all handled (49,89-93). No explicit mobile-first `md:`/`lg:` breakpoints — relies on global .row/.col classes.

**Strengths**

- Excellent, honestly-documented security model: schedules run AS creator under that creator's workspace creds — create requires you own the agent (line 37-38), toggle/remove require creator-or-admin (ownedSchedule, line 48-54); route gate never trusted
- Spend is bounded three ways and documented: enabled-gate + 15-min interval floor (clamped server-side, line 11/42) + 50-row global claim cap
- OCC-safe cron: _claimDue stamps lastRunAt=now BEFORE running (line 87) so a slow/failed run isn't re-picked by the next tick; reuses the single callForUser cred pipeline instead of forking it
- All files tiny and single-purpose; clean DB-half vs 'use node' action split so callForUser can be imported only where needed
- Trust-boundary validation: prompt trimmed+capped 4000 + empty rejected (line 33-34), interval clamped, idempotent delete, per-run try/catch records error status

**Critiques**

- 🟠 MED — Update is toggle-only: no mutation edits an existing schedule's prompt, interval, or agent — the only way to change cadence is delete+recreate, which throws away lastRun history. CRUD-incomplete for a schedule entity where tweaking interval is a normal operation. <br/>↳ `web/convex/scheduledAgents.ts:56` (toggle patches only {enabled,updatedAt}); no update/edit mutation exists
- 🟡 LOW — Claim-before-run means a run silently vanishes on action crash: _claimDue commits lastRunAt=now, then if runDue's node action times out/crashes before _markRun, the row shows a fresh lastRunAt but a STALE lastStatus/lastResult — the skipped run surfaces no error to the user. <br/>↳ `web/convex/scheduledAgentsRun.ts:15` (claim) vs :27 (_markRun only on completion)
- 🟡 LOW — Global 50-row claim cap can starve schedules at scale: _claimDue scans enabled rows across ALL workspaces via by_enabled and take(50), so if &gt;50 enabled schedules are perpetually due, later-created ones never run. Documented as a spend bound but it's also a fairness ceiling. <br/>↳ `web/convex/scheduledAgents.ts:85`
- 🟡 LOW — enabled-semantics mismatch: view() treats enabled!==false as enabled (undefined→enabled in UI, line 15) but the cron only sweeps enabled===true (line 85). No rows with undefined enabled are created today (create sets true), so latent — but a manually-inserted/undefined row would show 'enabled' in UI yet never fire. <br/>↳ `web/convex/scheduledAgents.ts:15` vs :85
- 🟡 LOW — Metadata/doc drift: `slice.json:15` declares configExport 'scheduledAgentsConfig' that the barrel never exports; `slice.json` description says 'A minute-tick cron' while `crons.ts` and the manifest say a 5-min interval. <br/>↳ `web/frontend/slices/scheduled-agents/slice.json:8,15` vs `convex/crons.ts:9`

**Suggestions**

- `M` Add an `update` mutation (workspaceId, scheduleId, prompt?, everyMinutes?) reusing ownedSchedule + clampInterval, so cadence/prompt edits don't require delete+recreate and losing last-run history.
- `S` On action-level failure in runDue (or a stale-claim reaper), call _markRun with status='error' so a crashed run doesn't leave a fresh lastRunAt paired with a stale 'ok' status.
- `S` Fix `slice.json`: remove the nonexistent `configExport: scheduledAgentsConfig` (or add the export), and change the description's 'minute-tick' to '5-min' to match `crons.ts` + the manifest.
- `S` Make cron sweep semantics match the UI: query enabled with the same not-false intent, or normalize by never writing undefined enabled (already true) and treating undefined as disabled in view() to be safe.

---

### memory-graph

**Score 86 · Grade B** — Strong, highly-modular, genuinely portable frontend slice — trio + version + barrel + file-cap all green; main real gap is that the 'add child' UI promises a memory hierarchy the flat backend silently flattens, plus Update is pin-only.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Slice owns NO table by design (frontend-only view over the memory + agentDefs slices — `slice.json:10`, manifest notes). For the memory entity: C=addMemory, R=listMemories, U=pinMemory (pin only), D=removeMemory (archive). Agents/skills/tools are intentional read-only mirrors (n/a for C/U/D). CRUD is Create/Read/Delete-complete; Update is pin-only.

- **rr conventions:** PASS (strong). Trio present + version-matched 0.2.0: `slice.json:4`, `slice.manifest.json:4`, `slice.contract.ts:21`, and barrel comment `index.ts:1` ('memory-graph v0.2.0'). Barrel-only: no deep @/features/x/lib imports (grep clean); consumer imports via @/features/memory-graph (`app/app/page.tsx:27`). File-size cap honored — largest source `control-panel.tsx`=136, `memory-graph.tsx`=134; `graph-styles.ts`=187 is an exempt CSS data export. SRP is exemplary: state (use-graph-state), imperative engine (use-graph-engine), physics, filters, links, model, import each isolated in their own file.
- **Convex rules:** n/a (frontend-only). No new Convex fn/table (`slice.json:10` tablesExport:null, contract provides.convex/tables:[]). For completeness I verified the adapter's upstream deps are compliant: `memory.ts` listMemories/addMemory/pinMemory/removeMemory all have v.* args validators (`memory.ts:62,84,98,107`), call requireUser/requireWorkspaceRole inside the handler (`memory.ts:64,86,100,109`), and use .withIndex(...).take(200) not bare .collect() (`memory.ts:71,74`).
- **UI rules:** MIXED. Theme-token-driven: every colour derives from host --bg/--fg/--accent via --mg-* vars with hex fallbacks, flips light/dark with the app, and ships @media(prefers-reduced-motion) + :focus-visible outlines (`graph-styles.ts:8-27,171,186`) — good a11y. Deviation from 'shadcn primitives only': uses raw &lt;button&gt;/&lt;input type=checkbox|range|file&gt;/&lt;textarea&gt; (`control-panel.tsx:16,27`; `graph-topbar.tsx:22`; `composer.tsx:67`) — deliberate + documented (manifest notes: self-contained portable drop-in, no shadcn dep). Responsive is desktop-first max-width queries (960/680px) rather than the rr mobile-first climb, but panel starts closed on phones (`memory-graph.tsx:57`). Full-height + internal overflow:auto handled (`graph-styles.ts:19,124`).

**Strengths**

- Exemplary file modularity + SRP: every concern (state, engine, physics, filters, links, model, import) is its own &lt;200-line file — a textbook rr slice layout
- Clean portability split: pure props-driven Convex-free &lt;MemoryGraph&gt; renderer + an explicitly consumer-locked adapter; forbiddenTerms (rahmanef) honored in the renderer, all copy overridable via labels
- Trio complete and version-matched (0.2.0) across `slice.json`/manifest/contract/barrel
- Theme-token CSS with light/dark support, reduced-motion, focus-visible outlines, and per-consumer --mg-* overrides
- Solid safety upstream: soft-delete (archive) not hard delete, auth-gated queries, position-preserving reseed so refetches never make the graph jump (`graph-model.ts:37-45`)

**Critiques**

- 🟠 MED — 'Add memory under X' affords a hierarchy the backend can't persist: adapter onAddMemory ignores parentId and addMemory has no parent field, so nested sub-memories flatten back to the 'memories' cluster on refetch — the parent intent is silently lost (text is preserved, so no data loss). <br/>↳ `use-graph-data.ts:51` (onAddMemory drops parentId) vs `memory.ts:97-104` (addMemory args = {text} only)
- 🟠 MED — Update is pin-only — the inspector shows body read-only with no edit affordance; a user cannot correct a memory's text from the graph, only pin/unpin or delete. <br/>↳ `inspector.tsx:33,45-50` (no edit action); `use-graph-data.ts` exposes no onEditMemory
- 🟡 LOW — Raw HTML form controls instead of shadcn primitives (documented portability deviation, but still an rr-UI-rule miss). <br/>↳ `control-panel.tsx:16,27`; `composer.tsx:67`; `graph-topbar.tsx:22`
- 🟡 LOW — Node-type accent colours are hardcoded hex, not theme tokens (agent/skill/tool + slider knob #fff + danger #ff7a68). <br/>↳ `graph-styles.ts:14,119,148,157`
- 🟡 LOW — `as never` cast to strip the Id&lt;'memories'&gt; type when forwarding the sliced node id to remove/pin — works but bypasses type safety. <br/>↳ `use-graph-data.ts:55,58`

**Suggestions**

- `M` Either persist the sub-memory parent (add optional parentId to addMemory + a by_parent index) or drop the 'Add child under X' affordance for memory nodes so the UI doesn't promise a hierarchy the store discards.
- `S` Add an onEditMemory handler + inline edit in the inspector to make Update complete (currently pin-only).
- `S` Promote the three node-type accent hexes (#5aa9ff/#b48bff/#3fd6ad) to overridable --mg-agent/--mg-skill/--mg-tool defaults sourced from theme tokens where the host defines them.
- `S` Replace `as never` with a typed helper (e.g. cast once to Id&lt;'memories'&gt;) so the id boundary stays type-checked.

---

### channels

**Score 86 · Grade B** — Backend is A-grade (flawless Convex compliance + strong crypto/abuse defense); dinged to a solid B by a missing cascade-delete, a setModel path that's implemented server-side but never surfaced in the UI, and the app-wide non-shadcn plain-CSS UI.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>_(auditor left the CRUD block blank — reconstructed from its own findings)_ Create=`createChannel`; Read=`listChannels`+health; Update=partial (`setEnabled`/agent-`bind` only, no full edit / setModel is stubbed); Delete=`deleteChannel` exists **but does no cascade cleanup** (orphans channelIdentities/threads/messages — see critiques).

- **rr conventions:** Trio present + version-matched (`slice.json` / `slice.manifest.json` / `slice.contract.ts` all 0.1.0; barrel `index.ts` carries the "channels v0.1.0" comment). Barrel-only cross-slice import: `channels-card.tsx:11` pulls useWorkspace from @/features/workspaces (barrel), no deep @/features/x/lib reaches. SRP is strong — core CRUD (channelsCore), access policy (channelsAccess), DB-half ingest (channelsIngest), model turn (channelsDispatch), and one file per platform adapter. 200-line cap: PASS, largest is `channelsCore.ts` at 148 lines (all 11 files &lt;200). Two metadata drifts: (1) `slice.contract.ts:24-28` provides.convex omits channelsCore.setModel which exists at `channelsCore.ts:103`; (2) `slice.json:16` deps.env=[] but `slice.manifest.json:8` declares env ["MODELS_ENC_KEY"] — inconsistent env manifests.
- **Convex rules:** PASS, exemplary. Args validators on ALL public + internal fns (verified each: listChannels/createChannel/setEnabled/bindAgent/setModel/rotateSecret/deleteChannel in `channelsCore.ts`; setAccessPolicy/setSenderAllowed/listSenders in `channelsAccess.ts`; the 4 webhook ingest actions + setWebhook/verify/dispatch — every one has args:{} with v.*). NO bare .collect() anywhere (grep clean) — all reads use .withIndex(...).take(N)/.first()/.unique(): listChannels by_ws take(50), listSenders by_channel_external take(50), dedupe by_dedupe.first(), history by_thread take(20), pruneEvents by_at take(200). Server-side authz inside every write: createChannel→requireWorkspaceRole 'admin' (`channelsCore.ts:73`); setEnabled/bindAgent/setModel/rotateSecret/deleteChannel/setAccessPolicy/setSenderAllowed→requireChannelAdmin (re-derives workspace+role from the row, `channelsCore.ts:86-91`); reads→requireWorkspaceRole 'viewer'. Webhook ingest actions are public-by-design but auth = per-platform signature verify (constant-time) INSIDE the action + internal.rateLimit.hit spend-guard BEFORE any callForUser; internal DB mutations are properly internalMutation. pruneEvents cron IS wired (`crons.ts:8`, 12h). setWebhook action uses requireWorkspaceRoleAction 'admin'.
- **UI rules:** Weakest axis. Raw &lt;button&gt;/&lt;select&gt;/&lt;input&gt;/&lt;option&gt; throughout `channels-card.tsx` (46-102) and `channel-access.tsx` (24-42) — NOT shadcn primitives (ResponsiveDialog/Select/etc). This matches the app-wide plain-CSS baseline (a known, tracked gap per CLAUDE.md, not introduced by this slice), but it is a UI-rule miss. Delete uses native confirm() (`channels-card.tsx:102`) not a ResponsiveDialog. Mostly token-driven classes (card/sub/btn/link/mono/muted/danger); one hex leak as a CSS-var fallback: borderTop "1px solid var(--border, #333)" (`channel-access.tsx:21`). Responsive via flexWrap/flex-basis, no md:/lg: (no Tailwind). Field config is data-driven from `channel-kinds.ts` (good). Functional dead-end: setModel mutation exists but nothing in the UI calls it (grep: zero frontend refs), so a channel with no agent bound has no way to get a fallback model set via the card → it will always answer "not configured".

**Strengths**

- Convex compliance is essentially perfect: 100% args validators, zero bare .collect(), server-side authz on every mutation via requireChannelAdmin/requireWorkspaceRole, and .withIndex on every read
- Strong secret hygiene: per-kind bag AES-256-GCM at rest (`crypto.ts`), Telegram secret_token minted server-side + shown once + never re-stored plaintext, lastError scrubs bot-token pattern (`channelsIngest.ts:74`), constant-time signature compares (`channelsCrypto.ts`, channelTelegram verifyAndParse)
- Clean vertical-slice separation and single-responsibility files, all well under the 200-line cap; adapters share one model path (channelsDispatch.computeReply) so platforms can't diverge
- Layered abuse defense: per-sender + per-channel rate-limit spend-guard runs BEFORE callForUser, then an allowlist access gate (default-safe when unset) so a stranger can't drain owner provider tokens; denied senders get a one-time hint tracked via denyNotifiedAt
- Honest, detailed manifest notes that call out real limitations (Discord ~3s inline window, no Gateway free-form) instead of hiding them

**Critiques**

- 🟠 MED — deleteChannel does no cascade cleanup — deleting a channel orphans its channelIdentities, threads, and messages forever (channelEvents get cron-pruned by by_at, but the rest never do). Data-hygiene leak that grows unbounded per deleted channel. <br/>↳ `web/convex/channelsCore.ts:127-130`
- 🟠 MED — setModel is dead-ended: the mutation exists but no UI wires it, so a channel with no agent bound can never get a fallback config.model — such a channel always returns the 'not configured' hint and can never actually reply. Under-built path. <br/>↳ `web/convex/channelsCore.ts:103`; `web/frontend/slices/channels/components/channels-card.tsx` (no setModel call)
- 🟡 LOW — channelIdentities has no delete/purge — an owner can toggle allowed=false but can never remove a sender row; the recent-senders list only grows (bounded read take(50) hides but doesn't prune it). <br/>↳ `web/convex/channelsAccess.ts:46-54`
- 🟡 LOW — Every webhook request does a slug DB lookup + AES-GCM decrypt + signature verify BEFORE any throttle; the collected `ip` param is unused in all four adapters, so there is no pre-verify IP rate-limit — an attacker who learns a slug can force repeated decrypt/verify work. <br/>↳ `web/convex/channelTelegram.ts:67-72` (ip arg never referenced); `web/convex/channelSlack.ts:50-55`
- 🟡 LOW — Slice metadata drift: `slice.contract.ts` provides.convex omits channelsCore.setModel, and `slice.json` deps.env=[] disagrees with `slice.manifest.json` env=[MODELS_ENC_KEY]. <br/>↳ `web/frontend/slices/channels/slice.contract.ts:24`; `web/frontend/slices/channels/slice.json:16`

**Suggestions**

- `M` Make deleteChannel cascade: in the mutation, .withIndex-scan channelIdentities (by_channel_external) + channelEvents (by_channel_at) for the channel and delete them (batch take-loop); optionally delete the identities' threads/messages too. Prevents orphan accumulation.
- `S` Wire a fallback-model input in ChannelsCard that calls api.channelsCore.setModel for no-agent channels (or hide/disable the channel until an agent OR model is set), so a created channel can't sit permanently 'not configured'.
- `S` Add a 'remove sender' action (delete the channelIdentity) to channelsAccess + the ChannelAccess list, so owners can purge stale/abusive identities, not just deny them.
- `S` Either use the `ip` param for a pre-verify internal.rateLimit.hit throttle in each adapter, or drop the dead param from the action args and the route.
- `S` Reconcile metadata: add channelsCore.setModel to `slice.contract.ts` provides.convex and set `slice.json` deps.env to [MODELS_ENC_KEY] to match the manifest.

---

### mcp-server-inbound

**Score 85 · Grade B** — Security-first, tightly-scoped MCP inbound layer that nails the hard parts (hashed secrets, PKCE, correct IP trust, per-call workspace re-check) — dinged only by unbounded auth-code/client growth and a couple of uncapped per-user collects; solid B.

**CRUD:** C ✓ · R ✓ · U ◐ · D ◐
<br/>mcpTokens CRUD is complete-by-design (soft revoke is the right semantic for bearer tokens). mcpClients is create+read only — no way to revoke/prune a registered OAuth client (open registration means the table only grows). mcpAuthCodes is ephemeral single-use but has NO sweep cron unlike rateLimits, so consumed rows accumulate unbounded.

- **rr conventions:** NOT a slice — this is cross-cutting infra living in convex/ root (`mcp.ts`, `mcpNode.ts`, `mcpOauth.ts`, `mcpOauthNode.ts`, `rateLimit.ts`), not convex/features/&lt;slug&gt;/ with a `slice.json`/manifest/contract trio; no trio expected here, consistent with CLAUDE.md's tracked pre-slice state. File-size cap: PASS — all five files tiny (61/96/39/68/40 lines, far under 200). SRP: EXCELLENT — clean deterministic-vs-"use node" split (`mcp.ts` deterministic token store / `mcpNode.ts` crypto+dispatch; `mcpOauth.ts` deterministic / `mcpOauthNode.ts` PKCE minting); `rateLimit.ts` single-purpose. Imports: local only (./toolRegistry, ./toolHandlers, ./_shared/auth) — no deep @/features/x/lib/... reaches. Minor portability nit for a would-be lift: hardcoded "models-gateway" serverInfo fallback (`mcpNode.ts:70`) and "models-rahmanef" in the UI config snippet (`mcp.tsx:58`).
- **Convex rules:** STRONG. Args validators: 100% — every public fn declares args:{} with v.* (issueMcpToken, rpc, registerClient, createAuthCode, exchangeCode, listMcpTokens, revokeMcpToken, revokeAllMcpTokens, clientInfo) plus all internal fns; rpc uses request:v.any() which is acceptable JSON-RPC passthrough. Authz: server-side inside every mutation — revokeMcpToken requireUser + ownership check (`mcp.ts:40-42`), revokeAllMcpTokens requireUser (`mcp.ts:52`), issueMcpToken requireUser+resolveWorkspaceAction (`mcpNode.ts:23-24`), createAuthCode requireUser (`mcpOauthNode.ts:40`); rpc validates bearer by sha256 hash then RE-CHECKS workspace membership every call (`mcpNode.ts:51-63`) — kills a removed member's live token instantly; registerClient/exchangeCode are correctly unauthenticated-by-design (open DCR + code exchange) but IP-rate-limited. withIndex on all queries (by_hash/by_user/by_clientId/by_codeHash/by_key/by_reset). ISSUE: two uncapped .withIndex(...).collect() calls — listMcpTokens (`mcp.ts:32`) and revokeAllMcpTokens (`mcp.ts:53`); per-user scoped so bounded in practice, but issueMcpToken has no per-user token cap, so a user can mint unbounded tokens and the collect scans all of them — technically violates the "use .take(N)" rule.
- **UI rules:** Frontend = McpCard (`app/app/_components/mcp.tsx`) + OAuth consent page (`app/oauth/authorize/page.tsx`). Uses raw &lt;button&gt;/&lt;input&gt;/&lt;section&gt;/&lt;pre&gt; and browser confirm() (`mcp.tsx:25-40`) rather than shadcn primitives (ResponsiveDialog etc.) — but this is the codebase-wide pre-shadcn plain-CSS pattern documented in CLAUDE.md, not a fresh regression, so consistent/low-severity. GOOD: theme-token classNames (card/btn accent/link danger/mono muted), no hardcoded hex; next/link used correctly on the authorize page; token shown-once UX with clear "copy now" warning (`mcp.tsx:32`); revoke-all guarded by confirm; consent page validates the request BEFORE touching redirect_uri (authorize `page.tsx:31-32`) — no open redirect. WEAK: heavy inline styles + `as any` casts (`mcp.tsx:26,48`); not clearly mobile-first (relies on .row flex).

**Strengths**

- Security engineering is A-tier: tokens/codes stored only as sha256 (raw shown once), PKCE S256 mandatory, redirect_uri pre-registration enforced server-side, single-use codes with 60s TTL bound to client+challenge, opaque invalid_grant errors that never echo internals
- Correct, non-obvious IP handling for rate limiting — trusts x-real-ip / RIGHTMOST XFF hop, explicitly rejecting the client-forgeable leftmost entry (`lib/origin.ts:26-35`); pre-auth IP flood guard runs before token validation (`mcpNode.ts:48`)
- Workspace membership re-checked on every rpc call (`mcpNode.ts:58-63`) so a bearer dies the instant its owner is removed — route gates alone would miss this
- Clean deterministic/'use node' file split keeps every file well under the 200-line cap with tight single-responsibility modules
- Lock-free rate limiter leans on Convex OCC serializability instead of pulling a dependency, with a bounded GC cron and honest ponytail notes about the fixed-window 2x edge (`rateLimit.ts:1-8`)

**Critiques**

- 🟠 MED — mcpAuthCodes has NO garbage-collection cron (unlike rateLimits which gets rateLimit.sweep). Consumed/expired codes are only marked used:true and never deleted, so the table grows unbounded with every OAuth exchange — inconsistent given `crons.ts` sweeps rateLimits + prunes channels/audit. <br/>↳ `convex/mcpOauth.ts:31-38` marks used never deletes; `convex/crons.ts` has no mcpAuthCodes sweep
- 🟡 LOW — No per-user cap on issued MCP tokens, and listMcpTokens/revokeAllMcpTokens use uncapped .withIndex(by_user).collect(). A user (or compromised session) can mint arbitrarily many tokens; the collect then scans all of them, violating the no-bare-collect rule. <br/>↳ `convex/mcp.ts:32,53`; issueMcpToken has no count guard at `convex/mcpNode.ts:20`
- 🟡 LOW — mcpClients is create+read only — no revoke/delete (RFC 7592 unimplemented) and registration is open (rate-limited 10/hr/IP). Abandoned or abusive DCR clients accumulate permanently with no admin visibility or pruning path. <br/>↳ `convex/mcpOauth.ts:6-23` register+read only; `convex/mcpOauthNode.ts:22` open registration
- 🟡 LOW — OAuth-minted tokens store no workspaceId, so they always fall back to the owner's PERSONAL workspace in rpc (_ensurePersonalFor) — an OAuth client can never act in a selected non-personal workspace. Reasonable limitation but undocumented for the OAuth path. <br/>↳ `convex/mcpOauthNode.ts:65` passes no workspaceId -&gt; `convex/mcpNode.ts:61-63`
- 🟡 LOW — UI uses raw &lt;button&gt;/&lt;input&gt; and browser confirm() instead of shadcn primitives, plus `as any` casts on workspaceId/token id. Consistent with the documented pre-shadcn codebase, but a lift blocker if this becomes a portable slice. <br/>↳ `app/app/_components/mcp.tsx:25-26,40,48`

**Suggestions**

- `S` Add an internal.mcpOauth.sweepAuthCodes internalMutation (new by_expiresAt index, .take(1000), delete) and wire it into `crons.ts` on a 6h interval — mirror rateLimit.sweep so mcpAuthCodes stays bounded.
- `S` Cap tokens-per-user in issueMcpToken (count active via by_user .take(51), reject beyond ~50) and swap the two listMcpTokens/revokeAllMcpTokens .collect() calls to .take(N) to satisfy the no-bare-collect rule.
- `M` Expose mcpClients revoke: a revokeMcpClient mutation (owner/admin only) plus a small admin list, so stale/abusive DCR registrations can be pruned; today the only mitigation is the IP rate limit.
- `S` Document (or lift into a props/label) the two hardcoded consumer strings — 'models-gateway' serverInfo fallback and 'models-rahmanef' in the client-config snippet — before packaging as a slice.

---

### skills-tools-registry

**Score 85 · Grade B** — Clean, well-factored cross-cutting registry — single source of truth for both tool surfaces, tiny files, upstream authz correct; main ding is that the declared inputSchema isn't fully enforced on the MCP path (safe today via downstream validators, but over-promised).

**CRUD:** C – · R ✓ · U – · D –
<br/>The two entities this feature owns — tool metadata (TOOL_REGISTRY, `toolRegistry.ts:18`) and skill metadata (SKILLS_REGISTRY, `skillsRegistry.ts:5`) — are compile-time source constants, NOT Convex tables. Append-only-by-design: you edit the arrays; there is correctly no create/update/delete mutation. READ is exposed via listToolRegistry + listSkillsRegistry queries (`agentDefs.ts:47,53`) and direct imports across 5 consumers (`chat.ts`, `channelsDispatch.ts`, `chatTools.ts`, `mcpNode.ts`, `agentDefs.ts`). `toolHandlers.ts` owns NO entity itself — it delegates CRUD of OTHER features' entities (credentials.providersForUser, usage.usageForUser, memory._toolWrite/_toolSearch, agentDefs.listForUser), each of which has its own validators. CRUD is complete for what this feature is: a read-only static registry + a dispatch layer.

- **rr conventions:** NOT a slice (cross-cutting infra) — no metadata trio expected, correctly absent. File-size cap: PASS, all three tiny (skillsRegistry 15, toolRegistry 51, toolHandlers 35). SRP: PASS and notably good — metadata (plain runtime) is deliberately split from handlers ("use node") so plain-runtime callers (agentDefs validation, UI registry query) never drag node/ai-sdk deps (`toolRegistry.ts:1-5` rationale). Each derived-export cluster (SKILL_IDS; TOOL_IDS/AGENT_TOOLS/AGENT_TOOL_IDS) is cohesive, counts as pure-data export. Imports: relative ./ only, no deep @/features/x/lib cross-slice reach. Clean.
- **Convex rules:** Solid. These 3 files declare NO Convex functions themselves — `toolHandlers.ts` ("use node") is a plain (ctx,userId,args)=&gt;value handler map, registries are constants. So args-validator/collect/index rules apply at the boundary files, which pass: the Read queries have args:{} (`agentDefs.ts:48,54`); the MCP entrypoint validates args:{token,request,ip} (`mcpNode.ts:40`) and re-checks token + per-call workspace membership every call (`mcpNode.ts:51-63`) — authz is enforced UPSTREAM, and every delegated internal fn is validated (memory._toolWrite args v.id/v.string, `memory.ts:27`; _toolSearch `memory.ts:51`; providersForUser/usageForUser are internalQuery). No bare .collect() here or downstream (memory uses .withIndex(...).take(200/8)). The one gap: the registry-declared inputSchema (enums/types/additionalProperties) is NOT enforced on the MCP path — `mcpNode.ts:84-85` only checks required keys are non-null, so e.g. memory op enum is advisory; _toolWrite just branches op==='remove' else treats as add (`memory.ts:30-38`). Not a hole (downstream mutation is safe) but the schema is over-promised.
- **UI rules:** n/a (backend-only)

**Strengths**

- One registry, two surfaces derive from it (agent via chatTools.gatewayTools, MCP via mcpNode) — structurally impossible for the two tool surfaces to diverge; documented rationale at `toolRegistry.ts:1-5`
- Metadata/handler split by runtime: plain-runtime toolRegistry vs 'use node' toolHandlers lets validation + UI queries import tool ids without pulling ai-sdk/node deps
- Explicit userId+workspaceId threading (not getAuthUserId) is exactly what lets ONE handler serve both authed-agent and token-MCP paths; authz enforced upstream with per-call membership recheck (`mcpNode.ts:59`)
- surfaces:[] tagging + derived AGENT_TOOLS cleanly gates the spend-capable `chat` tool off the agent picker (`toolRegistry.ts:48-51`)
- Files are tiny, single-purpose, well under the 200-line cap; good defensive defaults in get_model_catalog (30-cap, optional chaining) and list_my_agents

**Critiques**

- 🟠 MED — Registry advertises full JSON-Schema inputSchema (enums, types, additionalProperties:false) but the MCP surface only validates that required keys are non-null — enum/type constraints are never enforced at the MCP boundary, delegated entirely to downstream mutations. The registry over-promises a contract it does not guarantee per-surface. <br/>↳ `toolRegistry.ts:34` (op enum ['add','remove']) vs `mcpNode.ts:84-85` (required-keys-only check) + `toolHandlers.ts:29` (String coercion, no enum check)
- 🟡 LOW — Pervasive `any` at the tool-dispatch trust boundary (ToolHandler signature + every handler param) defeats TS-strict guarantees exactly where arg shapes and internal refs should be typed; a wrong arg shape or typo'd internal.* ref would not be caught at compile time. <br/>↳ `toolHandlers.ts:12` (ctx:any,userId:any,args:any,workspaceId:any) and bodies 15-34
- 🟡 LOW — `memory` handler defaults op to 'add' when missing (String(args?.op ?? 'add')) — a missing/malformed op silently becomes a write rather than an error. Dead on both surfaces today (required-key check upstream), but a latent silent-write footgun if a surface ever skips the check. <br/>↳ `toolHandlers.ts:29`
- 🟡 LOW — `chat` handler reads args.model/args.prompt non-optionally and String()-coerces; if ever invoked with args lacking them it sends the literal string 'undefined' to the model instead of erroring (relies on upstream required-key gate). <br/>↳ `toolHandlers.ts:32`

**Suggestions**

- `S` In mcpNode tools/call, validate args against entry.inputSchema (enum/type) not just required keys — reuse the same jsonSchema()/ajv the agent surface already gets from AI-SDK, so both surfaces enforce the registry contract identically.
- `S` Drop the `op ?? 'add'` fallback in the memory handler; let a missing op surface as an explicit error so the registry's required+enum contract is honored end-to-end.
- `M` Type ToolHandler args per-tool (or infer from inputSchema) instead of `any` — even a small hand-written arg-type union per handler restores compile-time safety at the dispatch boundary without adding a runtime dep.

---

### auth-oauth

**Score 85 · Grade B** — Clean, secure, convention-abiding OAuth/BYOK-connect layer — validators, per-action requireUser, encrypted-at-rest tokens, all indexed, no bare collects; docked only for missing oauthFlows TTL, a rough device-code-expired path, and a few minor SRP/settings gaps. Solid B.

**CRUD:** C ✓ · R ✓ · U ✓ · D ◐
<br/>oauthFlows: full ephemeral CRUD, append-bounded to 1 row/(user,provider). settings: upsert+read, delete n/a (singleton reset by patch). oauth credentials: create+read+refresh here, delete delegated to credentials feature (present, not missing). auth session: convexAuth handles signIn/signOut/store, loggedInUser=read. All owned entities CRUD-complete for their nature.

- **rr conventions:** NOT a slice — files live at convex/ root (`auth.ts`, `auth.config.ts`, `oauth.ts`, `settings.ts`), not convex/features/&lt;slug&gt;/ or frontend/slices/. No metadata trio expected for this cross-cutting concern. File-size cap: all pass (`oauth.ts` 185, `settings.ts` 48, `auth.ts` 16, `auth.config.ts` 8 — all &lt;200). Imports: siblings only (./codexLib, ./claudeLib, ./crypto, ./_shared/auth, ./credentials) — no deep cross-slice reach. SRP: `settings.ts` cohesive (per-user settings). `oauth.ts` mildly overloaded — bundles 3 distinct provider integrations (Codex device-code, OpenRouter PKCE, Claude manual-paste) plus an inline pkce() (`oauth.ts:106-110`) that duplicates claudePkce from claudeLib; acceptable under cap but a split candidate if more providers land.
- **Convex rules:** STRONG. Args validators: every public fn declares args — `auth.ts:10` args{}, `oauth.ts` all 7 actions (:34,52,89,113,124,146,156) validated, `settings.ts` all (:11,21,32) validated, internals (:12,20,24,42) validated. Authz: every action gates on requireUser BEFORE hitting a provider or store (`oauth.ts:36,54,91,115,127,149,159`; `settings.ts:23,34`); flow-state internalMutations take server-derived userId only (never client) — correct internal pattern documented at `oauth.ts:2`. Indexes: all queries use .withIndex — by_user_provider (`oauth.ts:15,22,27`) and by_user (`settings.ts:15,24,35,45`). No bare .collect() in any scope file (only .unique()/.first() on indexed queries). loggedInUser/mySettings correctly use getAuthUserId + graceful null for logged-out reads.
- **UI rules:** Minimal — the only in-scope frontend surface is the OpenRouter callback route handler (`app/oauth/openrouter/callback/route.ts`), a server-side GET that exchanges the code and NextResponse.redirect()s back to /app. No rendered components, so shadcn/theme-token/responsive rules are n/a here. Good detail: uses shared publicOrigin(req) resolver instead of req.nextUrl.origin (`route.ts:11-14`) to fix the standalone-build 0.0.0.0 origin bug; failures redirect to ?connect=error rather than leaking. Connect/disconnect buttons themselves live in the dashboard (out of scope).

**Strengths**

- Every public action/query/mutation carries v.* arg validators AND gates on requireUser before touching a provider endpoint or the credential store — textbook Convex authz with no route-gate reliance (`oauth.ts:36,54,91,115,127,149,159`)
- OAuth tokens/keys encrypted at rest via AES-256-GCM before persistence (encryptSecret at `oauth.ts:80,138,165`); ciphertext never returned to client; model-list reads decrypt server-side only and swallow errors to [] by design to avoid racing chat's single-use refresh token (`oauth.ts:87-88,95-100`)
- Flow-state CRUD keyed on server-derived userId via by_user_provider index; _setFlow deletes-then-inserts to keep exactly one row per (user,provider), so no unbounded growth (`oauth.ts:15-17`)
- Clean small files, all queries .withIndex, zero bare .collect() in scope; internalMutation flow helpers correctly unreachable from client
- publicOrigin resolver used in the callback to dodge the standalone-build origin bug, with a clear comment citing the prior fix (`route.ts:11-14`)

**Critiques**

- 🟠 MED — oauthFlows rows are never garbage-collected — no cron and no createdAt-based expiry, despite the 'short-lived' comment. `crons.ts` has zero references to oauthFlows. An abandoned Codex/OpenRouter/Claude flow leaves a PKCE verifier or device-code id per (user,provider) indefinitely (self-bounded to 1 each by _setFlow overwrite, so not unbounded, but stale secret material persists). <br/>↳ `web/convex/oauth.ts:12-30` (createdAt written but unused); `web/convex/schema.ts:170`; no match in `web/convex/crons.ts`
- 🟠 MED — Device-code expiry surfaces as a hard error, not a clean status. pollCodexLogin returns status 'expired' only when the flow row is missing; a provider-side expiry falls into the generic !poll.ok throw, so the browser polling loop gets a thrown ConvexError instead of a graceful 'expired' to render. <br/>↳ `web/convex/oauth.ts:56` (expired only if !deviceAuthId) vs `oauth.ts:64` (throw on !poll.ok)
- 🟡 LOW — SRP: `oauth.ts` folds three unrelated provider integrations plus its own inline pkce() that duplicates claudePkce from claudeLib. Under the 200-line cap but three distinct concerns in one file. <br/>↳ `web/convex/oauth.ts:32-102` (Codex), :104-142 (OpenRouter), :144-185 (Claude); inline pkce `oauth.ts:106-110` vs imported claudePkce `oauth.ts:9`
- 🟡 LOW — `settings.ts` cannot toggle memoryEnabled: it is a schema field documented 'default ON' but is absent from setSettings args and from DEFAULTS, so mySettings returns it as undefined (not true) and no mutation can set it. <br/>↳ `web/convex/settings.ts:8` (DEFAULTS) + :21 (args omit memoryEnabled) vs `web/convex/schema.ts:74`
- 🟡 LOW — No rate-limiting on the provider-hitting start actions; a rateLimits table exists in the app but is unused here, so an authed user can spam OpenAI/OpenRouter/Anthropic OAuth endpoints. <br/>↳ `web/convex/oauth.ts:33,112,146` (no rate-limit call) vs `schema.ts:174` rateLimits table
- 🟡 LOW — OpenRouter callback carries no CSRF state nonce; relies solely on the session-bound server-side verifier lookup (requireUser + by_user_provider). Safe in practice but no defense-in-depth state echo. <br/>↳ `web/app/oauth/openrouter/callback/route.ts:10-20` (only ?code read) + `web/convex/oauth.ts:128` (lookup by userId)

**Suggestions**

- `S` Add a cron in `crons.ts` (or a createdAt-age check inside _getFlow) to expire oauthFlows older than ~15 min, so abandoned PKCE/device-code secrets don't linger.
- `S` Return status:'expired' from pollCodexLogin when the provider signals device-code expiry instead of throwing, so the polling UI can show a clean expired state.
- `S` Add memoryEnabled to setSettings args and to DEFAULTS in `settings.ts` so the documented 'default ON' and its toggle actually take effect.
- `S` Wire the existing rateLimits table into startCodexLogin/startOpenRouterConnect/startClaudeConnect to cap per-user provider-handshake spam.
- `M` If more OAuth providers land, split `oauth.ts` into per-provider files (oauthCodex/oauthOpenRouter/oauthClaude) sharing a single flow-state module, and drop the inline pkce() in favor of one shared PKCE helper.

---

### dashboard-shell

**Score 85 · Grade B** — A clean, well-decomposed, token-themed app shell that honors the file-size cap and barrel-import rules and has strong a11y; held back from an A by client-only navigation state (no URL/deep-link sync despite a comment claiming it), a stale section-router.tsx reference, and a hardcoded models.dev URL.

**CRUD:** C – · R – · U – · D –
<br/>Cross-cutting UI shell — owns NO Convex data entities (backend:false), so table-CRUD is n/a. It owns two client-side state pieces: (1) navigation `section` — ephemeral useState, read=render / update=setSection+go() (`page.tsx:71,106`), no persistence by design; (2) theme preference — localStorage-backed via useTheme (`use-theme.ts:12-27`), create+read+update through the toggle, delete n/a (toggle-only, append/overwrite). Both are appropriately non-persisted; nothing is CRUD-incomplete here because the shell is a composition/routing layer, not a data owner.

- **rr conventions:** NOT a slice (cross-cutting app shell at web/app/app/_components) — metadata trio correctly absent, none expected. FILE-SIZE cap: PASS — largest shell file is `navigation-rail.tsx` (83), `page.tsx` 158, dashboard-shell 53, nav-config 84; every source file &lt;200 (workbench 185 / agents-card 181 are the repo-wide max, still under). IMPORTS: PASS — all cross-slice imports are barrel-only `@/features/*` (verified: grep for `@/features/x/lib/...` deep paths returns none), local imports via `./_components/*`. SRP: mostly clean (shell/rail/nav-config/dock/theme split cleanly), one smell — `page.tsx` `Dashboard` mixes auth-gate + catalog/model data-fetch + an 18-branch section→component if-chain (`page.tsx:117-155`). STALE COMMENT: `nav-config.ts:3-4` says section ids "MUST stay in sync with the switch in `section-router.tsx`", but `section-router.tsx` does not exist — the switch is the inline if-chain in `page.tsx`.
- **Convex rules:** n/a (frontend-only)
- **UI rules:** TOKENS: PASS — palette is CSS custom props (--bg/--fg/--accent...) in `globals.css:31-67` with a full light/dark set; zero inline hex in any shell component (verified by grep). SHADCN: N/A by documented project policy — shell uses raw &lt;button&gt; (navigation-rail, `dashboard-shell.tsx:42`, ai-dock) and raw &lt;input&gt; (`sign-in.tsx:28-29`); CLAUDE.md records plain-CSS/no-shadcn as a known gap, so not penalized as a defect. RESPONSIVE: PASS coverage (dock hidden &lt;900, rail→bottom bar + sidebar→strip &lt;640, grids collapse &lt;520) but it is desktop-first (base=desktop, max-width queries collapse down) which is inverted from the rr 'mobile-first' rule. FULL-HEIGHT/SCROLL: PASS — .dash-shell is height:100dvh with rail/sidebar/region/dock each overflow-y:auto independently, plus a `bleed` mode (padding:0, overflow:hidden) for the edge-to-edge memory graph. A11y is strong: aria-label/aria-current/role=menu, focus-visible rings (`globals.css:399`), reduced-motion, backdrop-dismiss popovers.

**Strengths**

- Clean decomposition — shell chrome / icon rail / nav data / AI dock / theme each in its own small single-purpose file, every one well under the 200-line cap
- Data-driven nav: groupsFor()/groupOfSection() derive the active rail group from a single `section` source of truth, so rail clicks, sidebar clicks and in-content go() all route through one setter
- All cross-slice imports are barrel-only (@/features/*) — no deep internal imports, the rr contract is honored
- Solid accessibility: aria-current/aria-label, role=menu/menuitem popovers, keyboard focus-visible rings, prefers-reduced-motion, click-outside backdrop dismiss
- Token-based theming with a pre-paint inline script guarding against light/dark FOUC on reload; no hex leaks into components

**Critiques**

- 🟠 MED — Navigation `section` lives only in React useState — reload, browser back/forward, and shared links all reset to 'overview'; there is no URL/route sync. Worse, `nav-config.ts:80` documents groupOfSection as driving 'deep-link restore', but nothing ever reads the section from the URL, so that capability is claimed but not wired. <br/>↳ `web/app/app/page.tsx:71,78`; `web/app/app/_components/nav-config.ts:80-84`
- 🟠 MED — Stale/misleading comment references a non-existent `section-router.tsx`; the real 18-way section→component mapping is an inline if-chain inside `page.tsx`'s Dashboard, which also mixes auth-gate + external catalog/model fetching + routing (three responsibilities in one component). <br/>↳ `web/app/app/_components/nav-config.ts:3-4`; `web/app/app/page.tsx:117-155`
- 🟡 LOW — Hardcoded external endpoint https:`//models.dev/api.json` baked into the shell — a portability/props-driven ding for code meant to become a droppable block; the fetch failure is also swallowed silently (.catch(()=&gt;{})), so an outage just leaves the model catalog empty with no signal. <br/>↳ `web/app/app/page.tsx:74`
- 🟡 LOW — CSS is desktop-first (base styles = desktop, max-width media queries collapse downward), inverted from the rr 'mobile-first, layer md:/lg: up' rule; and the theme storage key 'models-theme' is duplicated as a literal in the layout inline script and again in `use-theme.ts`, so a rename in one desyncs the FOUC guard. <br/>↳ `web/app/globals.css:242-261`; `web/app/layout.tsx:34`
- 🟡 LOW — Rail create/account popovers dismiss on backdrop click but have no Escape-key handler, a minor keyboard-a11y gap for an otherwise well-instrumented component. <br/>↳ `web/app/app/_components/navigation-rail.tsx:61`

**Suggestions**

- `S` Sync `section` to a URL search param (e.g. ?s=agents) via replaceState/useSearchParams and read it on mount — this makes reload, back/forward and deep links work and finally wires the groupOfSection 'restore' the comment already promises.
- `S` Resolve the `section-router.tsx` comment: either extract the `page.tsx` if-chain into an actual `section-router.tsx` (also trims Dashboard toward pure data+shell) or delete the dangling reference in `nav-config.ts`.
- `S` Lift the models.dev catalog URL to an env var / prop so the shell stays portable, and surface a small inline notice when the catalog fetch fails instead of silently rendering an empty model list.
- `S` Add Escape-to-close (and optionally focus-return) on the rail popovers to round out keyboard navigation.

---

### usage-rollups

**Score 84 · Grade B** — Clean, well-bounded ponytail-style slice — Convex rules fully honored (validators, no bare collect, indexed, correct authz layering) and trio complete; docked mainly for a missing prune/Delete path, no backfill for cron gaps, and acknowledged-but-silent truncation caps.

**CRUD:** C ✓ · R ✓ · U ✓ · D ✗
<br/>Owned entity workspaceUsageDaily: Create=yes (rollupDay insert, `usageRollups.ts:59`), Read=yes (workspaceUsage query, :66), Update=yes (rollupDay patch upsert via by_ws_day key, :58), Delete=NO — no prune/retention mutation exists; the table grows unbounded (one row per ws/day/provider/model forever) while every other cron in `crons.ts` prunes its table. Not append-only by design, so Delete is a genuine gap. In-scope app-provided entity `usage` (raw log, not owned by this slice per manifest:14): Create=yes (log internalMutation, `usage.ts:7`), Read=yes (myUsage/usageForUser/globalUsage, :42/:54/:62), Update=n/a (append-only log by design), Delete=no (also never pruned, minor).

- **rr conventions:** STRONG. Trio complete + version-matched at 0.1.0: `slice.json:4`, `slice.manifest.json:4`, `slice.contract.ts:19`, and barrel comment `index.ts:1` ('usage-rollups v0.1.0'). Barrel-only imports: `workspace-usage-card.tsx:7` imports @/features/workspaces (barrel), no deep @/features/x/lib/... reaches. SRP good — `tables.ts`=table def, `rates.ts`=cost cluster (RATES+rateFor+estCostUsd, cohesive), `usageRollups.ts`=cron+read. 200-line cap: all well under (`usageRollups.ts` 86, `usage.ts` 69, card 66, `rates.ts` 37). contract provides.convex correctly claims only usageRollups.* and does NOT claim `usage.ts` fns (those belong to a separate usage feature) — accurate scoping.
- **Convex rules:** STRONG PASS. Validators 6/6: rollupDay args:{} (:18), workspaceUsage {workspaceId,days?} (:67), log full v.* (`usage.ts:8`), myUsage {} , usageForUser {userId}, globalUsage {}. Zero bare .collect() — every read is .take(N) (rollupDay take(1000)/take(5000)/take(500); workspaceUsage take(2000); myUsage/globalUsage take(500)/(1000)). All filtered/ordered queries indexed: by_ws_at, by_ws_day, by_user_at, by_at. Authz on the ONE client-reachable query: workspaceUsage calls requireWorkspaceRole(viewer) (:69); globalUsage requireAdmin (`usage.ts:65`); myUsage self-scoped via getAuthUserId; rollupDay/log/usageForUser are internal* (not client-reachable) — correct. days clamped 1..90 (:70). Only nit: redundant .filter(r.day&gt;=cutoff) at :77 duplicates the index gte.
- **UI rules:** FUNCTIONAL, not shadcn. Card uses raw &lt;section&gt;/&lt;h2&gt;/&lt;p&gt;/&lt;div&gt;/&lt;span&gt; with CSS classes (card/sub/muted/mono), no shadcn primitives — but this matches the app-wide plain-CSS baseline (CLAUDE.md snapshot: shadcn absent) and the card has NO interactive raw &lt;button&gt;/&lt;input&gt;, so the strongest UI rule is not tripped. Theme-token-driven (className tokens) but with inline hex fallbacks var(--border,#2222)/var(--accent,#6a9) at :56-57 and heavy inline style objects. All three states handled well: no-workspace (:40), loading (:42), empty (:44). Bars are width-% so inherently responsive; no explicit md:/lg: but simple stacked card doesn't need them. `workspaceId as never` cast (:30) is a type escape hatch.

**Strengths**

- All 6 Convex fns have v.* arg validators; zero bare .collect() — every read is a bounded .take(N)
- Correct authz layering: client-facing workspaceUsage gates on requireWorkspaceRole(viewer); cron/log/usageForUser are internal-only
- Metadata trio complete + version-matched at 0.1.0 with barrel comment; barrel-only imports; all files far under 200 lines
- Idempotent upsert cron via by_ws_day key — re-running recomputes identical rows instead of double-inserting
- Honest cost model: estCostUsd flagged as estimate; unknown-model rates floor to 0 with hasRate=false surfaced as '~' in UI

**Critiques**

- 🟠 MED — No Delete/retention for workspaceUsageDaily — the aggregate table grows unbounded (one row per ws/day/provider/model, forever) with no prune cron, while rateLimit/channels/audit all prune. Operational leak + CRUD-incomplete for an owned entity. <br/>↳ `web/convex/usageRollups.ts:52-60` (insert/patch only, no delete); `web/convex/crons.ts:6-11` (other tables pruned, this one not)
- 🟠 MED — No backfill/manual-recompute path: rollupDay only aggregates from cutoff=start-of-yesterday. If the cron misses &gt;2 days (downtime), those gap days are never re-rolled and are permanently absent from the aggregate. <br/>↳ `web/convex/usageRollups.ts:21` (cutoff = now - now%DAY - DAY, only yesterday+today window)
- 🟡 LOW — Silent truncation at fixed caps with no overflow signal: &gt;1000 workspaces skips some entirely; &gt;5000 usage rows/ws/window undercounts; and take(500) existing-rows preload can miss a prior row for a ws-day with &gt;500 provider/model combos, causing a duplicate INSERT (double-count) instead of a PATCH. <br/>↳ `web/convex/usageRollups.ts:22` (take 1000 ws), :27 (take 5000), :46 (take 500 existing → patch-vs-insert miss)
- 🟡 LOW — UI uses hardcoded hex fallbacks inside CSS-var refs and heavy inline style objects rather than pure theme tokens; also an `as never` type cast to satisfy the Id&lt;&gt; arg — minor portability/type smells. <br/>↳ `web/frontend/slices/usage-rollups/components/workspace-usage-card.tsx:56-57` (#2222/#6a9), :30 (workspaceId as never)

**Suggestions**

- `S` Add a prune internalMutation (delete workspaceUsageDaily rows with day &lt; today-N via by_ws_day) and register it in `crons.ts`, mirroring audit.pruneAudit — closes the Delete gap and the unbounded-growth leak.
- `S` Widen the existing-rows preload: dedupe the aggregated (day,provider,model) set and query per exact key, or raise/remove take(500) so a high-cardinality ws-day can't produce duplicate inserts.
- `M` Add an internal backfill mutation taking {fromDay,toDay} so a missed-cron gap (or first-install over pre-existing usage) can be re-rolled; the fixed 2-day window otherwise leaves permanent holes.
- `S` Drop the redundant .filter(r.day&gt;=cutoff) at `usageRollups.ts:77` (withIndex gte already bounds it) and replace the card's hex fallbacks with pure theme tokens.

---

### ai-agents

**Score 84 · Grade B** — Careful, ownership-tight backend with full CRUD on agent configs; B-grade dinged by two unbounded .collect()s, no delete/retention for run history, and a workspace-visibility feature that's in the schema but not wired.

**CRUD:** C ✓ · R ✓ · U ◐ · D ◐
<br/>...

- **rr conventions:** NOT a slice — cross-cutting Convex backend, so no metadata trio expected (correct). File-size cap: PASS (`agents.ts` 49, `agentDefs.ts` 151, both &lt;200). SRP: PASS — clean split, `agents.ts` owns agentRuns run-lifecycle, `agentDefs.ts` owns agentDefs config CRUD; header comments explain the naming (`agents.ts`=runs vs `agentDefs.ts`=configs). Imports: clean, no deep cross-slice reaches — pulls from ./_shared/auth, ./toolRegistry, ./skillsRegistry, ./_generated only (`agentDefs.ts:4-9`). Helpers correctly extracted (clampMaxSteps/clampTemperature/validate*).
- **Convex rules:** GOOD overall. Validators: 100% — every public query/mutation declares args with v.* incl. args:{} on registry lists (`agentDefs.ts:48,54,59,68,99,126`; `agents.ts:31,41`). Authz: STRONG — every public mutation gates via requireUser + row-ownership check (`agentDefs.ts:78,110-112,128-130`); internal create/finish take explicit userId from an already-authed action caller (`chat.ts` runAgent), matching the `credentials.ts` pattern; public queries degrade gracefully to []/null for logged-out (`agents.ts:34,44`; `agentDefs.ts:62`) — allowed by the _shared/auth doc. withIndex: used on every filtered/ordered query (by_user, by_user_at). DING: two bare unbounded .collect() — list (`agentDefs.ts:63`) and listForUser (`agentDefs.ts:149`) are .withIndex(by_user).collect() with no .take(N)/paginate, violating the "No bare .collect()" rule; index-scoped to one user so not a full-table scan, but grows unbounded with a user's agent count. Minor: agentRuns.status + finish arg are v.string() not a v.union of literals (`agents.ts:17`).
- **UI rules:** n/a — audited paths are backend-only (both are convex/*.ts). Feature is cross-cutting with a frontend, but no frontend file was in scope for this audit; UI not judged.

**Strengths**

- Ownership enforced server-side everywhere: requireUser + row.userId check inside update/remove, and internal getOwned/listForUser re-check userId — never trusts a client-supplied owner (`agentDefs.ts:110-112,128-130,140,149`)
- Careful trust-boundary validation: NaN-safe clampMaxSteps (documents why ?? misses NaN, `agentDefs.ts:15-20`), registry-validated tools/skills reject unknown ids (`agentDefs.ts:36-45`), name/model shape-checked + truncated
- Deliberate null-sentinel on update to distinguish 'clear field' from 'omit field' given Convex drops undefined on the wire — documented (`agentDefs.ts:95-120`)
- Full CRUD on agentDefs (create/list/update/remove) with idempotent delete matching the `credentials.ts` convention (`agentDefs.ts:130`)
- Small, single-purpose files with clear header comments; both well under the 200-line cap

**Critiques**

- 🟠 MED — Bare unbounded .collect() on agentDefs list — violates the 'No bare .collect()' rr rule; index-scoped to the user so not a table scan, but has no upper bound and grows with the user's agent count (also mirrored in internal listForUser feeding the MCP list_my_agents tool). <br/>↳ `web/convex/agentDefs.ts:63` and :149
- 🟠 MED — agentRuns is effectively append-only with NO delete and no retention — users can create runs (internal) and read the latest 20 (myRuns) but can never delete run history nor page past 20; the table grows forever. Append-only trace is defensible, but the missing owner-facing delete/cleanup is a real CRUD gap. <br/>↳ `web/convex/agents.ts:9-48` (only create/finish/myRuns/getRun; no remove)
- 🟠 MED — Workspace visibility is declared in schema but not wired here: agentDefs schema ships visibility ('private'|'workspace'), workspaceId, and a by_ws index, but create/update never set them and list/listForUser only filter by userId — so a 'workspace'-shared agent would be unreachable by any member. Dead schema surface / under-built feature. <br/>↳ `web/convex/agentDefs.ts:58-93,147-150` vs `web/convex/schema.ts:101-114`
- 🟡 LOW — agentRuns.status and finish's status arg are v.string() rather than v.union of literals ('running'|'done'|'error'), so the type doesn't constrain the value; harmless today (only `chat.ts` calls it) but loosens the invariant. <br/>↳ `web/convex/agents.ts:17`; `web/convex/schema.ts:90`

**Suggestions**

- `S` Cap the two agentDefs collects: change .order('desc').collect() to .take(200) in list (`agentDefs.ts:63`) and listForUser (`agentDefs.ts:149`) — a user realistically has &lt;200 saved agents and it satisfies the no-bare-collect rule.
- `S` Add an owner-checked removeRun mutation (mirror remove's idempotent ownership pattern) and/or a retention cron so agentRuns history is deletable and doesn't grow unbounded.
- `M` Either wire workspace visibility (set workspaceId/visibility in create+update; union by_user with by_ws results in list) or drop the unused visibility/workspaceId/by_ws fields from the agentDefs schema to remove dead, misleading surface.
- `S` Tighten status to v.union(v.literal('running'),v.literal('done'),v.literal('error')) in schema + finish arg for a self-documenting, enforced state machine.

---

### provider-pool

**Score 83 · Grade B** — Clean, small, well-tested failover ENGINE (429/5xx/dead all fail over correctly); dinged for a 402/quota case that aborts instead of failing over — the core multi-key use case — plus a config layer (label/priority + badge) that is defined and read but never written or wired. Solid B: correct and portable, but under-built at the edges.

**CRUD:** C – · R ✓ · U ◐ · D –
<br/>Feature owns only ADDITIVE pool state on byok's modelCreds. State CRUD (read+update) is complete and machine-managed by design. The config layer (label/priority) is the gap: schema defines it, pickCredentials sorts on it, but no setLabel/setPriority mutation exists → priority is always default 100 so the pool degrades to pure LRU. fns: pickCredentials, markCredResult, classifyProviderError.

- **rr conventions:** PASS. Trio complete + version-consistent at 0.1.0: `slice.json:4`, `slice.manifest.json:4`, `slice.contract.ts:22`, barrel `index.ts:1` all read 0.1.0. Barrel-only imports (`index.ts` exports only CredStatusBadge; `providerPool.ts` imports sibling ./fallbackRules; callForUser reaches it via internal.providerPool generated api — no deep @/features/x/lib). SRP clean: fallbackRules=pure classify, providerPool=select+record, badge=UI chip. File-size cap easily met: `providerPool.ts` 61, `fallbackRules.ts` 77, `cred-status-badge.tsx` 36. Low nit: file headers say "provider-pool (2.3)" (`providerPool.ts:1`, `fallbackRules.ts:1`, `schema.ts:38`) — a milestone tag that reads like a version, diverging from the 0.1.0 semver.
- **Convex rules:** PASS. Both public-surface fns are internalQuery/internalMutation with full args validators: pickCredentials args userId/workspaceId?/provider (`providerPool.ts:18`), markCredResult args credId/ok/code? (`providerPool.ts:43`). No bare .collect() — both queries indexed + bounded: by_user_provider.take(10) + by_ws_provider.take(10) (`providerPool.ts:21-31`). Authz: these are INTERNAL fns correctly trusting their sole caller; the public boundary (chat action) enforces requireUser (`chat.ts:29`) + resolveWorkspaceAction member-role (`chat.ts:31`) and passes explicit userId, and pickCredentials scopes every query by that userId/workspaceId — proper internal-fn pattern, not a route-gate bypass. markCredResult null-guards a deleted row (`providerPool.ts:46`). Low nit: markCredResult patches credId without an own-row assert — safe only because credIds come from userId-scoped pickCredentials.
- **UI rules:** Portable-by-design chip. CredStatusBadge is a raw &lt;span&gt; (`cred-status-badge.tsx:32`) — acceptable, it's a non-interactive status badge, not a &lt;button&gt;/&lt;input&gt; the rr rule wraps; className-only ("pool-badge pool-&lt;status&gt;") with NO hex and NO shadcn dep is a deliberate portability choice (`manifest.json:14`, deps.shadcn []). Props-driven, no consumer copy, countdown interval cleaned up on unmount/!cooling (`cred-status-badge.tsx:22-26`). Gap: the badge is exported but consumed NOWHERE (grep found no importer) — dead UI until the multi-key/health screen it targets exists.

**Strengths**

- Pure, config-driven fallbackRules with a self-contained _selfCheck() asserting every rule (`fallbackRules.ts:64-77`) — testable in isolation, no ai/node import
- Tiny single-purpose files, all far under the 200-line cap; clean SRP split (classify / select+record / UI)
- No bare .collect() — both credential queries are .withIndex(...).take(10) bounded (`providerPool.ts:21-31`)
- Ciphertext (AES-256-GCM) flows pickCredentials→callForUser and is decrypted only server-side in a use-node action; badge gets status only, no secrets leave the server
- Honest, complete metadata: version-consistent trio + manifest documenting the callForUser hand-integration as the known lift blocker (`manifest.json:14`)

**Critiques**

- 🟠 MED — quota_exceeded (402) does NOT fail over to the next live credential — it aborts the request. In the loop, verdict.retryable=false && dead=false triggers `throw err` immediately (`callForUser.ts:153`), yet a 402 verdict is exactly that (`fallbackRules.ts:55-57`). A key running out of quota is the #1 reason to hold a second key, but the pool cools key1 and throws instead of trying key2. Note dead/401 DOES fail over (dead=true skips the throw) — so the design fails over on auth-death but not on quota, which is backwards for the core value prop. <br/>↳ `web/convex/callForUser.ts:153` + `web/convex/fallbackRules.ts:55-57`
- 🟠 MED — Pool CONFIG is read-but-never-written. priority + label are in the modelCreds schema and pickCredentials sorts candidates by priority (`providerPool.ts:33`), but no mutation anywhere sets them (grep of `credentials.ts/chat.ts`/all convex: zero patches of priority/label). So priority is always the default 100 and the pool is effectively pure LRU; the 'multi-key UI' the schema comment references (`schema.ts:40`) does not exist. CRUD-incomplete on the config entity. <br/>↳ `web/convex/schema.ts:40-41` (declared) vs `providerPool.ts:33` (read) — no writer mutation
- 🟡 LOW — CredStatusBadge is exported from the barrel but imported by nothing — the Providers/health screen it is meant to drive has not been built, so it ships as dead UI ahead of its consumer. <br/>↳ `web/frontend/slices/provider-pool/index.ts:5` (export) — grep for CredStatusBadge outside the slice returns no consumers
- 🟡 LOW — Nomenclature drift: source headers/comments tag this '(2.3)' (a build-milestone number) while the slice semver is 0.1.0 — reads like a conflicting version. <br/>↳ `web/convex/providerPool.ts:1`, `web/convex/fallbackRules.ts:1`, `web/convex/schema.ts:38`

**Suggestions**

- `S` Make a quota-exhausted key fail over: in the callForUser loop treat cooldownMs&gt;0 as 'try next candidate' even when retryable=false (or set 402→retryable=true in fallbackRules while keeping the 240s cooldown). One-line change at `callForUser.ts:153`.
- `M` Add a byok-side setPoolConfig mutation (requireUser + own-row assert) that patches label/priority on a modelCreds row, so pool ordering is actually controllable and the badge/multi-key UI has something to drive.
- `S` Either wire CredStatusBadge into the Providers list now (feed it status/cooldownUntil/lastErrorCode) or drop it from the barrel until the screen exists — don't ship it as dead exported UI.
- `S` Retag the '(2.3)' milestone markers in the file headers to the slice semver (or a clearly non-version label) to remove the version ambiguity.
- `S` Harden markCredResult with a cheap own-row/userId assertion for defense-in-depth if it's ever reused outside the current single caller.

---

### ai-admin

**Score 83 · Grade B** — Clean, simple, correctly-gated read-only operator console that nails Convex authz + validators + no-bare-collect; the one real flaw is aggregate totals silently freezing at the 10k scan cap when a usageRollups table already exists to give exact numbers.

**CRUD:** C – · R ✓ · U – · D –
<br/>Owns no entities of its own; it is a read-only observability surface aggregating other slices' tables (users, modelCreds, usage, agentRuns, threads, messages). Read-only is correct by design. Gap worth noting: as an 'operator console' it exposes zero admin mutations — no way to revoke a leaked/compromised credential, disable a user, or reset a stuck agentRun from here. Those are legitimate operator actions living elsewhere or missing; scoped-out but a real functional ceiling.

- **rr conventions:** NOT a slice — cross-cutting operator surface, so no metadata trio expected (correct). File-size cap: ``admin.ts`` 105 lines, consumer ``admin.tsx`` 76 lines — both well under 200. SRP: mildly mixed (re-exports `isSuperAdmin` for boolean call-sites AND owns 4 stats queries) but cohesive around admin observability and the header comment justifies it (`admin.ts:1-3`) — acceptable. Imports clean: only `./_generated/server`, `@convex-dev/auth/server`, `./_shared/auth` — no deep `@/features/x/lib/...` reaches.
- **Convex rules:** PASS with one accuracy caveat. Args validators 4/4: `me`, `adminStats`, `adminUsers`, `adminOverview` all declare `args: {}` (`admin.ts:20,31,50,65`). No bare `.collect()` — every read is `.query(...).order("desc").take(ADMIN_SCAN_CAP)` with CAP=10_000 (`admin.ts:16,34-35,52-53,68,72,82,86-87`). Server-side authz: the three sensitive queries call `await requireAdmin(ctx)` as first statement (`admin.ts:33,51,66`); `requireAdmin` chains `requireUser`+`isSuperAdmin` from ``_shared/auth.ts:39-43`` — real handler-level gate, not a route gate. `me` intentionally uses raw `getAuthUserId` and returns null when logged out (`admin.ts:22-25`) — correct per the graceful-degrade idiom documented in `auth.ts:1-6`. No `.withIndex` needed since queries only do default creation-time ordering with no filter. CAVEAT: aggregates are computed by summing a 10k-capped scan, so once activity tables (usage/messages/threads) exceed 10k, `totals.requests`/`messages`/token sums silently report the cap, not the true total (`admin.ts:72-87`) — a correctness gap for a console whose job is accurate counts, especially since a `usageRollups` feature already exists (`schema.ts:11,26`) that could give exact totals without scanning raw `usage`.
- **UI rules:** PASS for this project's plain-CSS baseline (shadcn/Tailwind absent project-wide per CLAUDE.md snapshot, not a feature-specific miss). Consumer ``app/app/_components/admin.tsx`` uses theme tokens not hex — `var(--danger)`, `var(--accent)` (`admin.tsx:9`), className tokens `card`/`muted`/`mono`/`badge` (`admin.tsx:20-22`). Loading state handled (`stats === undefined ? "…"`, `admin.tsx:23`). Responsive via wrapping `.row` flex with rowGap (`admin.tsx:26`). Raw `&lt;section&gt;/&lt;div&gt;/&lt;ul&gt;/&lt;button&gt;`-free markup — no shadcn primitives, but that is the known repo-wide gap, not this feature's regression. Minor: the capped counts surface with no "10000+" indicator, so a truncated total reads as an exact total to the operator.

**Strengths**

- Every sensitive query gates with requireAdmin(ctx) as its first statement — handler-level authz, not a route gate (`admin.ts:33,51,66`)
- Strict no-secrets discipline: returns counts/identities only, never key/ciphertext, enforced by shape and asserted in comments (`admin.ts:29,46,62`)
- No bare .collect() — all reads are bounded .take(ADMIN_SCAN_CAP) with a documented rationale (`admin.ts:10-16`)
- Small, single-purpose, well-commented: 105 lines, clean imports, args:{} validators on all four queries
- Admin allowlist via server-side env (SUPER_ADMIN_USER_IDS/EMAILS), never NEXT_PUBLIC_ (`auth.ts:21-37`)

**Critiques**

- 🟠 MED — Aggregate totals silently cap at 10k: totals.requests/messages/threads and prompt/completion token sums are computed from a .take(10_000) scan, so past 10k rows the UI shows the cap as if it were the true total — misleading for the one surface whose job is accurate operator counts. A usageRollups feature already exists that would give exact totals. <br/>↳ `web/convex/admin.ts:72-87` (`schema.ts:11,26` has usageRollupTables)
- 🟡 LOW — Three separate reactive queries redundantly re-scan the same tables on every admin render: modelCreds is scanned 3x (adminStats+adminUsers+adminOverview) and users 2x, each up to 10k rows. Consolidating into one query would cut the work ~2-3x. <br/>↳ `web/convex/admin.ts:34-35,52-53,68`
- 🟡 LOW — Operator console is read-only with no admin mutations — no path to revoke a leaked credential, disable a user, or clear a stuck agentRun from the admin surface. Acceptable if intentionally append-only/observability, but a real capability gap for an 'operator console'. <br/>↳ `web/convex/admin.ts` (all four exports are query(), zero mutation())

**Suggestions**

- `M` For token/request/message totals, read from the existing usageRollups aggregates instead of a capped raw scan of `usage` — gives exact numbers and removes the 10k-cap accuracy bug in one move.
- `S` Until then, surface truncation honestly: when a scan returns exactly ADMIN_SCAN_CAP rows, return a `capped: true` flag and render '10000+' in `admin.tsx` so the operator isn't shown a frozen count as exact.
- `S` Fold adminStats' user/cred counts into adminOverview (which already scans creds) to eliminate the duplicate table scans across the three queries called by the same component.

---

### combos

**Score 81 · Grade B** — Clean, rr-compliant, well-scoped slice with textbook Convex authz/validation — but round_robin is a silent no-op (bumpRotation never called) and update is thin (rename-only, unwired), so the strategy layer under-delivers what it advertises. Solid B.

**CRUD:** C ✓ · R ✓ · U ◐ · D ✓
<br/>Config entity; create+list+delete solid but update is thin. Backend rename exists but is dead from the UI.

- **rr conventions:** Trio complete + versions all matched at 0.1.0: `slice.json`, `slice.manifest.json`, `slice.contract.ts`, plus barrel comment 'combos v0.1.0' (`index.ts:1`). Contract's convex[] correctly lists all 4 public fns incl renameCombo (no drift). Barrel-only cross-slice imports — card imports @/features/workspaces (barrel) + @/convex/_generated/api only; no deep @/features/x/lib reaches. File-size cap respected: `combos.ts` 99, `tables.ts` 23, `combo-builder-card.tsx` 85 — all well under 200. SRP OK: `combos.ts` is one cohesive cluster (all combo CRUD + resolution). tablesExport pattern followed, schema spread confirmed at `schema.ts:22`.
- **Convex rules:** STRONG. All 4 public fns (listCombos/createCombo/renameCombo/removeCombo) + 2 internal (resolveCombo/bumpRotation) declare full args:{} v.* validators (`combos.ts:29,38,50,64,78,93`). No bare .collect() anywhere — listCombos uses .withIndex('by_ws').take(100) (:32), resolveCombo uses .withIndex('by_ws_name').unique() / by_user.take(100) (:81-82), others .unique(). Server-side authz INSIDE every mutation via requireWorkspaceRole (member to write, viewer to read) from `_shared/auth.ts:51` — real membership check, not a route gate. Every filtered/ordered query hits an index (by_user/by_ws/by_ws_name at `tables.ts:20-22`); listCombos sorts in-memory only after the capped take(100). Idempotent delete (:68), conflict detection on create/rename via by_ws_name.unique(). Internal resolveCombo trusts caller (callForUser) — acceptable for internalQuery.
- **UI rules:** FUNCTIONAL but non-shadcn. Uses raw &lt;input&gt;/&lt;select&gt;/&lt;button&gt;/&lt;section&gt; (`combo-builder-card.tsx:48-68`) instead of shadcn primitives — violates 'shadcn primitives only', though consistent with the project-wide plain-CSS-token gap noted in CLAUDE.md. No hex colors — styling via theme CSS classes (card/btn accent/sub danger/muted mono); inline styles are layout-only (gap/margin). Loading + empty + populated states all handled (:82). Delete fires on a single click with no confirm dialog (:78). Card takes no props — labels/placeholders hardcoded (not props-driven), acceptable at the contract's 'consumer-locked' level.

**Strengths**

- Textbook Convex data-access: 6/6 fns validated, 0 bare collects, capped takes, indexed lookups, and real requireWorkspaceRole authz inside every handler
- Complete rr trio with matched 0.1.0 versions + barrel comment; contract convex[] matches actual exports (no drift)
- Tight, cohesive files far under the 200-line cap (99/23/85); clean barrel-only imports
- Solid create-path validation: slug normalization, 1-5 ref cap, provider/model format check, strategy enum, name-conflict detection, idempotent delete
- Rotation state correctly modeled on-row (OCC-safe) rather than in-memory, with honest manifest notes about what's not yet wired

**Critiques**

- 🟠 MED — round_robin strategy is non-functional: bumpRotation (the ONLY writer of rotationIndex) has zero callers anywhere in the repo, so the cursor never advances and round_robin permanently resolves to refs[0] — behaviorally identical to fallback. The manifest overclaims ('round_robin ... advanced by internal.combos.bumpRotation') since nothing calls it. <br/>↳ `convex/combos.ts:84` reads rotationIndex; :92 bumpRotation defined but grep shows no caller in convex/frontend/app
- 🟠 MED — Update is CRUD-incomplete: only name is mutable (renameCombo); refs/strategy/stickyLimit have no update path, so editing a combo's models requires delete+recreate. renameCombo is also never surfaced in the UI, so from the client there is no update at all. <br/>↳ `convex/combos.ts:49` (rename only); `combo-builder-card.tsx` has no edit control
- 🟡 LOW — UI uses raw &lt;input&gt;/&lt;select&gt;/&lt;button&gt; rather than shadcn primitives, violating the UI rule (mitigated: matches project-wide plain-CSS gap). <br/>↳ `web/frontend/slices/combos/components/combo-builder-card.tsx:48-68`
- 🟡 LOW — Delete has no confirmation — one click permanently removes the combo; minor silent-data-loss risk. <br/>↳ `web/frontend/slices/combos/components/combo-builder-card.tsx:78`
- 🟡 LOW — stickyLimit is stored + validated (Math.max(1,...)) but entirely unused — bumpRotation ignores it despite the doc comment implying a hold window; reserved dead config. <br/>↳ `convex/combos.ts:45,97` + `tables.ts:16`

**Suggestions**

- `S` Wire bumpRotation into callForUser's round_robin path (or remove round_robin from the UI select + manifest until it works) so the advertised strategy isn't a silent no-op
- `S` Add an updateCombo mutation (refs + strategy) reusing the existing validate() helper, so combos can be edited without delete+recreate
- `S` Wire renameCombo into the card (inline edit) or drop it from the contract's convex[] to avoid a dead exported fn
- `S` Add a confirm step before delete to prevent accidental one-click loss
- `S` Either implement the stickyLimit window in bumpRotation or drop the field until 2.3 to shrink reserved-but-unused surface

---

### audit-log

**Score 80 → 76 (critic) · Grade B → C** — Well-engineered append-only slice (clean Convex, matched trio, transaction-local writes) that under-delivers on its own advertised scope — only 2 of ~5 claimed audit events are recorded, and the missing ones include security-sensitive credential deletion. Solid B; wiring the 3 missing hooks (or fixing the copy) lifts it to A.

**CRUD:** C ✓ · R ✓ · U – · D ◐
<br/>Entity = auditEvents (append-only). CREATE: yes — inline db.insert in the acting mutation for member.role_changed (`workspaces.ts:123`) and member.removed (`workspaces.ts:136`), plus audit.record internalMutation (`audit.ts:27`) for programmatic callers. READ: yes — audit.listAuditEvents admin-gated indexed query (`audit.ts:48`). UPDATE: n/a — append-only by design, rows are never patched (`tables.ts:2-4`). DELETE: automated-only — pruneAudit 90-day cron sweep (`audit.ts:76`, `crons.ts:11`); no manual delete, which is CORRECT for an audit trail. CRUD shape is right for append-only; the real gap is CREATE coverage, not the surface (see critiques).

- **rr conventions:** PASS. Full metadata trio present, versions all matched at 0.1.0: `slice.json:4`, `slice.manifest.json:4`, `slice.contract.ts:21`, barrel comment `index.ts:1` ('audit-log v0.1.0'). Barrel-only cross-slice import — card pulls useWorkspace from @/features/workspaces (`audit-log-card.tsx:8`), no deep @/features/x/lib reach-in. SRP clean (card/query/table/prune isolated). File-size cap fine — largest source `audit.ts` (87) and card (79), both under 200. contract.provides.convex + tables all resolve to real exports.
- **Convex rules:** PASS. Args validators 3/3: record (`audit.ts:28-34`), listAuditEvents (`audit.ts:49`), pruneAudit (`audit.ts:77` empty args). NO bare .collect() — listAuditEvents uses .withIndex('by_ws_at').order('desc').take(clamped) (`audit.ts:53-57`); pruneAudit uses .withIndex('by_at', lt cutoff).take(500) (`audit.ts:80-83`). Authz: only client-reachable fn (listAuditEvents) calls requireWorkspaceRole(ctx, ws, 'admin') (`audit.ts:51`); record + pruneAudit are internalMutation (not client-reachable); inline insert sites sit inside admin-gated mutations (`workspaces.ts:117,131`). Indexes declared in schema spread (`tables.ts:17-18`, `schema.ts:12`/27). Minor: boundMeta 1000-char guard (`audit.ts:15`) protects record() only; inline hooks bypass it (server-controlled small metas, low risk).
- **UI rules:** Conforms to the project's plain-CSS-token convention (app has no shadcn/Tailwind yet — documented baseline gap). No hex — theme classes (card/sub/muted/mono/accent) with inline styles only for spacing/font-size (`audit-log-card.tsx:55-72`). Filter pills flex-wrap for mobile (line 55). Correct empty/loading/personal/non-admin gating (lines 36-49,60-63). Rule miss (codebase-wide): raw &lt;button&gt; for filter pills at line 57 instead of a shadcn primitive. Filter groups derived from data, not hardcoded (lines 29-33).

**Strengths**

- Clean Convex hygiene: validators on all 3 fns, both reads use .withIndex+.take (no collect), admin authz via requireWorkspaceRole, bounded self-rescheduling prune
- Full metadata trio present with versions matched at 0.1.0 across `slice.json`/manifest/contract/barrel
- Correct append-only semantics — audit rows written in the SAME transaction as the state change (inline db.insert, no action hop / partial-write window)
- Small single-responsibility files, barrel-only cross-slice import, dynamic filter pills derived from data not hardcoded
- Good security discipline: meta bounded to 1000 chars, action/target sliced, 'never secret material' contract on meta

**Critiques**

- 🔴 HIGH — Advertised audit coverage is not implemented: `slice.json` description, manifest notes, and the card's own UI copy (`audit-log-card.tsx:54`) all claim invite-acceptance, member-leave, and shared-credential-delete are audited — but NONE write a row. acceptInvite inserts a membership with no audit, leaveWorkspace deletes membership with no audit, deleteCredential deletes with no audit. Only member.role_changed and member.removed are wired. For a compliance feature, unrecorded credential deletion + invite acceptance is a false-assurance security gap. <br/>↳ `web/convex/workspaceInvites.ts:73`; `web/convex/workspaces.ts:148`; `web/convex/credentials.ts:106`
- 🟠 MED — Metadata over-promises reality: manifest.notes describes the cred-delete hook in detail ('fires ONLY for workspace-shared creds…') as if it exists, and `tables.ts:12` lists 'cred.deleted' as an example action — yet no such hook exists anywhere. A consumer adopting this slice would trust an audit trail that silently omits the most sensitive action it claims to cover. <br/>↳ `web/frontend/slices/audit-log/slice.manifest.json:14`; `web/convex/features/auditLog/tables.ts:12`
- 🟡 LOW — audit.record internalMutation has zero callers — dead/speculative code. Either wire the missing hooks through it or delete it (it exists 'for callers not inside the acting mutation' but there are none). <br/>↳ `web/convex/audit.ts:27`
- 🟡 LOW — Type escapes: workspaceId cast 'as never' (card:25) and actor cast 'as any' twice (`audit.ts:67`) defeat strict typing at trust boundaries. Avoidable. <br/>↳ `web/frontend/slices/audit-log/components/audit-log-card.tsx:25`
- 🟡 LOW — Retention '90 days' hardcoded in three places (RETAIN_MS `audit.ts:11` plus UI copy `audit-log-card.tsx:54` and `slice.json:8`). Changing RETAIN_MS silently desyncs the card's promise to the user. <br/>↳ `web/convex/audit.ts:11`

**Suggestions**

- `S` Add the three missing inline db.insert('auditEvents', …) hooks: cred.deleted in deleteCredential (`credentials.ts:106`), member.left in leaveWorkspace (`workspaces.ts:148`), invite.accepted in acceptInvite (`workspaceInvites.ts:73`) — matching the pattern already at `workspaces.ts:123`/136.
- `S` OR, if those hooks are intentionally deferred, downgrade the `slice.json`/manifest/card copy to list only member.role_changed + member.removed so metadata stops over-claiming.
- `S` Delete audit.record (`audit.ts:27`) if inline-hooks are the chosen convention, or route the new hooks through it to centralize boundMeta and give the dead code a purpose.
- `S` Drop the 'as never'/'as any' casts — type workspaceId from useWorkspace() and give listAuditEvents a typed actor shape so the card's Evt type is enforced end-to-end.

---

_Generated 2026-07-07 · workflow `feature-audit` (20 auditors + 1 critic) · re-run to refresh._
