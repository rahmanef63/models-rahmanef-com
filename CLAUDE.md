# CLAUDE.md — models-rahmanef-com

This project follows **Rahman Resources (rr) conventions**. It is not just a
standalone app — every webapp in this ecosystem is expected to need AI
features, so the AI-feature code here (chat, agents, tool-calling, BYOK
provider registry, MCP server) is meant to eventually become **droppable
block components** consumable by other rr-based apps. Honor every rule
below for every file you write or edit. When in doubt, ask before deviating.

**Compliance snapshot (2026-07-03, full audit — see git history / ask for
details): stack baseline mostly conforms (Next 16 + React 19 pinned,
`proxy.ts`, `@convex-dev/auth`) except Tailwind (absent — plain CSS) and
Convex hosting (Cloud, not self-hosted Docker Compose). Convex data-access
rules mostly conform (args validators 65/65, `.withIndex` 20/20) except a
shared `requireUser`/`requireAdmin` helper (doesn't exist yet — 3 different
inline auth idioms) and a few uncapped `.collect()` calls (`admin.ts`'s
stats aggregates, one uncapped usage-history MCP tool). Vertical-slice
structure, the slice metadata trio, shadcn UI, and the 200-line file cap do
NOT exist yet — this is one monolithic `web/app/app/page.tsx` (1200+ lines)
today, not slices. These are known, tracked gaps, not oversights — see
`docs/AI-SLICES-PROGRESS.md` for feature-level rr-slice parity tracking.
Do not "fix" these unprompted; migration is a deliberate, separately-scoped
effort.**

---

# rr conventions (single source of truth)

## Stack baseline
Every rr-based app targets the same modern Next + React + Convex baseline. Drift = compatibility risk for the rr slice catalog.

- **Next.js 16 + React 19** — Pin Next ^16 and React ^19 in package.json. No `middleware.ts` — use `proxy.ts` instead.
  - Why: Next 16 deprecates middleware.ts and ships App Router + Cache Components as the default.
- **Tailwind v4** — Use Tailwind v4 with `@tailwindcss/postcss`. Bridge a v3 config via `@config` only during migration.
- **Convex self-hosted** — Use Convex self-hosted via Docker Compose on the same Dokploy node. Pin `convex` ^1.16 minimum.
  - Why: Self-hosted = zero per-user cost, full schema portability, deploy via `npx convex deploy --env-file …`.
- **Auth = @convex-dev/auth** — Use `@convex-dev/auth` for sessions. NO Clerk. Custom auth slices are allowed only when @convex-dev/auth is documented as insufficient.

## Vertical slice structure
Every feature is a vertical slice that owns its full stack. No deep cross-slice imports.

- **Slice layout** — Each feature lives at `frontend/slices/<slug>/` (UI + types) + optionally `convex/features/<slug>/` (schema + queries + mutations).
- **Barrel-only cross-slice imports** — Other slices import via `@/features/<own-slug>` only. Never reach into `@/features/foo/lib/internal-thing.ts`.
  - Why: Deep imports lock you into another slice's internal layout. Barrels are the contract.
- **Slice metadata trio** — Every slice ships `slice.json` (schema-validated metadata), `slice.contract.ts` (typed DSL), and `slice.manifest.json` (CLI distribution payload).
- **Props-driven portability** — Portable slices NEVER hardcode consumer-specific URLs, env names, or copy. Hardcode = lift blocker.

## Convex rules
- **Always validate public mutation/query args** — Every `mutation()` / `query()` reachable from the client must declare `args:` with `v.*` validators.
  - Why: Convex's audit-bp marks missing validators as P0 — anything goes from a crafted client without them.
- **No bare .collect()** — `ctx.db.query(...).collect()` scans the table. Use `.withIndex(...).take(N)` or paginate.
  - Why: Bare collects bypass the query-budget guardrails and degrade as the table grows.
- **Server-side authz on every mutation** — Call `requireUser` / `requireAdmin` from `convex/_shared/auth.ts` inside the handler. Never trust route-layer gates alone.
  - Why: Convex HTTP queries are directly reachable — Next.js layout gates don't protect them.
- **Use indexes** — Every query that filters or orders should use `.withIndex(...)`. Add the index in the schema's `defineTable(…).index(…)`.

## Next.js app rules
- **proxy.ts not middleware.ts** — Next 16 renamed middleware to proxy. Move logic to `proxy.ts` at the project root.
- **next/link + next/image only** — Never use `<a href="/internal">` or `<img src=…>`. Use `<Link>` / `<Image>` so Next can prefetch + optimise.
- **NEXT_PUBLIC_ only for non-sensitive values** — Any value prefixed `NEXT_PUBLIC_` is exposed in the client bundle. Never put secrets, API keys, or admin emails there.
- **Cache Components for static reads** — SSG marketing pages should opt into Cache Components via `"use cache"` + `cacheLife` / `cacheTag`. Enable `experimental.cacheComponents` in next.config.mjs first.
- **Server Actions require authn + authz** — `'use server'` exports MUST verify the caller before mutating state. Treat them like public API endpoints.

## File modularity
Files are read more than written. Keep them small, single-purpose, and composable so consumers can grok + reuse + replace pieces without reading the whole thing.

- **Max 200 lines per file** — Hard cap: no source file may exceed 200 lines (excl. pure data exports like `lib/content/*.ts` catalog arrays, `*/seed.ts`, theme presets, and `_generated/`). If a component, route, or module is approaching the cap, split before shipping. Audit gate: `audit:file-size`.
  - Why: Large files hide concerns, resist diff review, force consumers to scroll instead of compose. The cap forces extraction of reusable pieces — composition over accumulation.
