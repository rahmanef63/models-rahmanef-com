"use client";
// Audit log — an append-only trail of sensitive actions in the active workspace (member role
// changes, removals, invite acceptance, workspace-shared credential deletes). Admin+ only, read-only.
// Action-prefix filter pills are derived from the events themselves (dynamic, not hardcoded).
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";

type Evt = { id: string; action: string; target: string | null; meta: unknown; at: number; actorName: string | null };

const ago = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function AuditLogCard() {
  const { workspaceId, role, personal } = useWorkspace();
  const isAdmin = role === "admin" || role === "owner";
  const events = useQuery(
    api.audit.listAuditEvents,
    workspaceId && isAdmin && !personal ? { workspaceId: workspaceId as never, limit: 100 } : "skip",
  ) as Evt[] | undefined;
  const [filter, setFilter] = useState("all");

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const e of events ?? []) set.add(e.action.split(".")[0]);
    return ["all", ...[...set].sort()];
  }, [events]);
  const shown = (events ?? []).filter((e) => filter === "all" || e.action.startsWith(filter));

  if (personal)
    return (
      <section className="card">
        <h2>Audit</h2>
        <p className="sub">Personal workspaces have no shared actions to audit. Create a team workspace (switcher, top-left) to track member and credential changes.</p>
      </section>
    );
  if (!isAdmin)
    return (
      <section className="card">
        <h2>Audit</h2>
        <p className="sub">Only workspace admins can view the audit trail.</p>
      </section>
    );

  return (
    <section className="card">
      <h2>Audit</h2>
      <p className="sub">An append-only record of sensitive actions in this workspace — role changes, member removals, invite acceptance, and shared-credential deletes. Retained 90 days.</p>
      <div className="row" style={{ gap: ".4rem", marginTop: ".8rem", flexWrap: "wrap" }}>
        {groups.map((g) => (
          <button key={g} className={filter === g ? "btn accent" : "btn"} style={{ fontSize: ".78rem" }} onClick={() => setFilter(g)}>{g}</button>
        ))}
      </div>
      {events === undefined ? (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      ) : shown.length === 0 ? (
        <p className="muted" style={{ marginTop: "1rem" }}>No audit events yet.</p>
      ) : (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {shown.map((e) => (
            <li key={e.id}>
              <span className="name">
                <code className="mono" style={{ fontSize: ".8rem" }}>{e.action}</code>
                {e.target && <span className="muted mono" style={{ fontSize: ".76rem" }}> · {e.target}</span>}
              </span>
              <span className="cred-actions muted mono" style={{ fontSize: ".74rem" }}>{e.actorName ?? "someone"} · {ago(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
