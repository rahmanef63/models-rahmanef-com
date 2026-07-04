"use client";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";

type Tok = { id: string; label: string; createdAt: number; lastUsedAt: number | null; revoked: boolean };

export function McpCard() {
  const issue = useAction(api.mcpNode.issueMcpToken);
  const tokens = useQuery(api.mcp.listMcpTokens) as Tok[] | undefined;
  const revoke = useMutation(api.mcp.revokeMcpToken);
  const revokeAll = useMutation(api.mcp.revokeAllMcpTokens);
  const { workspaceId } = useWorkspace();
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/mcp` : `${process.env.NEXT_PUBLIC_SITE_URL || ""}/mcp`;
  return (
    <section className="card">
      <h2>MCP server</h2>
      <p className="sub">Expose your gateway tools (chat, providers, usage) to MCP clients — Claude Code, Cursor, any MCP-aware agent. Each token acts as you (your BYOK keys).</p>
      <div className="mcp-endpoint mono">{endpoint}</div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <input placeholder="token label (e.g. my-laptop)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn accent" disabled={busy} onClick={async () => { setBusy(true); setFresh(""); try { const { token } = await issue({ label: label || "token", workspaceId: (workspaceId ?? undefined) as any }); setFresh(token); setLabel(""); } finally { setBusy(false); } }}>
          {busy ? "…" : "Generate token"}
        </button>
      </div>
      {fresh && (
        <div className="device" style={{ marginTop: "0.9rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Copy now — shown once, then only its hash is stored:</p>
          <div className="devicecode" style={{ fontSize: "0.82rem", letterSpacing: "normal", wordBreak: "break-all" }}>{fresh}</div>
        </div>
      )}
      {tokens && tokens.length > 0 && (
        <>
          {tokens.filter((t) => !t.revoked).length > 1 && (
            <div className="row" style={{ justifyContent: "flex-end", marginTop: "1rem", marginBottom: "-0.4rem" }}>
              <button className="link danger" onClick={() => { if (confirm("Revoke ALL active MCP tokens? Every client using them stops working immediately.")) void revokeAll(); }}>revoke all</button>
            </div>
          )}
          <ul className="creds" style={{ marginTop: "1.2rem" }}>
          {tokens.map((t) => (
            <li key={t.id}>
              <span className="name mono" style={{ fontSize: ".85rem", textDecoration: t.revoked ? "line-through" : "none" }}>{t.label}</span>
              <span className="mono muted" style={{ fontSize: ".7rem" }}>{t.lastUsedAt ? "used " + new Date(t.lastUsedAt).toISOString().slice(0, 10) : "never used"}</span>
              {t.revoked ? <span className="badge">revoked</span> : <button className="link danger" onClick={() => void revoke({ id: t.id as any })}>revoke</button>}
            </li>
          ))}
          </ul>
        </>
      )}
      <details className="apikey">
        <summary style={{ cursor: "pointer" }} className="mono muted">Claude Code / Cursor config</summary>
        <pre>{`{
  "mcpServers": {
    "models-rahmanef": {
      "url": "${endpoint}",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}`}</pre>
      </details>
    </section>
  );
}
