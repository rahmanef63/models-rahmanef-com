"use client";
// WorkspaceUsageCard — per-day bars of the active workspace's rolled-up usage: calls, total tokens,
// and ESTIMATED cost (from a static rate table, not a bill). Rows are aggregated per (provider,model)
// per day by the rollupDay cron; this card sums them per day for the bars. Scoped via useWorkspace().
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";

type Row = { day: string; provider: string; model: string; calls: number; promptTokens: number; completionTokens: number; estCostUsd: number; hasRate: boolean };
type Day = { day: string; calls: number; tokens: number; cost: number; anyMissingRate: boolean };

const usd = (n: number) => (n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`);
const num = (n: number) => n.toLocaleString();

function foldByDay(rows: Row[]): Day[] {
  const m = new Map<string, Day>();
  for (const r of rows) {
    const d = m.get(r.day) ?? { day: r.day, calls: 0, tokens: 0, cost: 0, anyMissingRate: false };
    d.calls += r.calls;
    d.tokens += r.promptTokens + r.completionTokens;
    d.cost += r.estCostUsd;
    if (!r.hasRate) d.anyMissingRate = true;
    m.set(r.day, d);
  }
  return [...m.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function WorkspaceUsageCard() {
  const { workspaceId } = useWorkspace();
  const rows = useQuery(api.usageRollups.workspaceUsage, workspaceId ? { workspaceId: workspaceId as never, days: 30 } : "skip") as Row[] | undefined;
  const days = rows ? foldByDay(rows) : undefined;
  const maxTokens = days && days.length ? Math.max(1, ...days.map((d) => d.tokens)) : 1;
  const totalCost = days ? days.reduce((s, d) => s + d.cost, 0) : 0;

  return (
    <section className="card">
      <h2>Workspace Usage</h2>
      <p className="sub">Per-day rollups for this workspace. Cost is an <strong>estimate</strong> from a rate table (not a bill); some models may lack a rate and show <code>~</code>.</p>

      {!workspaceId ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>Open a workspace to view its usage.</p>
      ) : days === undefined ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      ) : days.length === 0 ? (
        <p className="sub" style={{ marginTop: "1rem" }}>No usage rolled up yet. Aggregates refresh every 6 hours.</p>
      ) : (
        <>
          <p className="mono muted" style={{ fontSize: ".82rem", margin: ".8rem 0" }}>~{usd(totalCost)} est · last {days.length} day(s)</p>
          <div className="col" style={{ gap: ".5rem" }}>
            {days.map((d) => (
              <div key={d.day} className="col" style={{ gap: ".2rem" }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: ".8rem" }}>
                  <span className="mono">{d.day}</span>
                  <span className="mono muted">{num(d.calls)} calls · {num(d.tokens)} tok · {d.anyMissingRate ? "~" : ""}{usd(d.cost)}</span>
                </div>
                <div style={{ height: 6, background: "var(--border, #2222)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((d.tokens / maxTokens) * 100)}%`, height: "100%", background: "var(--accent, #6a9)" }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
