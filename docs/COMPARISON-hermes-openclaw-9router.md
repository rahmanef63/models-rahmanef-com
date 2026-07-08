# Manef vs OpenClaw vs Hermes vs 9Router

> Evidence-based comparison of three AI systems against **Manef** (this repo, `models-rahmanef-com`).
> Manef is distilled from **OpenClaw + Hermes + 9Router**, so this doc doubles as a **gap / adopt
> checklist**: what the others ship that Manef could pull in next.
> Reference-project facts verified 2026-07-08 against each official site + GitHub README (see §9).
>
> Legend: ✅ have it · 🟡 partial / adjacent / weaker form · ❌ absent

---

## 0. Positioning at a glance

Where each project sits in the agentic-AI stack, and the role Manef plays. Rows Manef can't confirm
from a fetched source are marked *(unverified)*; the granular feature matrix is §2–§4.

| Aspect | OpenClaw | Hermes | 9Router | Manef |
|---|---|---|---|---|
| Stack layer | Distribution / channel gateway | Agent runtime + memory / learning loop | Routing / cost layer | Multi-tenant BYOK dashboard + agent runner |
| Tagline | "Personal AI assistant you run on your own devices" | "The agent that grows with you" | "FREE AI Router & Token Saver" | Per-user model dashboard + agent loop + MCP |
| Interfaces | ~23–29 chat channels + mobile/desktop nodes | Telegram/Discord/Slack/WhatsApp/Signal/Email + CLI/TUI | OpenAI-compatible endpoint for coding CLIs | Web dashboard + OAuth MCP server (no channels yet) |
| Memory | Marketed, no README mechanism *(depth unverified)* | ✅ Cross-session (FTS5 + curated + user model) | ✗ (only SQLite config/usage) | Per-user Convex isolation; no learning loop |
| Model routing | Model-agnostic BYOM, per-agent | Provider-agnostic (Nous Portal/OpenRouter/OpenAI/own) | ✅ 3-tier fallback, combos, 40+ providers / 100+ models, RTK saver | 22-provider BYOK; manual primary/secondary |
| Multi-agent | ✅ routing to isolated agents | ✅ subagents + Python-RPC | ✗ single-request router | ✅ runAgent loop + agent defs, per-user/session |
| Deploy | npm-global on-device + launchd/systemd daemon; Docker = sandbox | 6 backends (local/Docker/SSH/Singularity/Modal/Daytona), $5 VPS | Localhost / VPS / Docker / CF Workers | Dokploy + Convex Cloud (auto-deploy hook) |
| Database | Not documented (workspace files) | FTS5 (SQLite inferred, not named) | SQLite | Convex (Cloud now; self-hosted = rr target) |
| License | MIT | MIT | MIT | private / internal |
| Weak spot | β Beta; memory depth undocumented | Needs Nous Portal sub / 5 API keys | Router only; free tiers can vanish | No channels; no learning loop; not self-hosted yet |

---

## 1. What each project IS

| Project | One-liner | Language / runtime |
|---|---|---|
| **hermes** | Mature single-user self-improving AI agent: CLI + TUI + desktop + a ~25-channel messaging gateway, a learning loop (auto-creates/improves skills, curated memory, FTS5 recall), 28 provider plugins over a models.dev catalog, cron, MCP client+server, ACP. | Python 3.11–3.13 core + Node (WhatsApp bridge, TUI, web) + React19/Vite/Electron/Tauri desktop + Rust (Tauri) |
| **openclaw** | Self-hosted single-user "personal AI assistant" Gateway (WebSocket control plane) reaching you on 25+ chat channels, exposing OpenAI/OpenResponses HTTP, fronting ~60 pluggable providers with BYOK auth-profiles, agentic tool/skill/plugin runtime, MCP server + client, phone/desktop node mode. | TypeScript / Node.js (ESM, compiled `dist/*.js`, `bin openclaw.mjs`) |
| **9router** | Self-hosted multi-provider AI router: one OpenAI/Anthropic/Gemini request fans out to 94 providers via a provider-agnostic SSE translation engine, plus a transparent MITM proxy that hijacks desktop coding-agent traffic and an RTK token-saver layer. | JavaScript/JSX on Node 22 (Next.js 16 + React 19.2, standalone) + SQLite; also global `9router` npm CLI |
| **Manef** (`models-rahmanef-com`) | Multi-tenant BYOK model dashboard + agent runner, distilled from openclaw+hermes: 22 providers over a models.dev catalog, per-user AES-256-GCM keys, a unified tool registry feeding an agent loop and an OAuth-2.1 MCP server. | Next.js 16 / React 19 frontend (Dokploy/Docker) + Convex Cloud backend + `@convex-dev/auth`; rr vertical slices |

