"use client";
// API keys for the /v1 gateway — issue (shown once), list, revoke, + client setup snippets.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { useConfirm } from "@/app/app/_components/responsive-dialog";

type Key = { id: string; prefix: string; label: string; createdAt: number; lastUsedAt: number | null };

export function ApiKeysCard() {
  const { workspaceId } = useWorkspace();
  const keys = useQuery(api.apiKeys.listApiKeys, workspaceId ? { workspaceId: workspaceId as never } : "skip") as Key[] | undefined;
  const issue = useMutation(api.apiKeys.issueApiKey);
  const revoke = useMutation(api.apiKeys.revokeApiKey);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, confirmDialog } = useConfirm();
  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <section className="card">
      <h2>API keys</h2>
      <p className="sub">Point Claude Code, Cursor, Codex, or any OpenAI-compatible client at this workspace — requests spend the workspace's connected provider keys.</p>
      <div className="mcp-endpoint mono">{base}/v1</div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <input placeholder="key label (e.g. my-laptop)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn accent" disabled={busy || !workspaceId} onClick={async () => {
          setBusy(true); setFresh("");
          try { setFresh(await issue({ workspaceId: workspaceId as never, label: label || "key" })); setLabel(""); } finally { setBusy(false); }
        }}>{busy ? "…" : "Generate key"}</button>
      </div>
      {fresh && (
        <div className="device" style={{ marginTop: "0.9rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Copy now — shown once, then only its hash is stored:</p>
          <div className="devicecode" style={{ fontSize: ".82rem", letterSpacing: "normal", wordBreak: "break-all" }}>{fresh}</div>
        </div>
      )}
      {keys && keys.length > 0 && (
        <ul className="creds" style={{ marginTop: "1.2rem" }}>
          {keys.map((k) => (
            <li key={k.id}>
              <span className="name mono" style={{ fontSize: ".82rem" }}>{k.prefix} · {k.label}</span>
              <span className="cred-actions">
                <span className="mono muted" style={{ fontSize: ".7rem" }}>{k.lastUsedAt ? "used " + new Date(k.lastUsedAt).toISOString().slice(0, 10) : "never used"}</span>
                <button className="link danger" onClick={() => ask({ title: "Revoke key?", message: `Revoke "${k.label}" (${k.prefix})? Any client using it stops working immediately.`, confirmLabel: "Revoke", run: () => revoke({ id: k.id as never }) })}>revoke</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <details className="apikey">
        <summary style={{ cursor: "pointer" }} className="mono muted">Claude Code / OpenAI-SDK / Anthropic config</summary>
        <pre>{`# OpenAI-compatible (Cursor, OpenAI SDK, Codex):
OPENAI_BASE_URL=${base}/v1
OPENAI_API_KEY=sk-rr-…

# Anthropic-compatible (Claude Code):
ANTHROPIC_BASE_URL=${base}
ANTHROPIC_AUTH_TOKEN=sk-rr-…`}</pre>
      </details>
      {confirmDialog}
    </section>
  );
}
