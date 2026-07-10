import Link from "next/link";
import { GraphDemo } from "./_components/graph-demo";
import { SiteNav } from "./_components/site-nav";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "OpenRouter", "Groq", "xAI", "DeepSeek", "Mistral", "Moonshot", "Cohere", "Perplexity", "Together", "Fireworks", "Cerebras", "DeepInfra"];
const GITHUB = "https://github.com/rahmanef63/models-rahmanef-com";

const FEATURES = [
  { t: "Sign in, don't paste", d: "OAuth with OpenAI (ChatGPT / Codex), Claude (Pro / Max) or OpenRouter — use your subscription, no key to copy. Or paste one if you prefer." },
  { t: "22 providers, one interface", d: "resolveModel('provider/model') → a ready client. OpenAI, Anthropic, Google and nineteen more, host-gated, one call." },
  { t: "Per-user, encrypted", d: "Every tenant brings their own credentials. Stored AES-256-GCM at rest, keyed to your own auth — never shared, never logged." },
  { t: "Chat + autonomous agents", d: "A threaded, persisted workbench and a multi-step agent runner with full tool traces — both built in, over any model you connect." },
  { t: "Your own MCP server", d: "Mint a token and expose your gateway as an MCP endpoint. Connect Claude Code, Cursor, or ChatGPT over OAuth 2.1. Each token acts as you." },
  { t: "Also a library", d: "@rahmanef/models — zero-dependency ESM core, a CLI, and an injectable CredentialStore for any backend. The dashboard is just one consumer." },
];

const MODULES = [
  { k: "studio / workbench", t: "Workbench", d: "Threaded, persisted chat across any connected model. Agent mode and Caveman / Ponytail token savers apply." },
  { k: "studio / agents", t: "Agents & schedules", d: "Give a model a task and watch a multi-step tool loop run with a full, expandable trace. Save named agents and fire them on a recurring schedule." },
  { k: "connect / providers", t: "Providers & combos", d: "22 providers over OAuth or a pasted key, each scoped to you. Alias several behind one combo name with fallback or round-robin routing." },
  { k: "connect / serve", t: "Channels, gateway & MCP", d: "Wire Telegram, Slack, WhatsApp or Discord bots to an agent; point Claude Code or Cursor at your OpenAI/Anthropic-compatible /v1 endpoint; or expose it all as your own MCP server over OAuth 2.1." },
  { k: "workspace / memory", t: "Memory & graph", d: "Give models durable, per-scope memory with off-turn auto-summaries — then explore it as an Obsidian-style interactive graph of memories, agents, skills and tools." },
  { k: "workspace / teams", t: "Teams & ops", d: "Workspaces with role-based invites, per-workspace usage and billing, monthly spend caps, an append-only audit trail, and a super-admin console." },
];

const MG_LEGEND = [["memories", "var(--accent)"], ["agents", "#5aa9ff"], ["skills", "#b48bff"], ["tools", "#3fd6ad"]];