---

## 2. CHANNELS matrix (the headline)

Every channel/surface across all four, one row each.

### Messaging channels

| Channel | hermes | openclaw | 9router | Manef |
|---|:--:|:--:|:--:|:--:|
| telegram | ✅ | ✅ | ❌ | ❌ |
| whatsapp | ✅ | ✅ | ❌ | ❌ |
| discord | ✅ | ✅ | ❌ | ❌ |
| slack | ✅ | ✅ | ❌ | ❌ |
| signal | ✅ | ✅ | ❌ | ❌ |
| sms (Twilio) | ✅ | ✅ | ❌ | ❌ |
| email / gmail-pubsub | ✅ | 🟡 | ❌ | ❌ |
| matrix | ✅ | ✅ | ❌ | ❌ |
| line | ✅ | ✅ | ❌ | ❌ |
| mattermost | ✅ | ✅ | ❌ | ❌ |
| irc | ✅ | ✅ | ❌ | ❌ |
| google_chat | ✅ | ✅ | ❌ | ❌ |
| microsoft teams | ✅ | ✅ | ❌ | ❌ |
| ntfy | ✅ | ❌ | ❌ | ❌ |
| simplex | ✅ | ❌ | ❌ | ❌ |
| home assistant | ✅ | ❌ | ❌ | ❌ |
| feishu / lark | ✅ | ✅ | ❌ | ❌ |
| wecom / WeChat Work | ✅ | ❌ | ❌ | ❌ |
| weixin / WeChat | ✅ | ✅ | ❌ | ❌ |
| qqbot / QQ | ✅ | ✅ | ❌ | ❌ |
| dingtalk | ✅ | ❌ | ❌ | ❌ |
| bluebubbles / iMessage | ✅ | ✅ | ❌ | ❌ |
| tencent yuanbao | ✅ | ✅ | ❌ | ❌ |
| viber | 🟡 | ❌ | ❌ | ❌ |
| nextcloud talk | ❌ | ✅ | ❌ | ❌ |
| nostr | ❌ | ✅ | ❌ | ❌ |
| synology chat | ❌ | ✅ | ❌ | ❌ |
| tlon / urbit | ❌ | ✅ | ❌ | ❌ |
| twitch | ❌ | ✅ | ❌ | ❌ |
| zalo (bot / clawbot / personal) | ❌ | ✅ | ❌ | ❌ |
| clickclack | ❌ | ✅ | ❌ | ❌ |
| voice call (telephony, Plivo/Twilio) | 🟡 | ✅ | ❌ | ❌ |
| generic inbound webhook | ✅ | ✅ | ❌ | ❌ |

### Non-chat surfaces / APIs

