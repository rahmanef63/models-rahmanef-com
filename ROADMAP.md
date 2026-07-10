# Manef — Roadmap & Vision

> **models-rahmanef-com** — a multi-tenant, bring-your-own-key AI foundation.
> This doc is for anyone deciding whether to **contribute**. It says what Manef *is*, where it's
> going, and how to ship a piece of it. The granular feature matrix vs the field lives in
> [`docs/COMPARISON-hermes-openclaw-9router.md`](docs/COMPARISON-hermes-openclaw-9router.md).

## The thesis — a foundation, not a competitor

OpenClaw owns **channels**, 9Router owns **routing**, Hermes owns the **learning loop**. Manef is not
trying to out-channel or out-route them — measured on raw feature count it is younger than all three.

Manef is a *different kind of thing*: the **multi-tenant, encrypted, composable layer underneath** an
AI product. Two things make it a solution rather than a me-too:

1. **It's safe by default for real users, not one operator.** Every credential is per-user
   AES-256-GCM encrypted at rest and host-gated; tenancy is enforced by `@convex-dev/auth`. The other
   three are single-user tools that store plaintext keys. If you want to give *your users* AI features
   without holding their keys in the clear, that problem is unsolved outside Manef.
2. **Every capability is a droppable slice.** Each feature is an [rr vertical slice](CLAUDE.md) —
   `slice.json` + `slice.contract.ts` + `slice.manifest.json` + a props-driven UI — so it installs
   into any rr app with one command instead of being forked out of a monolith. Manef is both a working
   product *and* the reference catalog for those slices.

So the pitch to a contributor isn't "help us catch OpenClaw." It's: **build the piece you need once,
here, as a slice — and every rr app gets it, multi-tenant and encrypted, for free.**

## Where it is now (v0.1, shipped)

13 rr slices + the cross-cutting core, live on Convex Cloud + Dokploy:

- Multi-tenant **BYOK gateway** — 22 providers, per-user AES-256-GCM, host-gated, models.dev catalog
- **Agent loop** — `runAgent` multi-step tool loop, saved agent defs, persisted runs + traces
- **Memory** — per-scope memory, auto-summaries, + an Obsidian-style **memory graph**
- **MCP server** — bearer + OAuth 2.1 PKCE + DCR, rate-limited, ChatGPT-connectable
- **MCP client** — connect external MCP servers (HTTP/SSE); their tools surface to agents, per-workspace scoped
- **`/v1` gateway** — OpenAI + Anthropic compatible (`sk-rr` keys; Claude Code works today)
- **Channels** — Telegram / Slack / WhatsApp / Discord inbound (v0.1)
- **Ops** — scheduled agents, usage rollups, spend caps, append-only audit
- **Provider-pool failover** — same-provider ≤3-attempt failover with cooldown/backoff on the hot path
- **Workspaces** — role-based invites, per-workspace isolation

Quality bar: see [`audit.md`](audit.md) — 0 HIGH issues, avg ~87/100, 3 fix passes.

## Next — adopt from the field

Highest-leverage gaps the others already prove out (who has it in parens). Each is a slice-sized task.

- [ ] **OAuth-authenticated external MCP servers** — connect to MCP servers behind an OAuth login (the MCP client + static-header auth already ship; stdio-host is out of scope on Convex) *(hermes, openclaw)*
- [ ] **Modalities** — vision + embeddings (→ RAG), then TTS/STT *(all three)*
- [ ] **Streaming `/v1` + tool passthrough** — resumable SSE + client `tools`/`tool_choice` *(hermes, openclaw, 9router)*
- [ ] **More channels** — beyond the 4 inbound; harden Discord (type-5 deferred) *(hermes, openclaw)*
- [ ] **Cost / quota dashboard** — "X% left", per-model spend *(hermes, openclaw, 9router)*
- [ ] **Multi-key pool write path** — register >1 labelled key per provider so the shipped failover pool is populatable *(openclaw, 9router)*
- [ ] **More OAuth logins** — Copilot / Qwen / Gemini-CLI *(all three)*
- [ ] **CLI / TUI surface** *(hermes, openclaw)*

## The vision — what none of them ship

The greenfield (from [COMPARISON §6](docs/COMPARISON-hermes-openclaw-9router.md)). This is where Manef
leads instead of catches up — each also lands as a droppable slice:

- [ ] **One policy engine** — a single language for approval, sandbox, budget, and tool scope
- [ ] **One observability timeline** — channel in → memory used → model picked → fallback → cost out
- [ ] **Portable memory + skill contract** — move memory/skills across runtimes without a rewrite
- [ ] **Task-aware cost governance** — pick a model by task difficulty + budget, not a static fallback
- [ ] **First-class eval loop** — outcome eval + user feedback + skill regression in one system

## How to contribute a slice

1. **Pick** an unchecked item above (or open an issue proposing one). Small first slice? `MCP client` or `cost dashboard`.
2. **Read** [`CLAUDE.md`](CLAUDE.md) — the rr conventions are enforced: vertical slices under
   `web/frontend/slices/<slug>/`, Convex feature dir under `web/convex/features/<slug>/`, args
   validators + `.withIndex` + in-handler authz, ≤200-line files, theme tokens.
3. **Ship the trio** — `slice.json` + `slice.contract.ts` + `slice.manifest.json` + a props-driven UI,
   so the slice is portable (no hardcoded consumer URLs/env/copy).
4. **Verify** — `npx tsc --noEmit` + `npm test` green, then open a PR. Keep it one slice per PR.

New to the codebase? Good starting reads: [`docs/FEATURES-LOG.md`](docs/FEATURES-LOG.md) (shipped
scope), [`docs/AI-SLICES-PROGRESS.md`](docs/AI-SLICES-PROGRESS.md) (rr parity), and any existing slice
under `web/frontend/slices/` as a template (`usage-rollups` is the reference trio shape).
