# AI Slices — Progress Checklist

Tracking how much of the [rr](https://github.com/rahmanef63) AI slice surface (from `../resources`)
is live in **models.rahmanef.com**. The rr slices are mostly **scaffolds** (types/config, few real
components), so "apply" = *build the real feature here* in this app's design + BYOK + Vercel AI SDK.

**Legend:** ✅ done & deployed · 🟡 partial · ⬜ not started · 🅿️ parked (needs decision)

Last updated: 2026-07-04 (validated against code; cost estimate + per-run duration + `getRun` shipped this pass).

## Summary

| Slice | rr status | our status | rough coverage |
|---|---|---|---|
| **AI Router** — backend provider proxy | partial (OpenRouter tiers) | 🟡 **we exceed rr on BYOK** + est. cost now, lag on the public proxy | ~50% |
| **AI Chat** — workbench / sidebar / search | partial (FAB only) | 🟡 workbench + persistence + 4-tool registry | ~44% |
| **AI Agents** — autonomous workers | partial (in-memory) | 🟡 runner + traces + persistence + duration + getRun | ~40% |
| **AI Admin** — console (8 tabs) | scaffold-only | 🟡 providers/models/audit + content totals | ~40% |
| **AI Studio** — generation canvas | scaffold-only | ⬜ not started | 0% |
| **shared/agentic** — the tool kit | implemented (lib) | 🟡 AI-SDK tools + tool/skill registries | ~30% |
| **Create Your MCP** — MCP server | partial (templates) | 🟡 **bearer + OAuth 2.1 live**; rate-limit 5c next | ~70% |

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
- ⬜ **Public `/v1` OpenAI-compatible endpoint** (point Claude Code / Codex / Cursor at us) — 🅿️ parked
- ⬜ Combos: fallback / round-robin / fusion (panel + judge)
- ⬜ Per-model cooldown + backoff + rate-limit guard
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
- ⬜ Multimodal attachments (image / PDF / audio)
- ⬜ Branching / forking threads
- ⬜ RAG citations (vector search)
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
- ⬜ Hard cost cap + kill switch
- ⬜ Shareable trace URL
- ✅ New/edit agent wizards — `AgentForm` (name/model/instructions/tool-picker/maxSteps/temperature), used for both create + edit

## AI Admin — Console (Providers · Models · Instructions · Skills · Tools · Agents · Budgets · Audit)
> rr = scaffold only (no components, no backend). **Currently building (loop iteration 4).**

- ✅ Admin section mount (super-admin gated, `admin.ts` isSuperAdmin)
- ✅ Users + connections + oauth counts
- ✅ **Providers** overview (system-wide, by slug — `adminOverview`)
- ✅ **Models** overview (global top models)
- ✅ Content totals (threads / messages / agent-runs / requests / tokens)
- 🟡 **Audit** (usage log is proto-audit; no dedicated audit table yet)
- ⬜ **Instructions** tab (system-prompt registry)
- ⬜ **Skills** tab
- ⬜ **Tools** tab (tool registry / SSOT)
- ⬜ **Agents** tab (agent definitions)
- ⬜ **Budgets** tab (cost caps + enforcement)
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
- ⬜ Rate limiting / anti-abuse (open DCR) — **5c, next**

---

## Beyond rr (we have, rr does not)
- ✅ **3 OAuth subscription logins**: OpenAI ChatGPT/Codex, **Claude Pro/Max**, OpenRouter — rr has none
- ✅ **22-provider BYOK** with per-user AES encryption — rr = one shared OpenRouter key
- ✅ **Token savers** (Caveman / Ponytail system-prompt injection) — not in rr
- ✅ models.dev auto-updating catalog + host-gating
- ✅ Landing page, OG image, super-admin gate, dashboard sidebar
- ✅ **Full-width UI** (landing + dashboard, 1520px fluid) · landing reflects every shipped feature (Chat / Agents / Providers / Usage / MCP / Admin) · Overview default with quick-links + connect nudge
- ✅ **Provider key validation** — a pasted API key is tested with a real 1-token call the moment you Save it (not the first time you chat), Providers list shows a persisted health badge (VERIFIED / NEEDS ATTENTION / NOT TESTED / NO AUTO-CHECK) + on-demand recheck

## What's next (loop order)
- ✅ **AI Admin console** — providers/models/audit + content totals
- 🟡 **Create Your MCP** — bearer (5a) + OAuth 2.1 (5b) **live + ChatGPT-connectable**; rate-limit + revoke-all (5c) next
6. **AI Studio** — generation canvas
- backlog: chat Search mode, agent scheduling, public `/v1` router (🅿️), the 8-tab admin registries
