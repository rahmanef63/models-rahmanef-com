"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ErrorLine } from "@/app/app/_components/shared";
import { parseCustomProviderConfig, parseModelList } from "./custom-provider-config";

// Add a custom OpenAI-compatible / Anthropic-Messages provider. TWO input modes:
//  • fields — name / protocol / baseURL / key (+ optional models, comma or newline separated)
//  • JSON   — paste {name, baseURL, apiKey, protocol, models[]} whole
// Models entered here are SAVED on the provider and show up as a dropdown in chat, so they never
// need retyping per thread. (To add models later without re-pasting the key, type them in the chat
// picker — that persists too via credentials.setProviderModels.)
export function CustomProviderForm({ isAdmin }: { isAdmin: boolean }) {
  const connect = useAction(api.customProvider.connectCustomProvider);
  const [mode, setMode] = useState<"fields" | "json">("fields");
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [key, setKey] = useState("");
  const [protocol, setProtocol] = useState("openai");
  const [models, setModels] = useState("");
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null); setOk(null);
    try {
      const payload = mode === "json"
        ? parseCustomProviderConfig(json) // throws on bad JSON / missing fields → shown via ErrorLine
        : { name, baseURL, apiKey: key, protocol, models: parseModelList(models) };
      const r = await connect(payload);
      setName(""); setBaseURL(""); setKey(""); setModels(""); setJson(""); setOk(r.slug);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  const canSubmit = !busy && (mode === "json" ? !!json.trim() : !!name && !!baseURL && !!key);

  return (
    <div className="apikey">
      <div className="apikey-label mono muted">
        or add a custom endpoint — OpenAI-compatible or Anthropic Messages
        <button type="button" className="link" style={{ marginLeft: ".4rem", fontSize: ".72rem", padding: 0, minHeight: 0 }}
          onClick={() => { setMode(mode === "fields" ? "json" : "fields"); setErr(null); }}>
          {mode === "fields" ? "paste JSON" : "use fields"}
        </button>
      </div>
      {mode === "fields" ? (
        <>
          <div className="row">
            <input disabled={busy} placeholder="name (e.g. my-llm)" value={name} onChange={(e) => { setName(e.target.value); setErr(null); setOk(null); }} style={{ width: "auto" }} />
            <select disabled={busy} value={protocol} onChange={(e) => setProtocol(e.target.value)} style={{ width: "auto" }} title="wire protocol the endpoint speaks">
              <option value="openai">OpenAI /chat/completions</option>
              <option value="anthropic">Anthropic /v1/messages</option>
            </select>
            <input disabled={busy} placeholder="https://host/v1" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
            <input disabled={busy} type="password" placeholder="api key" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <input disabled={busy} placeholder="models (optional) — comma/newline separated, e.g. minimax-m3, gemini-3.5-flash" value={models}
            onChange={(e) => setModels(e.target.value)} style={{ marginTop: ".4rem", width: "100%" }} />
        </>
      ) : (
        <textarea disabled={busy} className="mono" rows={7} style={{ width: "100%", marginTop: ".2rem" }} value={json}
          onChange={(e) => { setJson(e.target.value); setErr(null); setOk(null); }}
          placeholder={'{\n  "name": "ai-hub",\n  "baseURL": "https://host/v1",\n  "apiKey": "sk-…",\n  "protocol": "openai",\n  "models": ["minimax-m3", "gemini-3.5-flash"]\n}'} />
      )}
      <div className="row" style={{ marginTop: ".4rem" }}>
        <button className="btn accent" disabled={!canSubmit} onClick={submit}>{busy ? "…" : "Add"}</button>
      </div>
      {ok && <p className="ok-line">✓ added <code>{ok}</code> — its models are now in the chat picker under <code>{ok}</code>.</p>}
      {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
    </div>
  );
}