| Surface | hermes | openclaw | 9router | Manef |
|---|:--:|:--:|:--:|:--:|
| web dashboard / control UI | ✅ | ✅ | ✅ | ✅ |
| cli | ✅ | ✅ | ✅ | ❌ |
| tui | ✅ | ✅ | ❌ | ❌ |
| desktop app (Electron / menubar / hub) | ✅ | ✅ | ❌ | ❌ |
| mobile / phone node apps | 🟡 (Termux) | ✅ (iOS/Android node) | ❌ | ❌ |
| REST API — OpenAI Chat Completions | ✅ | ✅ | ✅ | ❌ |
| REST API — OpenAI Responses (`/v1/responses`) | 🟡 (client-side) | ✅ | ✅ | ❌ |
| REST API — Anthropic Messages | 🟡 (client-side) | 🟡 (southbound) | ✅ | ❌ |
| REST API — Gemini/vertex compatible | 🟡 (client-side) | ❌ | ✅ | ❌ |
| REST API — embeddings (`/v1/embeddings`) | ❌ | ✅ | ✅ | ❌ |
| SSE streaming endpoint | ✅ | ✅ | ✅ | 🟡 (via MCP transport) |
| MCP server (exposes own tools/convos) | ✅ | ✅ | 🟡 (host only, no own CRUD) | ✅ |
| MCP client / host (spawns external servers) | ✅ | ✅ | ✅ | ❌ |
| ACP adapter (editor host, Zed/Codex/Copilot) | ✅ | ✅ | ❌ | ❌ |
| MITM debug/interception proxy | ❌ | ✅ (debug) | ✅ (traffic hijack) | ❌ |
| CLI-tool endpoint presets (point Claude Code/Codex/etc. at it) | 🟡 | ❌ | ✅ | ❌ |
| tunnel exposure (Tailscale / CF / Vercel) | 🟡 | ✅ (Tailscale serve/funnel, Bonjour) | ✅ (Tailscale + proxy pools) | ❌ |

### 2b. MODALITIES

| Modality | hermes | openclaw | 9router | Manef |
|---|:--:|:--:|:--:|:--:|
| chat / text | ✅ | ✅ | ✅ | ✅ |
| vision (image understanding) | ✅ | ✅ | ✅ | ❌ |
| image generation | ✅ | ✅ | ✅ | ❌ |
| embeddings | ❌ | ✅ | ✅ | ❌ |
| tts (audio out) | ✅ | ✅ | ✅ | ❌ |
| stt / transcription | ✅ | ✅ | ✅ | ❌ |
| video generation | ✅ | ✅ | ❌ | ❌ |
| music generation | ❌ | ✅ | ❌ | ❌ |
| web search | ✅ | ✅ | ✅ | ❌ |
| realtime voice call | 🟡 (voice mode) | ✅ | ❌ | ❌ |

---

## 3. FEATURE comparison (the other categories)

| Category | hermes | openclaw | 9router | Manef | Terse note |
|---|:--:|:--:|:--:|:--:|---|
| Model providers | ✅ | ✅ | ✅ | ✅ | hermes 28 plugins · openclaw ~60 · 9router 94 · **us 22 BYOK** |
| Catalog | ✅ | ✅ | 🟡 | ✅ | hermes+us live **models.dev** w/ TTL+offline · openclaw per-provider 3-tier · 9router models.dev **baked-in static** |
| BYOK / credentials | ✅ | ✅ | ✅ | ✅ | others = plaintext JSON (0600) · **us = per-user AES-256-GCM in Convex, host-gated** (strongest at rest) |
| Transport / wire | ✅ | ✅ | ✅ | ✅ | 9router = format translator pivoting via OpenAI · us = Vercel AI SDK + openai-compat baseURL + codex/claude OAuth paths |
| Agents | ✅ | ✅ | 🟡 | ✅ | hermes self-improving + subagents · openclaw subagents/dreaming/commitments · 9router = router only (combos) · **us runAgent loop + agentDefs** |
| Tools / tool-calling | ✅ | ✅ | ✅ | 🟡 | hermes 40+ · openclaw typed+policy+Tool Search · 9router translation+RTK · **us unified registry, 4 agent tools (small)** |
| MCP | ✅ | ✅ | 🟡 | 🟡 | hermes+openclaw both roles · 9router client/host only · **us server only (bearer + OAuth 2.1 PKCE + DCR), no client** |
| OAuth subscription logins | ✅ | ✅ | ✅ | 🟡 | hermes broad · openclaw PKCE (ChatGPT/Claude/Copilot/Qwen/Gemini) · 9router 17 providers · **us 3 (ChatGPT/Codex, Claude Pro/Max, OpenRouter)** |
| Multi-tenancy | ❌ | 🟡 | ❌ | ✅ | all others single-user (openclaw = per-persona isolation, not tenancy) · **us = real per-user isolation via @convex-dev/auth** |
| UI surfaces | ✅ | ✅ | ✅ | 🟡 | others CLI+TUI+desktop+mobile · **us web dashboard only** |
| Deploy & runtime | ✅ | ✅ | ✅ | ✅ | hermes uv/Docker/Nix/6 backends · openclaw Gateway daemon + many VPS · 9router Docker + self-updating npm · **us Dokploy + Convex Cloud, auto-deploy hook** |
| Token savers / usage | ✅ | ✅ | ✅ | 🟡 | hermes compress/caching · openclaw Tokenjuice/Tool Search · 9router RTK 12 filters + caveman · **us caveman/ponytail prompt injection only** |
| Cron / scheduling | ✅ | ✅ | ❌ | 🟡 | hermes croniter + NL jobs · openclaw scheduler + heartbeat + standing-orders · 9router none · **us Convex cron (rate-limit sweep), no scheduled agents** |
| Skills / plugins | ✅ | ✅ | 🟡 | ✅ | hermes self-improving 19-cat + Hub · openclaw SKILL.md + Plugin SDK (80 ext) · 9router SKILL.md docs registry · **us skills registry, 6 bundles** |

