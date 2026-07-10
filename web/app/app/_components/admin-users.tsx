"use client";
// Admin · Users — every account with exact signup instant (date + hour), relative age, provider
// count, and a click-to-expand activity log (recent model calls: model, tokens, status, when).
// Metadata only — never a key or message content. Extracted from admin.tsx (compose, don't accrete).
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { ago, dt, fmt } from "./shared";

function Activity({ userId }: { userId: Id<"users"> }) {
  const a = useQuery(api.adminAnalytics.adminUserActivity, { userId });
  if (a === undefined) return <p className="muted mono" style={{ padding: ".6rem 0" }}>…</p>;
  if (!a) return <p className="muted" style={{ padding: ".6rem 0" }}>User not found.</p>;
  return (
    <div className="user-activity">
      <div className="row mono muted" style={{ gap: "1.4rem", fontSize: ".74rem", flexWrap: "wrap" }}>
        <span>signed up <b className="accent">{dt(a.signupAt)}</b> ({ago(a.signupAt)})</span>
        <span>{a.providers} providers</span>
        <span>{a.lastActiveAt ? `last active ${ago(a.lastActiveAt)}` : "no activity yet"}</span>
      </div>
      {a.activity.length === 0 ? (
        <p className="muted" style={{ marginTop: ".6rem" }}>No model calls logged.</p>
      ) : (
        <ul className="creds" style={{ marginTop: ".6rem" }}>
          {a.activity.map((r, i) => (
            <li key={i}>
              <span className="name mono" style={{ fontSize: ".8rem" }}>
                {r.model}
                {r.status === "error" && <span className="badge" style={{ color: "var(--danger)", marginLeft: ".5rem" }}>error</span>}
              </span>
              <span className="cred-actions muted mono" style={{ fontSize: ".72rem" }}>
                {fmt(r.promptTokens + r.completionTokens)} tok · {ago(r.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUsers() {
  const users = useQuery(api.admin.adminUsers);
  const [open, setOpen] = useState<Id<"users"> | null>(null);
  if (users === undefined) return <div className="admin-block"><h3>Users</h3><p className="muted mono">…</p></div>;
  return (
    <div className="admin-block">
      <h3>Users · {users.length}</h3>
      <ul className="creds">
        {users.map((u) => {
          const id = u.id as Id<"users">;
          const isOpen = open === id;
          return (
            <li key={u.id} style={{ flexWrap: "wrap" }}>
              <button className="name mono link" style={{ fontSize: ".85rem", textAlign: "left" }} onClick={() => setOpen(isOpen ? null : id)}>
                {isOpen ? "▾ " : "▸ "}{u.email || u.name || "user·" + u.id.slice(-6)}
              </button>
              <span className="mono muted" style={{ fontSize: ".72rem" }} title={ago(u.createdAt)}>{dt(u.createdAt)}</span>
              <span className="badge">{u.providers} {u.providers === 1 ? "provider" : "providers"}</span>
              {isOpen && <div style={{ flexBasis: "100%" }}><Activity userId={id} /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
