// Landing roadmap — positions Manef as a foundation/solution (not just a competitor) and shows the
// forward arc so contributors can pick a slice. Grounded in docs/COMPARISON §5 (adopt-list) + §6
// (greenfield none of the four ship). Shipped = accent, Next = blue, Vision = purple (graph palette).
const GH = "https://github.com/rahmanef63/models-rahmanef-com";

const PHASES = [
  {
    k: "shipped", t: "Shipped — the foundation",
    items: [
      "Multi-tenant BYOK gateway · 22 providers",
      "Per-user AES-256-GCM keys, host-gated",
      "Agent loop + saved agents + full traces",
      "Memory + Obsidian-style graph",
      "MCP server (OAuth 2.1 PKCE)",
      "MCP client — connect external servers",
      "/v1 OpenAI + Anthropic gateway",
      "4 inbound chat channels",
      "Scheduled agents · usage · caps · audit",
      "Provider-pool failover · cooldown/backoff",
      "13 droppable rr vertical slices",
    ],
  },
  {
    k: "next", t: "Next — adopt from the field",
    items: [
      "OAuth-auth external MCP servers",
      "Vision + embeddings → RAG",
      "Streaming /v1 + tool passthrough",
      "More channels + a cost / quota dashboard",
      "Multi-key pool write path · more OAuth logins",
      "CLI / TUI surface",
    ],
  },
  {
    k: "vision", t: "The vision — what none of them ship",
    items: [
      "One policy engine — approval · sandbox · budget · scope",
      "One observability timeline — channel → memory → model → cost",
      "Portable memory + skill contract across runtimes",
      "Task-aware cost governance",
      "First-class eval loop — outcome · feedback · regression",
    ],
  },
];

export function Roadmap() {
  return (
    <section className="section">
      <div className="section-head">
        <span className="eyebrow">where it&apos;s going</span>
        <h2>Not another agent harness — a foundation.</h2>
      </div>
      <p className="rm-lede">
        OpenClaw owns channels, 9Router owns routing, Hermes owns the learning loop. Manef isn&apos;t
        racing them on feature count — it&apos;s the layer underneath: <b>multi-tenant, encrypted
        per-user, and composable</b>, where every capability ships as a droppable{" "}
        <span className="mono">rr</span> slice you add to any app with one command. The roadmap fuses
        the best of all three, then builds what none of them ship.
      </p>
      <div className="rm-grid">
        {PHASES.map((p) => (
          <div className={`rm-col rm-${p.k}`} key={p.k}>
            <h3>{p.t}</h3>
            <ul>{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="rm-cta">
        Every item is a self-contained vertical slice with a typed contract — build it once here, drop
        it into any app. <a href={`${GH}/blob/main/ROADMAP.md`} target="_blank" rel="noreferrer">Read the roadmap ↗</a>{" "}
        · <a href={`${GH}/issues`} target="_blank" rel="noreferrer">pick a slice &amp; contribute ↗</a>
      </p>
    </section>
  );
}
