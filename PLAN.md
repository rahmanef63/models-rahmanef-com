# models-rahmanef-com — ULTRAPLAN

Portable **multi-tenant BYOK model registry**: drop it into any project so every user/tenant
brings their own provider keys, and the model list stays fresh automatically. Package name
`@rahmanef/models`. Deploy target (later): `models.rahmanef.com`.

---

## 1. What we learned from openclaw + hermes-agent

Both are mature agent codebases. Both solve catalog + BYOK well. **Both are single-user** — and
both explicitly note the fix for multi-tenant is the same. That fix is this repo.

### openclaw (npm `openclaw`, TS gateway, v2026.6.10)
- **Catalog:** no central list. Per-vendor **plugin registry** (`registerProvider` / `registerModelCatalogProvider`), ~60 providers. Each ships a **static** offline catalog + optional **live** `/models` fetch, TTL-cached, static fallback on error. Persisted to `~/.openclaw/agents/<id>/agent/models.json`.
- **Model ref:** `provider/model`, split on **first** `/`; `provider/*` wildcard allowlist; `resolveDynamicModel` for router/proxy providers.
- **BYOK:** single token-sink file `auth-profiles.json`, named profiles per provider, deterministic order. Env priority `MODELS_LIVE_<P>_KEY > <P>_API_KEYS > <P>_API_KEY > <P>_API_KEY_N`. Rotate keys **only** on rate-limit. PKCE OAuth per provider.
- **Transport:** its own SDK, **2 wire protocols** — `openai-completions`, `anthropic-messages`. Aggregators (OpenRouter, Vercel AI Gateway, LiteLLM) are just openai-compatible providers.
- **Multi-tenant:** ❌ single-operator. Isolation = per-agent-dir / per-gateway-process. Their note: *"thread a tenant/account id through `resolveProviderAuth(ctx)` and swap the file store for a tenant-keyed encrypted secret store — the hook seam already exists."*

### hermes-agent (Python agent CLI)
- **Catalog:** 3 layers — (1) **models.dev** `api.json` for capabilities/pricing → `ModelInfo`; (2) curated picker manifest (Nous-hosted JSON + GitHub raw fallback); (3) live `/v1/models`. Connection facts in a hand-maintained `PROVIDER_REGISTRY`.
- **Auto-update:** lazy TTL, no daemon — `in-mem → disk(by mtime) → network → stale-disk fallback`; `force_refresh` command; stale gets a shortened 5-min retry window. Cache `~/.hermes/models_dev_cache.json`, TTL 1h.
- **BYOK:** `~/.hermes/auth.json` (0o600, atomic `O_EXCL`, cross-process lock), ordered `api_key_env_vars` per provider. **Host-gated** key selection — resolve `base_url` FIRST, only pick a key whose host matches (a host-matching security fix). Extensive OAuth.
- **Transport:** OpenAI Python SDK as universal openai-compatible client + bespoke adapters (Anthropic, Gemini native, Bedrock, Responses, Copilot).
- **Multi-tenant:** ❌ single-user. Profiles = independent `HERMES_HOME` dirs; credential pool = multi-key same-provider failover for one user. Their note: *"thread a tenant/credential context through provider resolution instead of reading global env/auth.json."*

### What we steal
1. **models.dev** as the whole catalog + auto-update source (hermes). No per-vendor plugin to maintain.
2. **Lazy TTL cache with stale fallback** + force-refresh (hermes).
3. **`provider/model` split-on-first-`/`** + wildcard allowlist (openclaw).
4. **Env-var priority chain** with `LIVE` override (openclaw).
5. **Host-gated key selection** (hermes security fix).
6. **2 wire protocols** cover ~everything (openclaw).
7. **The gap both left → our headline:** thread `tenantId` through resolution via a pluggable `CredentialStore`.

---

## 2. Architecture

```
resolveModel("provider/model", { tenantId, store })
        │  parseRef → split on first '/'
        │  registry[provider] → { baseUrl, protocol, envVars }   (connection facts)
        │  store.getKey(tenantId, provider) → host-gated key      (BYOK, per-tenant)
        ▼
  ResolvedModel { ref, provider, model, baseUrl, apiKey, protocol, info? }
        │
        ├─ chat(resolved, {messages})            ← built-in openai/anthropic caller
        └─ or hand to Vercel AI SDK / your client

getCatalog()  → models.dev api.json, lazy TTL cache + stale fallback   (auto-update)
```

- **Core** (`src/`, zero runtime deps, ESM + JSDoc): `catalog`, `registry`, `store`, `resolve`, `call`. Runs anywhere Node ≥18 / any bundler (Next, Convex).
- **CredentialStore seam** = portability. Built-in: `envCredentialStore` (dev/single-tenant), `memoryCredentialStore` (tests). Multi-tenant: `adapters/convex`.
- **Convex adapter** (`adapters/convex/`): `modelCreds` table (AES-256-GCM ciphertext keyed by `tenantId`+`provider`), `setCredential`/`deleteCredential`/`listConfiguredProviders`, `convexCredentialStore(ctx, api)`. Host app keeps **its own auth** and derives `tenantId` from it → multi-tenant, BYOK, provider-agnostic auth. Exactly the ask.

Encryption: both source projects store plaintext (fine for one local user). A shared DB is not
one user → we encrypt at rest (`MODELS_ENC_KEY`).

---

## 3. Roadmap

- [x] **Phase 0 — core lib** (this commit): catalog auto-update, registry, resolve+host-gate, stores, caller, self-check.
- [x] **Phase 1 — Convex multi-tenant adapter** (this commit): encrypted per-tenant BYOK table + store + mutations.
- [x] **Phase 2 — two front-ends over one surface**: HTTP CRUD API (`createModelsApi`, Web-standard handler, storage+auth injected), a terminal CLI (`models add/ls/rm/models/init`, local file store or remote API), and a single-file demo dashboard (`examples/dashboard.html`). `models init` copies the Convex adapter into a host project.
- [x] **Phase 3 — deploy** — **LIVE at https://models.rahmanef.com** (Vercel + Convex Cloud). `web/` = Next 16 + Convex + `@convex-dev/auth` (Password); per-user encrypted BYOK (`tenantId = getAuthUserId(ctx)`); catalog from models.dev client-side; test-chat action. Convex code = Convex-direct (no `node:fs`). BYOK flow smoke-verified on prod (signup → add key → list → chat pipeline → delete; per-user isolation holds).
- [ ] **Phase 4 (optional)**: per-provider live `/v1/models` merge for local/custom endpoints (Ollama/LM Studio), multi-key rotation on rate-limit, PKCE OAuth flows (openclaw/hermes patterns).

---

## 4. Status

Shipped as `@rahmanef/models` (library + Convex adapter) with a live reference app at
[models.rahmanef.com](https://models.rahmanef.com). See the [README](./README.md) for the full,
current documentation — this file is kept as the original design notes.
