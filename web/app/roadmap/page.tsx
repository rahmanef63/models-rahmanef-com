import Link from "next/link";
import { Roadmap } from "../_components/roadmap";
import { Comparison } from "../_components/comparison";
import { SiteNav } from "../_components/site-nav";

const GH = "https://github.com/rahmanef63/models-rahmanef-com";

// newest first. Dates: v0.1 ship + audit from docs/FEATURES-LOG.md; fix passes + landing from git log.
const CHANGELOG: { date: string; tag: string; items: string[] }[] = [
  { date: "2026-07-08", tag: "landing + hardening", items: [
    "Memory-graph slice + Obsidian graph; icon-rail app shell + mobile dock",
    "CRUD completeness: updateCombo, mcp updateServer, schedule edit, channel cascade-delete",
    "Security: invite privilege-escalation closed; channels setModel wired",
    "Landing rebuilt: live graph demo, this roadmap + comparison + changelog",
  ] },
  { date: "2026-07-07", tag: "audit fix pass 1", items: [
    "Spend-cap fails closed on read truncation (was silent under-enforcement)",
    "workspace transferOwnership; 402/quota failover; combos round_robin; audit hooks",
  ] },
  { date: "2026-07-05", tag: "verification audit", items: [
    "5-agent per-phase audit vs code; spend-cap runAgent bypass fixed",
    "Best-practice + CRUD scorecard: 0 HIGH issues, avg ~87/100",
  ] },
  { date: "2026-07-04", tag: "v0.1 shipped", items: [
    "5 phases live: workspaces · BYOK /v1 gateway · memory · 4 channels · scheduled agents · usage/caps/audit",
    "13 rr vertical slices; per-user AES-256-GCM keys; MCP server (OAuth 2.1)",
  ] },
];

const DOCS: [string, string, string][] = [
  ["ROADMAP.md", "This roadmap + how to contribute a slice", "/blob/main/ROADMAP.md"],
  ["COMPARISON", "Full feature matrix vs OpenClaw / Hermes / 9Router", "/blob/main/docs/COMPARISON-hermes-openclaw-9router.md"],
  ["FEATURES-LOG", "Shipped scope, verified against code", "/blob/main/docs/FEATURES-LOG.md"],
  ["AI-SLICES-PROGRESS", "rr vertical-slice parity per feature", "/blob/main/docs/AI-SLICES-PROGRESS.md"],
  ["audit.md", "Best-practice + CRUD scorecard (0 HIGH)", "/blob/main/audit.md"],
  ["MASTER-PLAN", "The design, data model & non-goals", "/blob/main/docs/MASTER-PLAN.md"],
];

export const metadata = {
  title: "Roadmap — models",
  description: "Direction, comparison and changelog for Manef (models-rahmanef-com) — a multi-tenant BYOK AI foundation.",
};

export default function RoadmapPage() {
  return (
    <div className="wrap">
      <SiteNav home />

      <header className="section">
        <span className="eyebrow">roadmap</span>
        <h1 style={{ fontSize: "2.4rem", letterSpacing: "-0.02em", margin: "0.4rem 0 0.8rem" }}>Direction, comparison &amp; changelog.</h1>
        <p className="lede" style={{ maxWidth: "68ch" }}>Where Manef is heading, how it sits against the field, and what has shipped. If you want to help build it, pick a slice from the roadmap and open a PR.</p>
      </header>

      <Roadmap />

      <section className="section" id="changelog" style={{ scrollMarginTop: "1.5rem" }}>
        <div className="section-head">
          <span className="eyebrow">changelog</span>
          <h2>What shipped, when.</h2>
        </div>
        <div className="log">
          {CHANGELOG.map((e) => (
            <div className="log-entry" key={e.date}>
              <div className="log-meta"><span className="log-date">{e.date}</span><span className="log-tag">{e.tag}</span></div>
              <ul>{e.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <Comparison />

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">go deeper</span>
          <h2>The full docs.</h2>
        </div>
        <div className="doc-grid">
          {DOCS.map(([name, desc, path]) => (
            <a className="doc-card" key={name} href={`${GH}${path}`} target="_blank" rel="noreferrer">
              <h3>{name} ↗</h3>
              <p>{desc}</p>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <span>models — bring your own key</span>
        <Link href="/">← back home</Link>
        <a href={GH} target="_blank" rel="noreferrer">github ↗</a>
      </footer>
    </div>
  );
}
