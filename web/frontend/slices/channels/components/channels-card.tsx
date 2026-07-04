"use client";
// Channels — inbound messaging surfaces for a workspace. Add a Telegram bot (paste the BotFather
// token → we store it encrypted + mint a webhook secret), show the webhook URL + secret to register
// (or one-click setWebhook), enable/disable, and bind an agent. Admin-only writes are enforced
// server-side (requireWorkspaceRole 'admin'); the UI just reflects the active workspace via useWorkspace.
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";

type Channel = { id: string; kind: string; name: string; slug: string; agentId: string | null; enabled: boolean; lastInboundAt: number | null; lastError: string | null; createdAt: number };
type Agent = { _id: string; name: string; model: string };

export function ChannelsCard() {
  const { workspaceId } = useWorkspace();
  const channels = useQuery(api.channelsCore.listChannels, workspaceId ? { workspaceId: workspaceId as never } : "skip") as Channel[] | undefined;
  const agents = useQuery(api.agentDefs.list, {}) as Agent[] | undefined;
  const create = useMutation(api.channelsCore.createChannel);
  const setEnabled = useMutation(api.channelsCore.setEnabled);
  const bindAgent = useMutation(api.channelsCore.bindAgent);
  const del = useMutation(api.channelsCore.deleteChannel);
  const setWebhook = useAction(api.channelTelegram.setWebhook);

  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [fresh, setFresh] = useState<{ id: string; slug: string; secretToken: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState<string>("");
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = (slug: string) => `${base}/channels/telegram/${slug}`;

  return (
    <section className="card">
      <h2>Channels</h2>
      <p className="sub">Let people reach a workspace agent from Telegram. Paste a BotFather token — replies use this workspace's connected provider keys and go back to the same chat.</p>

      <div className="row" style={{ marginTop: "1rem", flexWrap: "wrap", gap: ".5rem" }}>
        <input placeholder="channel name (e.g. support bot)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Telegram bot token (123456:ABC…)" value={token} onChange={(e) => setToken(e.target.value)} style={{ flex: "1 1 16rem" }} />
        <button className="btn accent" disabled={busy || !workspaceId || !token.trim()} onClick={async () => {
          setBusy(true); setFresh(null); setHook("");
          try { const r = await create({ workspaceId: workspaceId as never, kind: "telegram", name: name || "telegram", botToken: token.trim() }); setFresh({ id: r.id, slug: r.slug, secretToken: r.secretToken }); setName(""); setToken(""); }
          finally { setBusy(false); }
        }}>{busy ? "…" : "Add Telegram"}</button>
      </div>

      {fresh && (
        <div className="device" style={{ marginTop: "0.9rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Webhook URL (give this to Telegram):</p>
          <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{webhookUrl(fresh.slug)}</div>
          <p className="mono muted" style={{ fontSize: ".78rem", marginTop: ".6rem" }}>Secret token — shown once (set as <code>secret_token</code> on setWebhook):</p>
          <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{fresh.secretToken}</div>
          <button className="btn" style={{ marginTop: ".6rem" }} onClick={async () => {
            const r = await setWebhook({ channelId: fresh.id as never, webhookUrl: webhookUrl(fresh.slug) });
            setHook(r.ok ? "Webhook registered with Telegram." : `setWebhook failed: ${r.detail ?? "unknown"}`);
          }}>Register webhook automatically</button>
          {hook && <p className="sub" style={{ marginTop: ".5rem" }}>{hook}</p>}
        </div>
      )}

      {channels && channels.length > 0 && (
        <ul className="creds" style={{ marginTop: "1.2rem" }}>
          {channels.map((c) => (
            <li key={c.id} style={{ flexWrap: "wrap", gap: ".4rem" }}>
              <span className="name mono" style={{ fontSize: ".82rem" }}>
                {c.enabled ? "🟢" : "⚪"} {c.name} · {c.kind}
                {c.lastError && <span className="danger" style={{ marginLeft: ".4rem" }} title={c.lastError}>⚠</span>}
              </span>
              <span className="cred-actions" style={{ gap: ".5rem" }}>
                <select value={c.agentId ?? ""} onChange={(e) => void bindAgent({ id: c.id as never, agentId: (e.target.value || null) as never })}>
                  <option value="">no agent (fallback model)</option>
                  {(agents ?? []).map((ag) => <option key={ag._id} value={ag._id}>{ag.name}</option>)}
                </select>
                <button className="link" onClick={() => void setEnabled({ id: c.id as never, enabled: !c.enabled })}>{c.enabled ? "disable" : "enable"}</button>
                <button className="link danger" onClick={() => { if (confirm(`Delete channel "${c.name}"?`)) void del({ id: c.id as never }); }}>delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {channels && channels.length === 0 && <p className="sub" style={{ marginTop: "1rem" }}>No channels yet — add a Telegram bot above.</p>}
    </section>
  );
}