---

## 4. Per-category CHECKLISTS (from OUR perspective)

`[x]` = we already have it · `[ ]` = a gap the others have that we could adopt (annotated with who has it).

### Channels
- [x] Web dashboard surface
- [x] MCP server surface (bearer + OAuth 2.1)
- [ ] Any messaging channel at all — telegram/whatsapp/discord/slack/signal (hermes, openclaw)
- [ ] Enterprise/regional chat — teams, feishu, line, mattermost, WeChat/QQ (hermes, openclaw)
- [ ] SMS + voice-call telephony (openclaw; hermes sms)
- [ ] CLI + TUI surfaces (hermes, openclaw, 9router-cli)
- [ ] Desktop app (hermes Electron, openclaw menubar/hub)
- [ ] Mobile / phone node apps (openclaw iOS/Android node mode)
- [ ] OpenAI-compatible REST API (`/v1/chat/completions`, `/v1/models`) (hermes, openclaw, 9router)
- [ ] Anthropic / Gemini / Responses compatible REST (9router; openclaw responses)
- [ ] Inbound webhook + email/gmail triggers (hermes, openclaw)
- [ ] ACP editor host (hermes, openclaw)

### Providers
- [x] Multi-provider BYOK registry (22 providers)
- [x] OpenAI-compatible providers need no code (baseURL registry)
- [ ] Scale of catalog: 60–94 providers (openclaw ~60, 9router 94)
- [ ] Meta-gateway providers (LiteLLM, OpenRouter, Vercel AI Gateway, Cloudflare AI Gateway) (openclaw)
- [ ] Per-account multi-key failover with cooldown/backoff (openclaw auth.order, 9router accountFallback)

### Catalog
- [x] models.dev live auto-update with lazy TTL + stale fallback
- [x] Host-gated key/model selection
- [ ] Live per-provider `/v1/models` discovery / `models scan` (hermes fetch_models, openclaw, 9router modelsFetcher)
- [ ] Bundled offline snapshot for zero-network operation (hermes)

### BYOK
- [x] Per-user AES-256-GCM encryption at rest (Convex) — **strongest of the four**
- [x] Host-gated credential access
- [x] Multi-tenant per-user credential isolation — **unique to us**
- [ ] Multi-credential pool / rotation for same-provider failover (hermes credential_pool, openclaw, 9router)
- [ ] SecretRef indirection to external secret stores / keychain (openclaw keyRef/tokenRef)