export default function Landing() {
  return (
    <div className="wrap">
      <SiteNav />

      <header className="hero">
        <div>
          <div className="eyebrow reveal" style={{ ["--d" as string]: "0.05s" }}>byok · 22 providers · agents · memory · mcp</div>
          <h1 className="reveal" style={{ ["--d" as string]: "0.12s" }}>
            Every model.<br />Your keys.<br /><em>One dashboard.</em>
          </h1>
          <p className="lede reveal" style={{ ["--d" as string]: "0.22s" }}>
            A multi-tenant, bring-your-own-key AI gateway distilled from openclaw &amp; hermes. Sign in
            with OpenAI, Claude or OpenRouter — or paste any key — then chat, run agents, wire in chat
            channels and team memory, and expose it all as your own MCP server.
          </p>
          <div className="cta-row reveal" style={{ ["--d" as string]: "0.3s" }}>
            <Link className="btn accent" href="/app">Open dashboard →</Link>
            <a className="btn" href="#modules">See what's inside ↓</a>
          </div>
        </div>
        <aside className="readout reveal" style={{ ["--d" as string]: "0.4s" }} aria-hidden>
          <div className="rhead"><span>~/models</span><span>online</span></div>
          <div className="rrow"><span><i className="dot" /> openai · chatgpt</span><span>oauth</span></div>
          <div className="rrow"><span><i className="dot" /> claude · pro/max</span><span>oauth</span></div>
          <div className="rrow"><span><i className="dot" /> openrouter</span><span>oauth</span></div>
          <div className="rrow"><span><i className="dot" /> anthropic</span><span>key</span></div>
          <div className="rrow"><span><i className="dot" /> mcp · /mcp</span><span>serving</span></div>
          <div className="rrow" style={{ borderTop: "1px solid var(--line)", marginTop: ".6rem", paddingTop: ".7rem" }}>
            <span className="accent">resolveModel()</span><span className="muted">→ 200</span>
          </div>
        </aside>
      </header>

      <div className="marquee">
        <div className="track">
          {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
            <span key={i}><b>{p}</b> · byok</span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">what you get</span>
        </div>
        <div className="features">
          {FEATURES.map((f, i) => (
            <div className="feature" key={f.t}>
              <div className="idx">{String(i + 1).padStart(2, "0")}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="modules">
        <div className="section-head">
          <span className="eyebrow">inside the dashboard</span>
          <h2>Everything, in one console.</h2>
        </div>
        <div className="steps">
          {MODULES.map((m) => (
            <div className="step" key={m.t}>
              <div className="num">{m.k}</div>
              <h3>{m.t}</h3>
              <p>{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">workspace / memory</span>
          <h2>Your knowledge, as a graph.</h2>
        </div>
        <p className="gd-lede">
          An <b>Obsidian-style</b> canvas over everything the workspace knows — memories, agents,
          skills and tools — in one live, force-directed graph. Drag a node, zoom, or link notes with{" "}
          <span className="mono">@</span> / <span className="mono">/</span> mentions. This is the real
          component below, running on sample data:
        </p>
        <div className="gd-legend" aria-hidden>
          {MG_LEGEND.map(([label, color]) => (
            <span key={label}><i style={{ background: color }} /> {label}</span>
          ))}
        </div>
        <div className="gd-live"><GraphDemo /></div>
        <div className="gd-cta"><Link className="btn accent" href="/app">Open the graph →</Link></div>
      </section>

      <section className="section">
        <div className="teaser">
          <div>
            <span className="eyebrow">where it&apos;s going</span>
            <h2>A foundation, not a competitor.</h2>
            <p className="muted">Multi-tenant, encrypted, composable — every capability a droppable slice. See the full roadmap, how it compares to OpenClaw / Hermes / 9Router, and the changelog.</p>
          </div>
          <Link className="btn accent" href="/roadmap">Roadmap &amp; changelog →</Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">how it works</span>
          <h2>Three steps to any model.</h2>
        </div>
        <div className="steps">
          <div className="step"><div className="num">01 / sign in</div><h3>Make an account</h3><p>Email + password. Your keys are scoped to you and no one else.</p></div>
          <div className="step"><div className="num">02 / connect</div><h3>Add a provider</h3><p>Sign in with OpenAI, Claude or OpenRouter over OAuth, or paste an API key.</p></div>
          <div className="step"><div className="num">03 / use</div><h3>Call any model</h3><p>Chat, run agents, or point an MCP client at your endpoint — the right key is routed for you.</p></div>
        </div>
      </section>

      <section className="section">
        <div className="lib-grid">
          <div>
            <span className="eyebrow">also a library</span>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "2.2rem", letterSpacing: "-0.02em", margin: "0.5rem 0 1rem" }}>
              Drop it into any project.
            </h2>
            <p className="muted">The dashboard is just one consumer. The core is a zero-dependency package with a pluggable credential store — env, file, or your own database.</p>
          </div>
          <div className="codeblock">
            <div><span className="c">$</span> npm i @rahmanef/models</div>
            <br />
            <div><span className="k">import</span> {"{ resolveModel, chat }"} <span className="k">from</span> <span className="c">&apos;@rahmanef/models&apos;</span></div>
            <br />
            <div><span className="k">const</span> m = <span className="k">await</span> resolveModel(<span className="c">&apos;anthropic/claude-opus-4-8&apos;</span>, {"{"}</div>
            <div>&nbsp;&nbsp;tenantId, store, <span className="c">// per-user · encrypted · host-gated</span></div>
            <div>{"}"})</div>
            <div><span className="k">const</span> res = <span className="k">await</span> chat(m, {"{ messages }"})</div>
          </div>
        </div>
      </section>

      <footer>
        <span>models — bring your own key</span>
        <span>distilled from openclaw &amp; hermes · built on convex + vercel</span>
        <span className="foot-links">
          <Link href="/roadmap">roadmap</Link>
          <a href={GITHUB} target="_blank" rel="noreferrer">github ↗</a>
        </span>
      </footer>
    </div>
  );
}
