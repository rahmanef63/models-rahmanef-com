"use client";
// SpendCapCard — optional per-workspace monthly USD budget (spend-caps 5.3). Shows this month's
// ESTIMATED spend vs the cap as a bar; admins set/clear the cap. Once spend >= cap, callForUser
// rejects new model calls (quota_exceeded). Cost is an estimate (rate table), not a bill.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";

type Status = { over: boolean; spentUsd: number; capUsd: number | null; truncated?: boolean };
const usd = (n: number) => (n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`);

export function SpendCapCard() {
  const { workspaceId, role } = useWorkspace();
  const status = useQuery(
    api.spendCaps.getSpendStatus,
    workspaceId ? { workspaceId: workspaceId as never } : "skip",
  ) as Status | undefined;
  const setCap = useMutation(api.spendCaps.setSpendCap);
  const isAdmin = role === "admin" || role === "owner";

  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (clear = false) => {
    if (!workspaceId) return;
    setErr(null); setBusy(true);
    try {
      const n = clear ? undefined : Number(val);
      if (!clear && (val.trim() === "" || !isFinite(n as number) || (n as number) < 0))
        throw new Error("Enter a non-negative number.");
      await setCap({ workspaceId: workspaceId as never, monthlyCapUsd: n });
      setVal("");
    } catch (e: any) {
      setErr(e?.data?.detail ?? e?.message ?? "Failed to save cap.");
    } finally { setBusy(false); }
  };

  const pct = status && status.capUsd ? Math.min(100, Math.round((status.spentUsd / status.capUsd) * 100)) : 0;
  const barColor = status?.over ? "var(--danger, #c55)" : pct >= 80 ? "var(--warn, #d90)" : "var(--accent, #6a9)";

  return (
    <section className="card">
      <h2>Budget</h2>
      <p className="sub">Optional monthly USD budget for this workspace. Spend is an <strong>estimate</strong> (rate table, not a bill). Once reached, new model calls are blocked until next month.</p>

      {!workspaceId ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>Open a workspace to view its budget.</p>
      ) : status === undefined ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      ) : (
        <>
          <p className="mono muted" style={{ fontSize: ".82rem", margin: ".8rem 0 .3rem" }}>
            ~{usd(status.spentUsd)} spent{status.capUsd != null ? ` · ${usd(status.capUsd)} cap` : " · no cap set"}{status.over ? " · OVER" : ""}
          </p>
          {status.truncated && (
            <p className="mono danger" style={{ fontSize: ".72rem", margin: "0 0 .4rem" }}>
              Too many usage rows this month to sum exactly — the figure is a floor; calls are blocked (fail-closed) until it can be fully computed.
            </p>
          )}
          {status.capUsd != null && (
            <div style={{ height: 6, background: "var(--border, #2222)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
            </div>
          )}
          {isAdmin ? (
            <div className="row" style={{ gap: ".5rem", marginTop: ".8rem", flexWrap: "wrap" }}>
              <input type="number" min="0" step="1" placeholder="monthly cap (USD)" value={val} onChange={(e) => setVal(e.target.value)} disabled={busy} />
              <button className="link" onClick={() => save(false)} disabled={busy}>Set cap</button>
              {status.capUsd != null && <button className="link danger" onClick={() => save(true)} disabled={busy}>Clear</button>}
            </div>
          ) : (
            <p className="muted mono" style={{ fontSize: ".78rem", marginTop: ".6rem" }}>Only workspace admins can change the budget.</p>
          )}
          {err && <p className="mono danger" style={{ fontSize: ".78rem", marginTop: ".4rem" }}>{err}</p>}
        </>
      )}
    </section>
  );
}