### Transport
- [x] OpenAI-compat baseURL transport
- [x] Native anthropic / google via Vercel AI SDK
- [x] Bespoke codex/claude OAuth chat paths
- [ ] Format-translation engine pivoting via OpenAI intermediate (9router open-sse, hermes adapters)
- [ ] Native Bedrock / Responses app-server / non-JSON wire (kiro/cursor/protobuf) (hermes, openclaw, 9router)
- [ ] MITM proxy to intercept/remap desktop-agent traffic (9router, openclaw debug)

### Modalities
- [x] Chat / text
- [ ] Vision / image understanding (all three)
- [ ] Image generation (all three)
- [ ] Embeddings (openclaw, 9router)
- [ ] TTS + STT/transcription (all three)
- [ ] Video / music generation (hermes video; openclaw both)
- [ ] Web search + web fetch/scrape tool (all three)

### Agents
- [x] Multi-step tool loop (runAgent, persisted runs + traces)
- [x] Saved agent definitions (agentDefs: name×model×tools×skills×maxSteps)
- [ ] Sub-agent delegation / parallel specialist lanes (hermes delegate, openclaw subagents)
- [ ] Personas / SOUL.md identity files (hermes, openclaw)
- [ ] Self-improving learning loop + curated memory (hermes curator/skill_manager)
- [ ] Standing orders / heartbeat / commitments / dreaming (openclaw)

### Tools
- [x] Unified tool registry feeding agent + MCP surfaces
- [ ] Broad built-in toolset — web/browser/files/terminal/computer-use (hermes 40+, openclaw)
- [ ] Tool Search (avoid sending all schemas to model) (openclaw, 9router-adjacent)
- [ ] Tool-output compaction filters (openclaw Tokenjuice, 9router RTK)

### MCP
- [x] MCP server (bearer + OAuth 2.1 PKCE, DCR, rate-limited)
- [ ] MCP **client** — connect to external MCP servers, discover + register tools (hermes, openclaw, 9router)
- [ ] MCP-server OAuth for outbound servers (hermes mcp_oauth, openclaw login/probe)
- [ ] Expose conversations as MCP tools to Claude/Cursor/Codex (hermes, openclaw serve)

### OAuth / subscription logins
- [x] OpenAI ChatGPT/Codex login
- [x] Claude Pro/Max login
- [x] OpenRouter
- [ ] GitHub Copilot (hermes, openclaw, 9router)
- [ ] Qwen / Gemini-CLI / Kiro / Cursor / iFlow etc. (hermes, openclaw, 9router 17)
- [ ] Token-sink design to avoid cross-tool refresh invalidation (openclaw)

### Multi-tenancy
- [x] Real per-user isolation via @convex-dev/auth — **only project here with true tenancy**
- [x] Per-user encrypted credential store
- [ ] (not a gap) others are single-user; openclaw only has per-persona/agent isolation

### UI
- [x] Web dashboard (Next 16 / React 19, shadcn/Tailwind)
- [ ] CLI + TUI (hermes, openclaw)
- [ ] Desktop / menubar / hub app (hermes, openclaw)
- [ ] Mobile node app with camera/screen/voice/canvas (openclaw)
- [ ] Visual flow editor + translator playground (9router @xyflow + Monaco)

### Deploy
- [x] Dokploy (Docker) frontend + Convex Cloud backend
- [x] Pre-push auto-deploy hook
- [ ] Convex **self-hosted** per rr baseline (currently Cloud — known gap)
- [ ] One-line installer / Docker image / Nix / many-VPS guides (hermes, openclaw)
- [ ] Self-updating package (9router detached updater)

### Token savers
- [x] caveman / ponytail system-prompt injection
- [ ] Prompt caching + context compaction/session-pruning (hermes, openclaw)
- [ ] Tool-output compression (openclaw Tokenjuice, 9router RTK 12 filters)
- [ ] Provider quota / cost / usage tracking dashboard ("X% left") (hermes, openclaw, 9router)

