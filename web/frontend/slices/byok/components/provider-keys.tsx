"use client";
import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errData } from "@/app/app/_components/shared";

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
    </div>
  );
}
