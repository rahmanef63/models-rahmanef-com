"use client";
// External MCP servers — connect an HTTP/SSE MCP server so agents can call its tools as
// mcp__<server>__<tool>. Probe enumerates + caches the tool list; toggle enables/disables; custom
// auth headers are stored encrypted and never shown back. Mirrors the memory/members card shape.
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { useConfirm } from "@/app/app/_components/responsive-dialog";

type Srv = {
  id: string; name: string; url: string; transport: string; enabled: boolean; hasHeaders: boolean;
  toolCount: number; tools: { name: string; description: string }[];
  lastProbeAt?: number; lastProbeOk?: boolean; lastProbeError?: string;
};

export function McpServersCard() {
  const { workspaceId, role } = useWorkspace();
  const servers = useQuery(api.mcpServers.listServers, workspaceId ? { workspaceId: workspaceId as never } : {}) as Srv[] | undefined;
  const add = useAction(api.mcpServers.addServer);
  const update = useAction(api.mcpServers.updateServer);
  const remove = useMutation(api.mcpServers.removeServer);
  const toggle = useMutation(api.mcpServers.toggleServer);
  const probe = useAction(api.mcpClientNode.probeServer);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState("http");
  const [headers, setHeaders] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { ask, confirmDialog } = useConfirm();
  const canWrite = role !== "viewer";

  function resetForm() { setEditId(null); setName(""); setUrl(""); setHeaders(""); }
  function edit(s: Srv) { setEditId(s.id); setName(s.name); setUrl(s.url); setTransport(s.transport); setHeaders(""); setErr(null); }

  async function save() {
    setErr(null); setBusy("add");
    try {
      // on edit, a blank headers box means "keep existing" (backend: undefined = leave as-is).
      if (editId) await update({ id: editId as never, name: name.trim(), url: url.trim(), transport, headersJson: headers.trim() || undefined });
      else await add({ name: name.trim(), url: url.trim(), transport, workspaceId: workspaceId as never, headersJson: headers.trim() || undefined });
      resetForm();
    } catch (e) { setErr((e as { data?: { detail?: string } })?.data?.detail ?? "Failed to save server"); }
    finally { setBusy(null); }
  }

  return (
    <section className="card">
      <h2>MCP Servers</h2>
      <p className="sub">Connect external MCP servers (HTTP or SSE). Your agents can call their tools as <span className="mono">mcp__&lt;server&gt;__&lt;tool&gt;</span>. Probe to load the tool list. Custom headers are stored encrypted.</p>
      {canWrite && (
        <div style={{ marginTop: "1rem", display: "grid", gap: ".5rem" }}>
          <div className="row">
            <input placeholder="name (slug, e.g. github)" value={name} onChange={(e) => setName(e.target.value)} />
            <select value={transport} onChange={(e) => setTransport(e.target.value)}>
              <option value="http">http</option><option value="sse">sse</option>
            </select>
          </div>
          <input placeholder="https://server.example.com/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
          <textarea placeholder={editId ? "headers JSON — leave blank to keep existing" : 'optional headers JSON, e.g. {"Authorization":"Bearer …"}'} value={headers} onChange={(e) => setHeaders(e.target.value)} rows={2} style={{ fontFamily: "monospace", fontSize: ".82rem" }} />
          <div className="row" style={{ gap: ".5rem" }}>
            <button className="btn accent" disabled={!name.trim() || !url.trim() || busy === "add"} onClick={() => void save()}>{busy === "add" ? (editId ? "Saving…" : "Adding…") : (editId ? "Save changes" : "Add server")}</button>
            {editId && <button className="btn" onClick={resetForm}>Cancel</button>}
          </div>
          {err && <p className="mono danger" style={{ fontSize: ".8rem" }}>{err}</p>}
        </div>
      )}
      {servers && servers.length > 0 ? (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {servers.map((s) => (
            <li key={s.id} style={{ display: "block" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="name">{s.name} <span className="mono muted" style={{ fontSize: ".76rem" }}>{s.transport}</span></span>
                <span className="cred-actions">
                  <span className="badge">{s.toolCount} tool{s.toolCount === 1 ? "" : "s"}</span>
                  <button className="link" disabled={busy === s.id} onClick={async () => { setBusy(s.id); try { await probe({ serverId: s.id as never }); } finally { setBusy(null); } }}>{busy === s.id ? "probing…" : "probe"}</button>
                  <label className="mono muted" style={{ fontSize: ".78rem" }}><input type="checkbox" checked={s.enabled} onChange={(e) => void toggle({ id: s.id as never, enabled: e.target.checked })} /> on</label>
                  {canWrite && <button className="link" onClick={() => edit(s)}>edit</button>}
                  {canWrite && <button className="link danger" onClick={() => ask({ title: "Remove server?", message: `Remove "${s.name}"? Your agents lose its tools.`, confirmLabel: "Remove", run: () => remove({ id: s.id as never }) })}>remove</button>}
                </span>
              </div>
              <p className="mono muted" style={{ fontSize: ".74rem", wordBreak: "break-all" }}>{s.url}{s.hasHeaders ? " · +headers" : ""}</p>
              {s.lastProbeAt && (
                <p className="mono" style={{ fontSize: ".74rem", color: s.lastProbeOk ? undefined : "var(--danger, #d33)" }}>
                  {s.lastProbeOk ? `probed ok — ${s.tools.map((t) => t.name).slice(0, 8).join(", ")}${s.tools.length > 8 ? "…" : ""}` : `probe failed: ${s.lastProbeError ?? "unknown"}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : servers ? <p className="sub" style={{ marginTop: "1rem" }}>No MCP servers yet. Add one above, then probe to load its tools.</p> : <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>}
      {confirmDialog}
    </section>
  );
}
