"use client";
// Embed manager — create a public chat widget for any website + copy its <script> snippet. The
// token is publishable (safe in client code); it's gated by the origin allowlist + rate limit + the
// owner's spend cap. Backed by convex/embeds + the /api/embed[/widget] routes.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errData } from "./shared";

type Embed = { id: string; title: string; model: string; token: string; allowedOrigins: string[]; enabled: boolean; greeting: string; systemPrompt: string; createdAt: number };

const snippet = (token: string, title: string) =>
  `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/embed/widget" data-token="${token}" data-title="${title.replace(/"/g, "&quot;")}" async></script>`;

export function EmbedCard({ models }: { models: string[] }) {
  const embeds = useQuery(api.embeds.listEmbeds) as Embed[] | undefined;
  const create = useMutation(api.embeds.createEmbed);
  const setEnabled = useMutation(api.embeds.setEmbedEnabled);
  const remove = useMutation(api.embeds.removeEmbed);
  const [title, setTitle] = useState("Assistant");
  const [model, setModel] = useState("");
  const [origins, setOrigins] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [greeting, setGreeting] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  async function onCreate() {
    setBusy(true); setErr("");
    try {
      await create({ title, model: model.trim(), systemPrompt: systemPrompt || undefined, greeting: greeting || undefined, allowedOrigins: origins.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) });
      setModel(""); setOrigins(""); setSystemPrompt(""); setGreeting("");
    } catch (e) { const d = errData(e); setErr(typeof d === "string" ? d : d.detail); }
    finally { setBusy(false); }
  }
  function copy(text: string, id: string) { void navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); }

  return (
    <section className="card">
      <h2>Embed on any website</h2>
      <p className="sub">Create a public chat widget, then drop one <span className="mono">&lt;script&gt;</span> tag into any site. It runs on your connected models + creds, locked to the website origins you list. The token is publishable (safe in client code) — protected by the origin allowlist, a per-widget rate limit, and your spend cap.</p>

      <div className="embed-form">
        <div className="row">
          <input placeholder="Widget title — e.g. Support" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input list="embed-models" placeholder="provider/model" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="embed-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <textarea rows={2} placeholder="System prompt — the assistant's persona (optional)" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        <input placeholder="Greeting shown when opened (optional)" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
        <textarea rows={2} placeholder="Allowed website origins, one per line — e.g. https://yoursite.com" value={origins} onChange={(e) => setOrigins(e.target.value)} />
        <div className="row">
          <button className="btn accent" disabled={busy || !model.trim() || !origins.trim()} onClick={() => void onCreate()}>{busy ? "…" : "Create widget"}</button>
        </div>
        {err && <p className="mono" style={{ color: "var(--danger)", fontSize: ".82rem" }}>{err}</p>}
      </div>

      <div className="embed-list">
        {embeds === undefined ? <p className="muted mono">…</p> : embeds.length === 0 ? <p className="muted" style={{ marginTop: "1rem" }}>No widgets yet.</p> : embeds.map((e) => (
          <div className="embed-item" key={e.id}>
            <div className="embed-head">
              <span className="name">{e.title} <span className="muted mono" style={{ fontSize: ".75rem" }}>· {e.model}</span></span>
              <span className="cred-actions">
                <span className={`badge ${e.enabled ? "ok" : ""}`}>{e.enabled ? "LIVE" : "OFF"}</span>
                <button className="link" onClick={() => void setEnabled({ id: e.id as never, enabled: !e.enabled })}>{e.enabled ? "disable" : "enable"}</button>
                <button className="link danger" onClick={() => void remove({ id: e.id as never })}>delete</button>
              </span>
            </div>
            <div className="muted mono" style={{ fontSize: ".74rem" }}>{e.allowedOrigins.join(" · ")}</div>
            <pre className="embed-snippet">{snippet(e.token, e.title)}</pre>
            <button className="link" onClick={() => copy(snippet(e.token, e.title), e.id)}>{copied === e.id ? "copied ✓" : "copy snippet"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
