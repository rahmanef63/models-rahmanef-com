"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PROVIDER_LABEL, fmt } from "./shared";

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
  const users = useQuery(api.admin.adminUsers);
  const ov = useQuery(api.admin.adminOverview);
  return (
    <section className="card">
      <h2>Admin <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Operator console — identities, counts, and aggregates only. Never a key or message content.</p>
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
          <ul className="creds">
            {ov.providers.map(([slug, n]) => (
              <li key={slug}><span className="name">{PROVIDER_LABEL[slug] ?? slug}</span><span className="mono muted">{n}</span></li>
            ))}
          </ul>
        </div>
      )}

      {ov && ov.topModels.length > 0 && (
        <div className="admin-block">
          <h3>Top models · global</h3>
          <ul className="creds">
            {ov.topModels.map(([m, n]) => (
              <li key={m}><span className="name mono" style={{ fontSize: ".82rem" }}>{m}</span><span className="mono muted">{n}×</span></li>
            ))}
          </ul>
        </div>
      )}

      {users !== undefined && (
        <div className="admin-block">
          <h3>Users</h3>
          <ul className="creds">
            {users.map((u) => (
              <li key={u.id}>
                <span className="name mono" style={{ fontSize: ".85rem" }}>{u.email || u.name || "user·" + u.id.slice(-6)}</span>
                <span className="mono muted" style={{ fontSize: ".72rem" }}>{new Date(u.createdAt).toISOString().slice(0, 10)}</span>
                <span className="badge">{u.providers} {u.providers === 1 ? "provider" : "providers"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
