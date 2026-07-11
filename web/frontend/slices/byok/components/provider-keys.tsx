"use client";
import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errData } from "@/app/app/_components/shared";
import { useWorkspace } from "@/features/workspaces";

// Multi-key manager for ONE byok provider — lists the personal keys in the failover pool
// (label · status), adds another, or removes one. The pool engine (providerPool.pickCredentials)
// already rotates over every row; this is the write surface that makes it populatable. Self-fetches
// via convex hooks so ConnectedCreds only passes the provider slug.
export function ProviderKeys({ provider }: { provider: string }) {
  const keys = useQuery(api.credsPool.listCredentials, { provider });
  const add = useAction(api.credsPool.addCredential);
  const del = useMutation(api.credsPool.deleteCredentialById);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onAdd() {
    if (!key) return;
    setBusy(true);
    setErr("");
    try {
      await add({ provider, apiKey: key, label: label.trim() || undefined });
      setKey("");
      setLabel("");
    } catch (e) {
      const d = errData(e);
      setErr(typeof d === "string" ? d : d.detail);
    } finally {
      setBusy(false);
    }
  }

  if (keys === undefined) return null;
  const now = Date.now();
  return (
    <div className="pkeys">
      {keys.length > 1 && (
        <ul className="pkey-list">
          {keys.map((k) => {
            const cooling = !!k.cooldownUntil && k.cooldownUntil > now;
            const badge = k.status === "dead" ? "danger" : cooling ? "key" : "ok";
            const text = k.status === "dead" ? "DEAD" : cooling ? "COOLING" : "LIVE";
            return (
              <li key={k.credId}>
                <span className="mono muted" style={{ minWidth: "6rem" }}>{k.label || "key"}</span>
                <span className={`badge ${badge}`}>{text}</span>
                <button className="link danger" onClick={() => void del({ credId: k.credId })}>remove</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="row pkey-add">
        <input placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: "9rem" }} />
        <input type="password" placeholder="add another key — sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn" disabled={busy || !key} onClick={() => void onAdd()}>{busy ? "…" : "+ key"}</button>
      </div>
      {err && <p className="mono" style={{ color: "var(--danger)", fontSize: ".82rem", marginTop: ".4rem" }}>{err}</p>}
      <SharedKeys provider={provider} />
    </div>
  );
}

// Workspace-SHARED keys for this provider: every member's calls can fail over onto them. Admins add/
// remove; members only see that a shared key exists (label + health), never the ciphertext. Own hooks
// so rules-of-hooks stay clean — all hooks run before the early returns. Viewers skip the query (the
// member+ authz would otherwise throw). Renders nothing when there's no workspace or nothing to show.
function SharedKeys({ provider }: { provider: string }) {
  const { workspaceId, role } = useWorkspace();
  const isAdmin = role === "admin" || role === "owner";
  const canRead = isAdmin || role === "member";
  const keys = useQuery(api.credsPool.listWorkspaceCredentials, workspaceId && canRead ? { workspaceId: workspaceId as never, provider } : "skip");
  const add = useAction(api.credsPool.addWorkspaceCredential);
  const del = useMutation(api.credsPool.deleteWorkspaceCredentialById);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onAdd() {
    if (!key || !workspaceId) return;
    setBusy(true);
    setErr("");
    try {
      await add({ workspaceId: workspaceId as never, provider, apiKey: key, label: label.trim() || undefined });
      setKey("");
      setLabel("");
    } catch (e) {
      const d = errData(e);
      setErr(typeof d === "string" ? d : d.detail);
    } finally {
      setBusy(false);
    }
  }

  if (!workspaceId || keys === undefined) return null;
  if (keys.length === 0 && !isAdmin) return null; // nothing to show a non-admin
  const now = Date.now();
  return (
    <div className="pkeys-shared" style={{ marginTop: ".6rem", paddingTop: ".6rem", borderTop: "1px solid var(--border)" }}>
      <p className="mono muted" style={{ fontSize: ".72rem", margin: "0 0 .4rem" }}>workspace-shared · every member's calls can fail over onto these</p>
      {keys.length > 0 && (
        <ul className="pkey-list">
          {keys.map((k) => {
            const cooling = !!k.cooldownUntil && k.cooldownUntil > now;
            const badge = k.status === "dead" ? "danger" : cooling ? "key" : "ok";
            const text = k.status === "dead" ? "DEAD" : cooling ? "COOLING" : "LIVE";
            return (
              <li key={k.credId}>
                <span className="mono muted" style={{ minWidth: "6rem" }}>{k.label || "shared key"}</span>
                <span className={`badge ${badge}`}>{text}</span>
                {isAdmin && <button className="link danger" onClick={() => void del({ credId: k.credId })}>remove</button>}
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && (
        <div className="row pkey-add">
          <input placeholder="label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: "9rem" }} />
          <input type="password" placeholder="share a key — sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn" disabled={busy || !key} onClick={() => void onAdd()}>{busy ? "…" : "+ shared"}</button>
        </div>
      )}
      {err && <p className="mono" style={{ color: "var(--danger)", fontSize: ".82rem", marginTop: ".4rem" }}>{err}</p>}
    </div>
  );
}
