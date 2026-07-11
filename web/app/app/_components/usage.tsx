"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { fmt } from "./shared";
import { estCostUsd } from "@/convex/features/usageRollups/rates";

function ByDayBars({ byDay }: { byDay: Record<string, number> }) {
  const days: string[] = [];
  const now = Date.now();
  for (let i = 13; i >= 0; i--) days.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  const max = Math.max(1, ...days.map((d) => byDay[d] ?? 0));
  return (
    <div className="bars" aria-hidden>
      {days.map((d) => (
        <div key={d} className="bar" style={{ height: `${Math.round(((byDay[d] ?? 0) / max) * 100)}%` }} title={`${d}: ${byDay[d] ?? 0}`} />
      ))}
    </div>
  );
}

// ponytail: ESTIMATE only — prices tokens with the SAME rates.ts map the rollup cron + spend-cap
// enforce on, so the "est. spend" shown here matches what the budget actually blocks. Uncatalogued
// models (no rate) are skipped but counted, so the UI can flag partial coverage with "*".
function estCost(byModelTokens: Record<string, { prompt: number; completion: number }>) {
  let usd = 0, priced = 0, total = 0;
  for (const [ref, t] of Object.entries(byModelTokens)) {
    total++;
    const { cost, hasRate } = estCostUsd(ref, t.prompt, t.completion);
    if (!hasRate) continue;
    usd += cost;
    priced++;
  }
  return { usd, priced, total };
}

export function UsageCard() {
  const u = useQuery(api.usage.myUsage);
  if (u === undefined) return <section className="card"><h2>Usage</h2><p className="muted mono">…</p></section>;
  if (!u || u.requests === 0) return <section className="card"><h2>Usage</h2><p className="sub">Your model calls will show up here — run a chat above.</p></section>;
  const topModels = Object.entries(u.byModel).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const cost = estCost(u.byModelTokens);
  return (
    <section className="card">
      <h2>Usage</h2>
      <p className="sub">Live across all your model calls.</p>
      <div className="row" style={{ gap: "2.25rem" }}>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.requests)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>requests</div></div>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.totalTokens)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>tokens</div></div>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.promptTokens)}<span className="muted"> / </span>{fmt(u.completionTokens)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>in / out</div></div>
        {cost.priced > 0 && (
          <div title={cost.priced < cost.total ? `${cost.priced} of ${cost.total} models have a public rate` : "models.dev public rates"}>
            <div className="mono accent" style={{ fontSize: "1.6rem" }}>≈ ${cost.usd < 1 ? cost.usd.toFixed(4) : cost.usd.toFixed(2)}</div>
            <div className="muted mono" style={{ fontSize: ".75rem" }}>est. spend{cost.priced < cost.total ? " *" : ""}</div>
          </div>
        )}
        {u.errors > 0 && <div><div className="mono" style={{ fontSize: "1.6rem", color: "var(--danger)" }}>{u.errors}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>errors</div></div>}
      </div>
      <ByDayBars byDay={u.byDay} />
      {topModels.length > 0 && (
        <ul className="creds" style={{ marginTop: "1.1rem" }}>
          {topModels.map(([m, n]) => (
            <li key={m}><span className="name mono" style={{ fontSize: ".82rem" }}>{m}</span><span className="mono muted">{n}×</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
