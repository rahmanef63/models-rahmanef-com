"use client";
// Channels — inbound messaging surfaces for a workspace. Pick a kind (Telegram/Slack/WhatsApp/
// Discord), fill the per-kind secret fields (stored encrypted server-side), get the webhook URL to
// register on the platform (+ one-click setWebhook for Telegram), enable/disable, bind an agent.
// Admin-only writes are enforced server-side (requireWorkspaceRole 'admin'); the UI reflects the
// active workspace via useWorkspace. Field/hint config is data-driven from channel-kinds.ts.
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { CHANNEL_KINDS } from "./channel-kinds";
import { ChannelAccess } from "./channel-access";

type Channel = { id: string; kind: string; name: string; slug: string; agentId: string | null; enabled: boolean; lastInboundAt: number | null; lastError: string | null; createdAt: number };
type Agent = { _id: string; name: string; model: string };
type Fresh = { id: string; slug: string; kind: string; secretToken?: string };

export function ChannelsCard() {
  const { workspaceId } = useWorkspace();
  const channels = useQuery(api.channelsCore.listChannels, workspaceId ? { workspaceId: workspaceId as never } : "skip") as Channel[] | undefined;
  const agents = useQuery(api.agentDefs.list, {}) as Agent[] | undefined;
  const create = useMutation(api.channelsCore.createChannel);
  const setEnabled = useMutation(api.channelsCore.setEnabled);
  const bindAgent = useMutation(api.channelsCore.bindAgent);
  const del = useMutation(api.channelsCore.deleteChannel);
  const setWebhook = useAction(api.channelTelegram.setWebhook);

  const [kind, setKind] = useState<string>("telegram");
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState("");
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = (k: string, slug: string) => `${base}/channels/${k}/${slug}`;
  const spec = CHANNEL_KINDS.find((k) => k.id === kind) ?? CHANNEL_KINDS[0];
  const canCreate = spec.fields.every((f) => f.optional || (fields[f.key] ?? "").trim());
  const reset = () => { setFields({}); setFresh(null); setHook(""); };

  return (
    <section className="card">
      <h2>Channels</h2>
      <p className="sub">Let people reach a workspace agent from Telegram, Slack, WhatsApp, or Discord. Replies use this workspace's connected provider keys and go back to the same conversation.</p>

      <div className="row" style={{ marginTop: "1rem", gap: ".5rem", flexWrap: "wrap" }}>
        <select value={kind} onChange={(e) => { setKind(e.target.value); reset(); }}>
          {CHANNEL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <input placeholder="channel name (e.g. support bot)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: ".5rem", gap: ".5rem", flexWrap: "wrap" }}>
        {spec.fields.map((f) => (
          <input key={f.key} type={f.secret ? "password" : "text"} placeholder={f.label} value={fields[f.key] ?? ""}
            onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))} style={{ flex: "1 1 14rem" }} />
        ))}
      </div>
      <p className="sub" style={{ marginTop: ".4rem", fontSize: ".78rem" }}>{spec.hint}</p>
      <div className="row" style={{ marginTop: ".5rem" }}>
        <button className="btn accent" disabled={busy || !workspaceId || !canCreate} onClick={async () => {
          setBusy(true); setFresh(null); setHook("");
          try {
            const r = await create({ workspaceId: workspaceId as never, kind, name: name || spec.label, secrets: fields as never });
            setFresh({ id: r.id, slug: r.slug, kind, secretToken: r.secretToken ?? undefined }); setName(""); setFields({});
          } finally { setBusy(false); }
        }}>{busy ? "…" : `Add ${spec.label}`}</button>
      </div>

      {fresh && (
        <div className="device" style={{ marginTop: "0.9rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Webhook URL (register this on the platform):</p>
          <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{webhookUrl(fresh.kind, fresh.slug)}</div>
          {fresh.secretToken && (
            <>
              <p className="mono muted" style={{ fontSize: ".78rem", marginTop: ".6rem" }}>Secret token — shown once (set as <code>secret_token</code> on setWebhook):</p>
              <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{fresh.secretToken}</div>
            </>
          )}
          {fresh.kind === "telegram" && (
            <button className="btn" style={{ marginTop: ".6rem" }} onClick={async () => {
              const r = await setWebhook({ channelId: fresh.id as never, webhookUrl: webhookUrl("telegram", fresh.slug) });
              setHook(r.ok ? "Webhook registered with Telegram." : `setWebhook failed: ${r.detail ?? "unknown"}`);
            }}>Register webhook automatically</button>
          )}
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
              <ChannelAccess channelId={c.id} />
            </li>
          ))}
        </ul>
      )}
      {channels && channels.length === 0 && <p className="sub" style={{ marginTop: "1rem" }}>No channels yet — add one above.</p>}
    </section>
  );
}
