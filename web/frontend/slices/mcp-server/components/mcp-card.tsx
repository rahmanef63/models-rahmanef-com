"use client";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { ConfirmDialog } from "@/features/core";

type Tok = { id: string; label: string; createdAt: number; expiresAt: number | null; lastUsedAt: number | null; revoked: boolean };

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function McpCard() {
  const issue = useAction(api.mcpNode.issueMcpToken);
  const tokens = useQuery(api.mcp.listMcpTokens) as Tok[] | undefined;
  const revoke = useMutation(api.mcp.revokeMcpToken);
  const revokeAll = useMutation(api.mcp.revokeAllMcpTokens);
  const { workspaceId } = useWorkspace();
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; run: () => unknown } | null>(null);
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
              <button className="link danger" onClick={() => setConfirm({ title: "Revoke all tokens?", message: "Revoke ALL active MCP tokens? Every client using them stops working immediately.", run: () => revokeAll() })}>revoke all</button>
            </div>
          )}
          <ul className="creds" style={{ marginTop: "1.2rem" }}>
          {tokens.map((t) => (
            <li key={t.id}>
              <span className="name mono" style={{ fontSize: ".85rem", textDecoration: t.revoked ? "line-through" : "none" }}>{t.label}</span>
              <span className="mono muted" style={{ fontSize: ".7rem" }}>
                {"made " + day(t.createdAt)}
                {t.lastUsedAt ? " · used " + day(t.lastUsedAt) : " · never used"}
                {t.expiresAt ? " · expires " + day(t.expiresAt) : ""}
              </span>
              {t.revoked ? <span className="badge">revoked</span> : <button className="link danger" onClick={() => setConfirm({ title: "Revoke token?", message: `Revoke "${t.label}"? Any client using it stops working immediately.`, run: () => revoke({ id: t.id as any }) })}>revoke</button>}
            </li>
          ))}
          </ul>
        </>
      )}
      <details className="apikey">
        <summary style={{ cursor: "pointer" }} className="mono muted">Client setup</summary>
        <p className="sub" style={{ marginTop: ".6rem" }}>
          ChatGPT → Connectors → New app → paste the URL above, pick OAuth, leave Client ID/Secret blank.
          Claude Code / Cursor use a token instead:
        </p>
        <pre>{`{
  "mcpServers": {
    "models-rahmanef": {
      "url": "${endpoint}",
      "headers": { "Authorization": "Bearer <your token>" }
    }
  }
}`}</pre>
      </details>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => { void confirm?.run(); }} title={confirm?.title ?? ""} message={confirm?.message} confirmLabel="Revoke" />
    </section>
  );
}