### Cron
- [x] Convex cron (rate-limit sweep) infrastructure
- [ ] User-facing scheduled agent jobs delivered to a channel (hermes cronjob_tools, openclaw cron)
- [ ] NL "create a job" from the agent (hermes, openclaw)
- [ ] Heartbeat / standing-orders autonomy (openclaw)

### Skills
- [x] Skills registry (6 instruction bundles)
- [x] Skills consumable by the agent runner
- [ ] Self-improving skill creation + provenance/audit (hermes)
- [ ] Community skill hub install (hermes agentskills.io, openclaw ClawHub)
- [ ] Installable runtime plugin SDK (providers/channels/tools/hooks) (openclaw Plugin SDK, hermes plugins)

---

## 5. Biggest gaps to consider adopting (ranked)

1. **Messaging channels — zero today.** Everyone but us reaches the user on chat platforms. Telegram + WhatsApp + Discord + Slack is the highest-leverage first wave (hermes, openclaw). This is the single largest category gap.
2. **Non-chat modalities.** We are chat/text only; the other three all ship vision + image-gen + tts + stt, and two ship embeddings (openclaw, 9router). Embeddings especially unlock RAG.
3. **MCP client / host.** We serve MCP but cannot consume external MCP servers. All three others are MCP clients (hermes+openclaw both roles). Adopting a client turns every community MCP into a tool.
4. **OpenAI/Anthropic-compatible REST API.** hermes, openclaw, 9router all expose `/v1/chat/completions` (+ `/v1/models`, responses). We only expose MCP — a compat API would let any existing tool point at us.
5. **Scheduled agents (real cron surface).** We have Convex cron plumbing but no user-facing "run this agent on a schedule and deliver to a channel" (hermes, openclaw). Pairs naturally with gap #1.
6. **Usage / cost / quota tracking + token-output compaction.** We only have prompt-injection savers; the others track spend and compress tool output (9router RTK, openclaw Tokenjuice, hermes usage_pricing).
7. **More subscription logins + multi-key failover.** Add Copilot / Qwen / Gemini-CLI OAuth and a same-provider credential pool with cooldown/backoff (hermes credential_pool, openclaw auth.order, 9router accountFallback).
8. **CLI / TUI / desktop surfaces.** We are web-only; every competitor ships at least CLI+TUI, most ship desktop, openclaw ships mobile node apps.
9. **Provider-format translation + optional MITM.** 9router's pivot-through-OpenAI translator and desktop-agent traffic hijack are how you retarget existing coding CLIs — a differentiated adopt if we want to front Claude Code/Codex.

