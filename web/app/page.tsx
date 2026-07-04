import Link from "next/link";

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
  { k: "chat / workbench", t: "Workbench", d: "Threaded, persisted conversations across any connected model. Agent mode and token savers apply." },
  { k: "agents / runner", t: "Agents", d: "Give a model a task; watch a multi-step tool loop run with a full, expandable trace of every step." },
  { k: "providers / byok", t: "Providers", d: "Connect over OAuth or paste a key. 22 providers, each connection scoped to you alone." },
  { k: "usage / telemetry", t: "Usage", d: "Every call logged — requests, in/out tokens, top models, and a 14-day activity sparkline." },
  { k: "mcp / server", t: "MCP server", d: "Mint tokens and expose chat + tools to Claude Code, Cursor or ChatGPT over OAuth 2.1." },
  { k: "admin / console", t: "Admin", d: "Operator console — identities, connections and aggregate usage. Never a key or message content." },
];

export default function Landing() {
  return (
    <div className="wrap">
      <nav className="nav reveal">
        <div className="brand">models<b>.</b></div>
        <div className="nav-links">
          <a href={GITHUB} target="_blank" rel="noreferrer">source</a>
          <Link className="btn accent" href="/app">Open dashboard →</Link>
        </div>
      </nav>

      <header className="hero">
        <div>
          <div className="eyebrow reveal" style={{ ["--d" as string]: "0.05s" }}>byok · 22 providers · mcp</div>
          <h1 className="reveal" style={{ ["--d" as string]: "0.12s" }}>
            Every model.<br />Your keys.<br /><em>One dashboard.</em>
          </h1>
          <p className="lede reveal" style={{ ["--d" as string]: "0.22s" }}>
            A multi-tenant, bring-your-own-key AI gateway distilled from openclaw &amp; hermes. Sign in
            with OpenAI, Claude or OpenRouter — or paste any key — then chat, run agents, and expose it
            all as your own MCP server.
          </p>
          <div className="cta-row reveal" style={{ ["--d" as string]: "0.3s" }}>
            <Link className="btn accent" href="/app">Open dashboard →</Link>
            <a className="btn" href={GITHUB} target="_blank" rel="noreferrer">View source</a>
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

      <section className="section">
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
        <a href={GITHUB} target="_blank" rel="noreferrer">github ↗</a>
      </footer>
    </div>
  );
}