- **Single responsibility per file** — One default export OR one cohesive cluster of named exports per file. If you find yourself prefixing exports (`createX`, `parseX`, `serializeX`, `validateX`) — those are 4 files, not 4 exports.
  - Why: Single-responsibility files are testable in isolation, replaceable without ripple, and reusable without context.
- **Extract reusable, don't inline twice** — If a UI pattern (filter pills, status badge, picker grid) repeats — extract to `components/` or `shared/`. If two slices need the same util — promote to `shared/<name>/utils/`.
  - Why: Duplication compounds: the third copy is where bug-fix divergence starts. Extract on the SECOND occurrence, not the third.
- **Dynamic over hardcoded** — Prefer config-driven + props-driven code. Replace switch/if-chains with lookup maps. Replace literal arrays with derived selectors. Replace inline copy with `labels` props.
  - Why: Dynamic code adapts when the consumer customizes; hardcoded code forces them to fork.
- **Compose, don't accumulate** — When adding a feature, ask: can I add a new file that COMPOSES with the existing one, instead of editing the existing one bigger?
  - Why: Open-closed principle in practice. Existing file stays small + tested; new file is the one that changes.

## UI rules
- **shadcn primitives only** — All UI builds on shadcn primitives. Never use raw `<button>`, `<dialog>`, `<input type=date|file>` directly — wrap with `ResponsiveDialog`, `DateField`, `FileUpload`.
- **Theme tokens, not hex** — Use `bg-background` / `text-foreground` / `border-border` etc. Tailwind theme tokens make preset swaps work.
- **Mobile-first responsive** — Layout breakpoints climb up — start at single-column on mobile, layer `md:` / `lg:` modifiers.

## Delivery rules
- **Solo-dev = push direct to main** — When tests/typecheck/validate are green, push direct to main. NO PRs for solo work. Dokploy auto-deploys on push.
  - Why: PRs add ceremony without review benefit when the solo dev is also the reviewer.
- **Conventional commits** — `feat(scope): subject` / `fix(scope): subject` / `chore(scope): subject`. Body explains the WHY.
- **Co-author the AI** — End every AI-assisted commit message with `Co-Authored-By: Claude … <noreply@anthropic.com>` so authorship is honest.
- **Self-hosted runner / Dokploy webhook** — No GitHub Actions cloud minutes. Local CI via pre-push hook or `/sc-git ci`; Dokploy auto-builds on push.

## rr distribution kinds (TEMPLATE vs SLICE)
rr publishes TWO different installable kinds. They install to different paths and answer different needs — confusing them is the #1 source of "the output looks nothing like the docs" reports.

- **TEMPLATE = full-app scaffold** — A TEMPLATE (catalog: `lib/content/layouts.ts`, e.g. `personal-brand-os`, `agency-studio-os`) is a whole-app starter — public marketing routes + admin dashboard + Convex schema. Install with `npx rr add <template-slug>` (defaults to `--at root` → routes promoted to `app/(public)/` + `app/admin/`, hardcoded `/preview/<slug>` path constants in nav-config/site-config/robots/sitemap auto-rewritten). Pass `--at preview` only for sandbox demos that keep the `/preview/<slug>` URL prefix.
  - Why: Templates are NOT vertical slices — they don't ship `slice.json` + `slice.contract.ts` + `slice.manifest.json`. They're monolithic scaffolds you fork and customize.
- **SLICE = drop-in vertical feature** — A SLICE (catalog: `lib/content/slices.ts`, e.g. `comments`, `doku-payment`, `ai-chat`) is one self-contained feature. Install with `npx rr add <slice-slug>` — CLI copies files into `frontend/slices/<slug>/` + (optionally) `convex/features/<slug>/`. Each slice ships the metadata trio (`slice.json` + `slice.contract.ts` + `slice.manifest.json`) and is props-driven so it composes with the rest of your app.
  - Why: Slices are mix-and-match. The trio is what makes a slice composable — without it the CLI can't audit dep peers, env, RBAC scopes, or table collisions.
- **Adopt = npx rr add <slug>** — CLI auto-detects kind via catalog lookup and prints `[TEMPLATE]` or `[SLICE]` in the banner. Trust the banner — if you expected a slice and got `[TEMPLATE]`, you used the wrong slug.
- **Lift = sanitize first** — Before pushing UP to rr (slice path only), strip consumer-specific URLs, env names, role enums, and table coupling. Replace with props or env-configured allowlists.
- **Catalog entry + metadata trio is mandatory (slices)** — New slice in rr needs: catalog entry in `lib/content/slices.ts` + `slice.json` + `slice.contract.ts` + `slice.manifest.json`. Validate with `npm run validate:all` (chain includes `audit:slices` + `audit:templates`).
- **MCP integration via create-your-mcp slice** — Add ChatGPT / Claude / Cursor connector support via `npx rr add create-your-mcp` — DON'T roll your own OAuth/PKCE.

---

# How to apply

- BEFORE writing code: scan whether the change crosses a rule. If yes, follow the rule even if the user didn't mention it.
- BEFORE introducing a dependency: check whether an rr slice covers it (`npx rr list slices` or the catalog at /slices).
- BEFORE adding a new feature: check if it should be a vertical slice under `frontend/slices/<slug>/` + `convex/features/<slug>/` per the structure rules.
- AFTER editing: run `npx tsc --noEmit` and any project-local `npm run validate:*` before committing.

# Output format

When you propose a change, state which rules it honors. Example: "I'm using `requireAdmin` from `convex/_shared/auth` per the 'Server-side authz on every mutation' rule, and indexing the query via `.withIndex` per 'No bare .collect()'."

If you find existing code that violates a rule, point it out — but only fix it if the user asks, since the diff may surface scope-creep.