**What we already lead on (don't lose):** true **multi-tenancy** (only Manef), **AES-256-GCM per-user encryption at rest** (others store plaintext 0600 JSON), and the **rr vertical-slice / droppable-block** architecture that makes any of the above adoptable as a shippable slice.

---

## 6. What all four still lack (shared gaps)

§5 is Manef's *adopt-from-others* list. This is the opposite: things **none** of the four ship
end-to-end — the real greenfield if Manef wants to lead, not catch up.

| Need | Why it matters | Status across all four |
|---|---|---|
| Unified policy engine | One language for approval, sandbox, budget, tool scope | Each has ad-hoc policy; no consistent end-to-end standard |
| Shared observability spine | One timeline: channel in → memory used → model picked → fallback → cost out | Logs siloed (gateway / DB / provider usage) |
| Portable memory + skill contract | Move memory/skills across runtimes without a rewrite | Hermes has the agentskills.io skill standard; memory formats stay non-portable |
| Native cost governance | Pick model by task difficulty + budget, not a static fallback | 9Router is closest (fallback); none is risk/priority-aware |
| First-class eval loop | Outcome eval + user feedback + skill regression in one system | Absent in all four |

---

## 7. Proposed Manef architecture (target — not yet built)

Manef's intended shape as the fusion product (per the design brief). Today's repo is the
dashboard + agent + MCP core (see §1); the layers below are the roadmap, not current state.

```
Surface Layer  ->  OpenClaw-style gateway (WhatsApp live, +Telegram/Discord)
Brain Layer    ->  Hermes-style memory + skill loop (Convex vectorChunks)
Route Layer    ->  9Router-style provider abstraction over OpenRouter (Gemini 3 Flash + GLM fallback)
Data Layer     ->  Convex self-hosted (manef-db) as single source of truth
Infra Layer    ->  VPS + Dokploy for all non-Convex services
```

Core principles: one agent + one session per user (sub-agents for specific tasks); memory centralized
in `vectorChunks`, not scattered; routing stays simple (primary/secondary) before going cost-aware;
every service on its own domain but one shared observability arch.

> **Current vs target.** This repo today runs on **Convex Cloud** (not self-hosted `manef-db`), exposes
> an **MCP server** (no chat channels yet), and uses a **22-provider BYOK registry** (not an
> OpenRouter-primary router). The gateway / `vectorChunks` / OpenRouter-primary lines above describe the
> target Manef deployment from the design brief — they are **not** verified current-repo facts.

---

## 8. FAQ

**Q: Does Manef have to replace OpenClaw entirely?**
No. OpenClaw stays as the gateway / surface layer — it's mature for WhatsApp and other channels. Manef
adds the brain layer (memory) and route layer (cost-aware routing) on top.

**Q: Why not just use Hermes directly?**
Manef already has its own memory architecture via Convex `vectorChunks`, more integrated with the rest
of the stack (Superspace, etc.). Hermes is a pattern reference, not adopted wholesale. (Verified aside:
Hermes ships `hermes claw migrate`, an OpenClaw importer for settings/memories/skills/keys — it
positions itself as an OpenClaw *successor*.)

**Q: Which part of 9Router should Manef adopt first?**
Auto-fallback + token saving (RTK). Manef is still manual primary/secondary; adding automatic fallback
+ quota tracking raises reliability immediately. (Manef already shipped part of this — see the
`fallbackRules` 402/quota failover and `provider-pool` slice.)

**Q: Most realistic MVP for the next 2 weeks?**
Tidy observability (one log timeline), standardize the memory/skill format so it's portable, and add one
simple cost-aware routing layer over the OpenRouter path.

**Q: Is 9Router an agent or a chat app?**
Neither — it's a routing proxy for coding CLIs (Claude Code, Cursor, Codex, …) behind one
OpenAI-compatible endpoint. No memory, no orchestration. That's why Manef borrows its routing ideas,
not its role.

---

## 9. Sources & verification

Live-fetched then adversarially re-fetched **2026-07-08** (6 agents, research + verify passes). All three
references are **MIT / open source** and reachable — except 9Router's marketing site.

| Project | Verified from | Caveats surfaced |
|---|---|---|
| **OpenClaw** | `openclaw.ai` + `github.com/openclaw/openclaw` (+ raw README) | Marked **β Beta**. Homepage markets "persistent memory" but the README documents no memory mechanism → depth *unverified*. Sandboxing is per-**agent/session**, not per-channel. "Runs on own VPS" / bash one-liner install *not* on any fetched page (npm/pnpm global only). |
| **Hermes** | `hermes-agent.nousresearch.com` + `github.com/NousResearch/hermes-agent` | Memory loop, subagents, 6 deploy backends confirmed. DB engine "SQLite" is *inferred* from FTS5, not named. Ships `hermes claw migrate` — an OpenClaw importer (successor positioning). |
| **9Router** | `github.com/decolua/9router` (+ GitHub API) | **`9router.com` returned HTTP 403** — official site could not load; all facts from the repo. README states **40+ providers / 100+ models** (the §3 matrix's "94" is a prior repo-level count, not the README figure). Free-tier availability is volatile (iFlow/Qwen/Gemini-CLI discontinued in 2026). |

Manef facts are code-derived from this repo. The §2–§4 provider *counts* come from prior repo-level
inspection (cloning + counting adapters), which runs deeper than a homepage fetch; the 2026-07-08 pass
confirmed the qualitative facts. The §7 target-architecture lines are from the design brief, **not**
verified current state.
