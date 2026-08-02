"use client";
// Admin · Analytics — 30-day system time-series (signups, requests, tokens, errors) + top-model and
// provider breakdowns + agent-run status. One query (adminAnalytics), all charts pure SVG/CSS.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PROVIDER_LABEL, fmt } from "./shared";
import { Sparkline, MiniBars, HBarList } from "./charts";

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="admin-block">
      <h3>{title}</h3>
      {sub && <p className="muted mono" style={{ fontSize: ".72rem", margin: "-.2rem 0 .5rem" }}>{sub}</p>}
      {children}
    </div>
  );
}

export function AdminAnalyticsCard() {
  const a = useQuery(api.adminAnalytics.adminAnalytics);
  return (
    <section className="card">
      <h2>Analytics <span className="badge oauth">SUPER</span></h2>
      <p className="sub">System-wide, last 30 days. Aggregates only — never a key or message content.</p>
      {a === undefined ? (
        <p className="muted mono">…</p>
      ) : (
        <>
          <section className="overview" style={{ marginTop: "1rem" }}>
            <div className="ov-tile"><div className="ov-num">{fmt(a.totals.users)}</div><div className="ov-lbl">users</div></div>
            <div className="ov-tile"><div className="ov-num">{fmt(a.totals.windowSignups)}</div><div className="ov-lbl">signups · 30d</div></div>
            <div className="ov-tile"><div className="ov-num">{fmt(a.totals.windowRequests)}</div><div className="ov-lbl">requests · 30d</div></div>
            <div className="ov-tile"><div className="ov-num">{fmt(a.totals.windowTokens)}</div><div className="ov-lbl">tokens · 30d</div></div>
          </section>

          <Panel title="Signups · 30d" sub={`${a.totals.windowSignups} in window`}>
            <Sparkline values={a.signups} labels={a.days} />
          </Panel>
          <Panel title="Requests · 30d" sub={`${a.totals.windowRequests} calls`}>
            <MiniBars values={a.requests} labels={a.days} />
          </Panel>
          <Panel title="Errors · 30d" sub={`${a.errors.reduce((s, n) => s + n, 0)} failed calls`}>
            <MiniBars values={a.errors} labels={a.days} />
          </Panel>
          {a.topModels.length > 0 && (
            <Panel title="Top models · global">
              <HBarList items={a.topModels.map(([label, value]) => ({ label, value }))} unit="×" />
            </Panel>
          )}
          {a.providers.length > 0 && (
            <Panel title="Providers connected">
              <HBarList items={a.providers.map(([slug, value]) => ({ label: PROVIDER_LABEL[slug] ?? slug, value }))} />
            </Panel>
          )}
          {Object.keys(a.runsByStatus).length > 0 && (
            <Panel title="Agent runs · by status">
              <HBarList items={Object.entries(a.runsByStatus).sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value }))} />
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
