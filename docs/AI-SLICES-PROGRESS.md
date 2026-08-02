# AI Slices — Progress Checklist

Tracking how much of the [rr](https://github.com/rahmanef63) AI slice surface (from `../resources`)
is live in **models.rahmanef.com**. The rr slices are mostly **scaffolds** (types/config, few real
components), so "apply" = *build the real feature here* in this app's design + BYOK + Vercel AI SDK.

**Legend:** ✅ done & deployed · 🟡 partial · ⬜ not started · 🅿️ parked (needs decision)

Last updated: 2026-07-08 (top-5 audit fixes re-verified + memory-graph slice + Design-Platform
app-shell shipped — see `docs/FEATURES-LOG.md` for the verified shipped scope + v0.2 backlog, and
root `audit.md` for the 20-feature best-practice + CRUD compliance scorecard).

## Summary

| Slice | rr status | our status | rough coverage |
|---|---|---|---|
| **AI Router** — backend provider proxy | partial (OpenRouter tiers) | 🟡 **we exceed rr on BYOK** + est. cost + combos fallback/round-robin + pool failover, lag on the public proxy | ~55% |
| **AI Chat** — workbench / sidebar / search | partial (FAB only) | 🟡 workbench + persistence + 4-tool registry | ~44% |
| **AI Agents** — autonomous workers | partial (in-memory) | 🟡 runner + traces + persistence + duration + getRun + spend-cap gate | ~44% |
| **AI Admin** — console (8 tabs) | scaffold-only | 🟡 providers/models/audit (table + hooks) + content totals + spend-caps enforced | ~45% |
| **AI Studio** — generation canvas | scaffold-only | ⬜ not started | 0% |
| **shared/agentic** — the tool kit | implemented (lib) | 🟡 AI-SDK tools + tool/skill registries | ~30% |
| **Create Your MCP** — MCP server | partial (templates) | 🟡 **bearer + OAuth 2.1 + rate-limit + revoke-all live**; more tools next | ~78% |

---

## Vertical-slice trio status (rr metadata)

> Audit 2026-07-04: every dir under `web/frontend/slices/` was checked for the mandatory rr
> metadata trio — `slice.json` + `slice.contract.ts` + `slice.manifest.json` (mirror of
> `frontend/slices/usage-rollups/`). **All 10 slices ship a complete, accurate trio.** No trio
> was missing this pass. Each slice's `convex.tablesExport` maps to a live `convex/features/<camel>/`
> table export (byok is the exception — extracted in-place, its tables live directly in `schema.ts`
> and the feature dir re-exports crypto helpers only, by design).

| Slice | shipped? | trio? | convex feature dir | tables export | catalog-ready? | notes |
|---|---|---|---|---|---|---|
| **byok** | ✅ | ✅ | `byok/` (helpers barrel) | `modelCreds` | 🟡 | extracted in-place from monolith; tables in `schema.ts` not a `tables.ts`; needs `MODELS_ENC_KEY` + ai-sdk provider peers before lift |
| **workspaces** | ✅ | ✅ | `workspaces/` | `workspaces,memberships,invites` | ✅ | authz core (`requireWorkspaceRole`); peer for most other slices |
| **api-compat** | ✅ | ✅ | `apiCompat/` | `apiKeys` | ✅ | `/v1` gateway: chat/completions · messages · models · **embeddings · images/generations · audio/speech · audio/transcriptions**; non-streaming + pseudo-stream |
| **memory** | ✅ | ✅ | `memory/` | `memories` | ✅ | v0.2.0; registers registry + cron |
| **combos** | ✅ | ✅ | `combos/` | `combos` | ✅ | resolved in callForUser; peers workspaces + byok |
| **mcp-client** | ✅ | ✅ | `mcpClient/` | `mcpServers` | ✅ | needs `MODELS_ENC_KEY` + `@modelcontextprotocol/sdk` |
| **audit-log** | ✅ | ✅ | `auditLog/` | `auditEvents` | ✅ | append-only + 90-day prune cron; peers workspaces |
| **channels** | ✅ | ✅ | `channels/` | `channels` | ✅ | Telegram/Slack/WhatsApp/Discord inbound webhooks |
| **scheduled-agents** | ✅ | ✅ | `scheduledAgents/` | `agentSchedules` | ✅ | minute-tick cron; peers workspaces + byok |
| **usage-rollups** | ✅ | ✅ | `usageRollups/` | `workspaceUsageDaily` | ✅ | reference trio shape; reads app-provided `usage` table |

**rr-catalog-ready:** all 10 trios are structurally complete and validate against the usage-rollups
shape. Each declares slug/title/description, `convex.tablesExport` + `rootPaths`, frontend
`slicePath` + `configExport`, deps/peers, and a `bidir.generalization` block in the contract. Lift
blockers before pushing UP to rr: sanitize `forbiddenTerms` (`models-rahmanef`, `rahmanef`) per
contract, and `byok` still needs its tables promoted to a `convex/features/byok/tables.ts` export
to match the other nine (currently schema-inline).

---

## AI Router — Backend Provider Proxy
> rr routes 3 tiers (nano/mid/flagship) through **one shared OpenRouter key**. **We went further**: real per-user BYOK across 22 providers.

- ✅ Provider registry — 22 providers (`src/registry.js`, `chat.ts` OPENAI_COMPAT)
- ✅ Per-user **encrypted** credentials (AES-256-GCM, `crypto.ts`) — rr uses one shared key
- ✅ Host-gating (a key never leaves its provider's host)
- ✅ models.dev catalog + `resolveModel`
- ✅ Per-call usage log (requests, in/out tokens) — `usage.ts`
- ✅ User attribution
- ✅ Cost (USD) — est. spend from models.dev $/M rates in the Usage card (per-model tokens × rate; OAuth/uncatalogued models skipped, marked an estimate)
- ✅ **Public `/v1` OpenAI- + Anthropic-compatible endpoint** (point Claude Code / Codex / Cursor at us) — `sk-rr-…` key auth; chat/completions · messages · models · embeddings · images/generations · audio/speech · audio/transcriptions. Tool passthrough (in+out). Real token streaming still pending (pseudo-stream today).
- 🟡 Combos: fallback + round-robin **live** (`combos` slice — round-robin now actually rotates via `resolveCombo`/`bumpRotation`); fusion (panel + judge) pending
- 🟡 Per-cred failover + cooldown **live** (`provider-pool` fails over on 402/quota_exceeded, cools the cred 240s); per-model backoff pending
- ⬜ RTK tool-result compression
- ⬜ Domain events (ai.invoked / ai.usage.logged)

## AI Chat — Workbench / Sidebar / Search
> rr ships only a floating FAB; workbench + persistence are declared-not-built. **We built the workbench + persistence.**

- ✅ Workbench shell (thread sidebar + message view + composer) — `WorkbenchCard`
- ✅ Thread history / **persistence** (`threads` + `messages` tables, `threads.ts`)
- ✅ Multi-provider (22 providers — rr only calls Anthropic)
- ✅ Agent mode (AI-SDK tool calls)
- ✅ Typed tool calls — 4 tools (`list_my_providers`, `get_my_usage`, `get_model_catalog`, `list_my_agents`)
- ✅ Usage telemetry (every chat logged)
- ✅ Model picker — **provider-first** (pick provider → then its models, never dumps all), route badge (oauth / api-key), model **inspector** (context / cost / tools / modalities from models.dev), model header bar per thread
- ✅ Fixed: OpenAI-compat providers (Mistral, Groq, …) were hitting OpenAI's `/responses` API via the SDK shorthand → now `.chat()` = `/chat/completions`; provider errors now surface (ConvexError) instead of a masked "Server Error"
- ⬜ **Sidebar copilot** mode (embed in another app)
- ⬜ **Search** mode (Perplexity-style Q + answer + citations)
- ⬜ Streaming (resumable SSE) — we do request/response
- 🟡 Multimodal attachments — **image IN done** (native chat via `_storage`; `/v1` via `image_url`/Anthropic image blocks) + **image/audio OUT** via `/v1/images/generations` + `/v1/audio/speech`, **audio IN** via `/v1/audio/transcriptions`; PDF-in still pending
- ⬜ Branching / forking threads
- ✅ RAG citations (vector search) — `useRag` flag → `ragNode.retrieve` → citation-prompt in `chat.ts`
- ⬜ Message / thread **search**
- ⬜ ChatAdminPanel (persona / guardrails / starter chips)

## AI Agents — Autonomous Workers
> rr runner is real but **in-memory**; components declared-not-built. **We persist runs + traces.**

- ✅ Run engine (`runAgent`, 8-step tool loop)
- ✅ `myRuns` (list) + `getRun` (single, owner-checked) + internal create/finish (`agents.ts`) + `runAgent` action / model loop (`chat.ts`)
- ✅ Step-by-step trace (recorded + expandable UI)
- ✅ **Persistent** runs (`agentRuns` table — rr uses a Map)
- ✅ On-demand trigger + AgentsCard
- ✅ Per-run duration (`finishedAt − at`, shown per run) + per-run token counts stored
- ⬜ Per-run **cost tally** (USD)
- ⬜ Cancel run
- ⬜ Run queue / status board UI
- ✅ **Agent definitions** (named: skill × model × tools × max-iter) — `agentDefs` table, full CRUD, ownership-checked; `runAgent` runs either a saved def or stays ad-hoc
- ⬜ Cron / scheduled runs
- ⬜ Retry policy + backoff
- ⬜ Max concurrency cap
- 🟡 Hard cost cap enforced in `runAgent` (`spend-caps` gate **fails closed** on read truncation); kill switch pending
- ⬜ Shareable trace URL
- ✅ New/edit agent wizards — `AgentForm` (name/model/instructions/tool-picker/maxSteps/temperature), used for both create + edit

## AI Admin — Console (Providers · Models · Instructions · Skills · Tools · Agents · Budgets · Audit)
> rr = scaffold only (no components, no backend). **Currently building (loop iteration 4).**

- ✅ Admin section mount (super-admin gated, `admin.ts` isSuperAdmin)
- ✅ Users + connections + oauth counts
- ✅ **Providers** overview (system-wide, by slug — `adminOverview`)
- ✅ **Models** overview (global top models)
- ✅ Content totals (threads / messages / agent-runs / requests / tokens)
- 🟡 **Audit** — dedicated `auditEvents` table (append-only + 90-day prune) + hooks wired (member.left / invite.accepted / workspace.ownership_transferred); cred.deleted latent until a shared-cred write path ships; read-only admin tab UI pending
- ⬜ **Instructions** tab (system-prompt registry)
- ⬜ **Skills** tab
- ⬜ **Tools** tab (tool registry / SSOT)
- ⬜ **Agents** tab (agent definitions)
- 🟡 **Budgets** — `spend-caps` enforcement live (**fails closed** on read truncation, `truncated` flag surfaced in `SpendCapCard`); full admin tab pending
- ⬜ Create-* wizards
- ⬜ SSOT registries consumed by the other slices

## AI Studio — Generation Canvas
> Not started. Entire slice is a scaffold in rr too.

- ⬜ Prompt bar · generation canvas · variation grid (1–8) · version tree (branch & compare)
- ⬜ Output kinds: image / text / code / audio
- ⬜ Prompt history · favorites · share-link · export/download
- ⬜ Model picker · generation controls (count, temperature) · live streaming
- ⬜ Cost tracking / cost guard
- ⬜ Admin: template library · few-shot pairs · moderation · analytics

## shared/agentic — The Tool Kit
> rr's kit (defineTool → registry → one agent loop → model seam). **We use the Vercel AI SDK's native tool-calling instead** — same capability, fewer abstractions (ponytail).

- ✅ Tool-calling loop (AI SDK `tools` + `stopWhen`) — functional equivalent
- ✅ Tool **registry** (`convex/toolRegistry.ts`, SSOT for id/label/description) + per-agent tool selection — 4 tools (list_my_providers, get_my_usage, get_model_catalog, list_my_agents), infrastructure'd not hardcoded
- ✅ **Skills registry** (`convex/skillsRegistry.ts`, SSOT id/label/description) — 6 instruction bundles (researcher, terse, code-reviewer, planner, explainer, data-analyst), selectable per-agent, concatenated into the system prompt at run time
- ⬜ `defineTool` authoring factory + JSON-schema builders
- ⬜ Central tool registry / bus (many slices' tools aggregated)
- ⬜ Dangerous + confirm safety seam
- ⬜ RBAC gated wrapper
- ⬜ SSE browser client
- ⬜ 41 downstream tool collections

## Create Your MCP — MCP Server
> **Bearer core is LIVE** at `models.rahmanef.com/mcp` (smoke-tested). OAuth 2.1 (for ChatGPT) is phase 5b. Works with Claude Code / Cursor today via a bearer token.

- ✅ JSON-RPC MCP dispatcher (initialize / tools/list / tools/call) — `mcpNode.ts`
- ✅ Bearer auth — tokens stored as sha256, validated before any dispatch; 401 on missing/bad
- ✅ Token console (issue / revoke, endpoint URL + client config) — dashboard **MCP** tab
- ✅ Tool catalog: `list_providers`, `get_usage`, `chat` (runs as the token owner, BYOK, never leaks a key)
- ✅ **OAuth 2.1** (5b): DCR + `/oauth/authorize` consent + `/oauth/token` — PKCE S256, single-use 60s codes, redirect_uri allowlist; **ChatGPT-connectable** (smoke-tested end-to-end incl. replay + wrong-verifier rejection)
- ✅ `.well-known` AS + protected-resource metadata; `/mcp` 401 advertises the AS via `WWW-Authenticate`
- ✅ **Hardened** (paranoid review caught pre-ship): app-wide `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (anti-clickjacking) + consent shows the destination host & marks DCR names unverified (anti consent-phishing)
- ⬜ More tools (`run_agent`, `list_models`, add/remove key)
- ✅ Rate limiting / anti-abuse — fixed-window counters: open DCR 10/hr/IP, token exchange 30/min/IP, `/mcp` 240/min/IP + 120/min/token; 429 + `Retry-After`. IP taken from the trusted proxy hop (not the spoofable leftmost XFF); expired rows swept by a 6h cron. Convex-OCC, zero deps (`convex/rateLimit.ts`, `crons.ts`)
- ✅ Revoke-all tokens — one-click panic button (revokes every active token you own) in the MCP tab

---

## Beyond rr (we have, rr does not)
- ✅ **3 OAuth subscription logins**: OpenAI ChatGPT/Codex, **Claude Pro/Max**, OpenRouter — rr has none
- ✅ **22-provider BYOK** with per-user AES encryption — rr = one shared OpenRouter key
- ✅ **Token savers** (Caveman / Ponytail system-prompt injection) — not in rr
- ✅ models.dev auto-updating catalog + host-gating
- ✅ Landing page, OG image, super-admin gate, dashboard sidebar
- ✅ **Full-width UI** (landing + dashboard, 1520px fluid) · landing reflects every shipped feature (Chat / Agents / Providers / Usage / MCP / Admin) · Overview default with quick-links + connect nudge
- ✅ **Provider key validation** — a pasted API key is tested with a real 1-token call the moment you Save it (not the first time you chat), Providers list shows a persisted health badge (VERIFIED / NEEDS ATTENTION / NOT TESTED / NO AUTO-CHECK) + on-demand recheck
- ✅ **Design-Platform app-shell** — 72px icon NavigationRail + secondary sidebar (sub-sections of the active group) + optional docked AI dock + light/dark theme toggle; `app/app/page.tsx` is now a ~156-line shell (was a 1200-line monolith)
- ✅ **Mobile bottom-nav dock** (CareerPack-style) — 3 group tabs + center AI FAB + 'More' overflow sheet (quick-create · all sub-sections · theme · sign-out); replaces the old <640px rail-flip, restoring a mobile AI entry point
- ✅ **Memory Graph** slice (`frontend/slices/memory-graph`, v0.2.0) — Obsidian-style force-directed graph over memories + agents + built-in skills + tools (agent→skill/tool cross-links); pan/zoom/drag + force sim + filters + node inspector + `@/[Title]` node-linking on MD/JSON import + add-memory dock; portable Convex-free `<MemoryGraph>` renderer + wired `<MemoryGraphPanel>` adapter; full metadata trio, no new Convex table

## What's next (loop order)
- ✅ **AI Admin console** — providers/models/audit + content totals
- 🟡 **Create Your MCP** — bearer (5a) + OAuth 2.1 (5b) + rate-limit + revoke-all (5c) **live + ChatGPT-connectable**; more tools (run_agent / list_models) next
6. **AI Studio** — generation canvas
- backlog: chat Search mode, agent scheduling, public `/v1` router (🅿️), the 8-tab admin registries
