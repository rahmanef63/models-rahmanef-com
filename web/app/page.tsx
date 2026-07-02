import Link from "next/link";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "OpenRouter", "Groq", "xAI", "DeepSeek", "Mistral", "Moonshot"];
const GITHUB = "https://github.com/rahmanef63/models-rahmanef-com";

const FEATURES = [
  { t: "Sign in, don't paste", d: "OAuth with OpenAI (ChatGPT / Codex) or OpenRouter — no key to copy. Or paste one if you prefer." },
  { t: "One call, any provider", d: "resolveModel('provider/model') → a ready client. Nine providers, one interface, host-gated keys." },
  { t: "Catalog that updates itself", d: "Context windows, pricing and capabilities pulled live from models.dev, cached with an offline fallback." },
  { t: "Per-user, encrypted", d: "Every tenant brings their own credentials. Stored AES-256-GCM at rest, keyed to your own auth." },
  { t: "Ships as a library", d: "@rahmanef/models — zero-dependency ESM core, a CLI, and an injectable CredentialStore for any backend." },
  { t: "Distilled, not guessed", d: "The catalog, host-gating and OAuth flows are lifted from how openclaw & hermes actually do it." },
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
          <div className="eyebrow reveal" style={{ ["--d" as string]: "0.05s" }}>byok · multi-tenant · self-host</div>
          <h1 className="reveal" style={{ ["--d" as string]: "0.12s" }}>
            Every model.<br />Your keys.<br /><em>One dashboard.</em>
          </h1>
          <p className="lede reveal" style={{ ["--d" as string]: "0.22s" }}>
            A bring-your-own-key gateway distilled from openclaw &amp; hermes. Sign in with OpenAI or
            OpenRouter — or paste any key — then call any model.
          </p>
          <div className="cta-row reveal" style={{ ["--d" as string]: "0.3s" }}>
            <Link className="btn accent" href="/app">Open dashboard →</Link>
            <a className="btn" href={GITHUB} target="_blank" rel="noreferrer">View source</a>
          </div>
        </div>
        <aside className="readout reveal" style={{ ["--d" as string]: "0.4s" }} aria-hidden>
          <div className="rhead"><span>~/models</span><span>online</span></div>
          <div className="rrow"><span><i className="dot" /> openai · chatgpt</span><span>oauth</span></div>
          <div className="rrow"><span><i className="dot" /> openrouter</span><span>oauth</span></div>
          <div className="rrow"><span><i className="dot" /> anthropic</span><span>key</span></div>
          <div className="rrow"><span><i className="dot off" /> groq</span><span className="muted">—</span></div>
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
          <span className="eyebrow">how it works</span>
          <h2>Three steps to any model.</h2>
        </div>
        <div className="steps">
          <div className="step"><div className="num">01 / sign in</div><h3>Make an account</h3><p>Email + password. Your keys are scoped to you and no one else.</p></div>
          <div className="step"><div className="num">02 / connect</div><h3>Add a provider</h3><p>Sign in with OpenAI or OpenRouter over OAuth, or paste an API key.</p></div>
          <div className="step"><div className="num">03 / use</div><h3>Call any model</h3><p>Pick from the live catalog and chat — the right key is routed for you.</p></div>
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
