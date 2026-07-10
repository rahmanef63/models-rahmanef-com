"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PROVIDER_LABEL, fmt } from "./shared";
import { HBarList } from "./charts";
import { AdminUsers } from "./admin-users";

function Stat({ n, l, danger }: { n: number; l: string; danger?: boolean }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: "1.5rem", color: danger ? "var(--danger)" : "var(--accent)" }}>{fmt(n)}</div>
      <div className="muted mono" style={{ fontSize: ".72rem" }}>{l}</div>
    </div>
  );
}

export function AdminCard() {
  const stats = useQuery(api.admin.adminStats);
  const ov = useQuery(api.admin.adminOverview);
  return (
    <section className="card">
      <h2>Admin <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Operator console — identities, counts, and aggregates only. Never a key or message content. See <b>Analytics</b> for 30-day trends and <b>Seed</b> to bulk-import agent presets.</p>
      {stats === undefined ? (
        <p className="muted mono">…</p>
      ) : (
        <div className="row" style={{ gap: "1.75rem", rowGap: "1rem" }}>
          <Stat n={stats.users} l="users" />
          <Stat n={stats.connections} l="connections" />
          <Stat n={stats.oauth} l="via oauth" />
          {ov && <Stat n={ov.totals.requests} l="requests" />}
          {ov && <Stat n={ov.totals.agentRuns} l="agent runs" />}
          {ov && <Stat n={ov.totals.threads} l="threads" />}
          {ov && <Stat n={ov.totals.messages} l="messages" />}
          {ov && ov.totals.errors > 0 && <Stat n={ov.totals.errors} l="errors" danger />}
        </div>
      )}

      {ov && ov.providers.length > 0 && (
        <div className="admin-block">
          <h3>Providers connected</h3>
          <HBarList items={ov.providers.map(([slug, value]) => ({ label: PROVIDER_LABEL[slug] ?? slug, value }))} />
        </div>
      )}

      {ov && ov.topModels.length > 0 && (
        <div className="admin-block">
          <h3>Top models · global</h3>
          <HBarList items={ov.topModels.map(([label, value]) => ({ label, value }))} unit="×" />
        </div>
      )}

      <AdminUsers />
    </section>
  );
}
