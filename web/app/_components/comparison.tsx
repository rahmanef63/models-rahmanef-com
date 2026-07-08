// Landing comparison — Manef vs OpenClaw / Hermes / 9Router. Condensed from
// docs/COMPARISON-hermes-openclaw-9router.md. The OTHERS' marks come from that doc's verified
// research; MANEF's marks reflect the SHIPPED code (channels slice + api-compat /v1 are live, so
// they read ◐/✓ here, not the doc's stale ❌). ✓ = have · ◐ = partial · – = none.
const HEAD = ["Feature", "OpenClaw", "Hermes", "9Router", "Manef"];
const ROWS: [string, string, string, string, string][] = [
  ["Per-user multi-tenancy", "◐", "–", "–", "✓"],
  ["Keys encrypted at rest", "plaintext", "plaintext", "plaintext", "AES-256-GCM"],
  ["BYOK providers", "~60", "28", "94", "22"],
  ["Agent loop + saved agents", "✓", "✓", "–", "✓"],
  ["Memory + interactive graph", "◐", "✓", "–", "✓"],
  ["MCP server (OAuth 2.1)", "✓", "✓", "◐", "✓"],
  ["OpenAI / Anthropic /v1 gateway", "✓", "◐", "✓", "✓"],
  ["Chat channels (Telegram / Slack …)", "✓", "✓", "–", "◐"],
];
const DOC = "https://github.com/rahmanef63/models-rahmanef-com/blob/main/docs/COMPARISON-hermes-openclaw-9router.md";

export function Comparison() {
  return (
    <section className="section">
      <div className="section-head">
        <span className="eyebrow">how it compares</span>
        <h2>Distilled from the best — multi-tenant by design.</h2>
      </div>
      <p className="cmp-lede">
        Manef borrows the strongest ideas from <b>OpenClaw</b> (channels / gateway), <b>Hermes</b>{" "}
        (memory + agent loop) and <b>9Router</b> (routing + token savers) — then adds what none of
        them have: real per-user tenancy and encrypted-at-rest keys.
      </p>
      <div className="cmp-wrap">
        <table className="cmp">
          <thead>
            <tr>{HEAD.map((h, i) => <th key={h} className={i === 4 ? "cmp-me" : ""}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <td className="cmp-feat">{r[0]}</td>
                {r.slice(1).map((c, j) => <td key={j} className={j === 3 ? "cmp-me" : ""}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cmp-note">
        <b>Only Manef</b> ships true per-user multi-tenancy + AES-256-GCM keys at rest — the others are
        single-user with plaintext credentials. <a href={DOC} target="_blank" rel="noreferrer">Full comparison ↗</a>
      </p>
    </section>
  );
}
