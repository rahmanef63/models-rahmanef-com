"use client";
import { CopyField } from "@/features/core";
import { useState } from "react";
import { useDeviceLogin } from "./use-device-login";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SUPPORTED, type Catalog } from "../lib/provider-meta";
import { ApiKeyForm, CustomProviderForm } from "./providers";

// Owns the four OAuth connect flows (OpenAI Codex + GitHub Copilot device-code, Claude PKCE
// manual-paste, OpenRouter PKCE redirect) + the manual API-key form. `providers` itself stays a
// reactive Convex query in Dashboard (drives hasCodex/hasClaude/hasCopilot there) — this component
// only needs to kick off a connect and report success/failure via onBanner.
export function ConnectProviders({ catalog, isAdmin, setCredential, testCredential, onBanner }: {
  catalog: Catalog;
  isAdmin: boolean;
  setCredential: (a: { provider: string; apiKey: string }) => Promise<unknown>;
  testCredential: (a: { provider: string; model: string }) => Promise<any>;
  onBanner: (msg: string) => void;
}) {
  const startCodex = useAction(api.oauth.startCodexLogin);
  const pollCodex = useAction(api.oauth.pollCodexLogin);
  const startOpenRouter = useAction(api.oauth.startOpenRouterConnect);
  const startClaude = useAction(api.oauth.startClaudeConnect);
  const finishClaude = useAction(api.oauth.finishClaudeConnect);
  const startCopilot = useAction(api.oauthCopilot.startCopilotLogin);
  const pollCopilot = useAction(api.oauthCopilot.pollCopilotLogin);

  const codex = useDeviceLogin(startCodex, pollCodex, "OpenAI", onBanner);
  const copilot = useDeviceLogin(startCopilot, pollCopilot, "GitHub Copilot", onBanner);
  const codexFlow = codex.flow, copilotFlow = copilot.flow;
  const [claudeFlow, setClaudeFlow] = useState(false);
  const [claudeInput, setClaudeInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function connectOpenRouter() {
    if (busy) return;
    setBusy("openrouter"); onBanner("");
    try { const { url } = await startOpenRouter(); window.location.href = url; }
    catch { onBanner("⚠ OpenRouter sign-in could not start. Try again."); }
    finally { setBusy(null); }
  }

  async function connectClaude() {
    if (busy) return;
    setBusy("claude"); onBanner("");
    try {
      const { url } = await startClaude();
      window.open(url, "_blank", "noopener");
      setClaudeFlow(true);
    } catch {
      onBanner("⚠ Sign-in failed. Try again.");
    } finally { setBusy(null); }
  }

  async function submitClaude() {
    if (busy || !claudeInput.trim()) return;
    setBusy("claude"); onBanner("");
    try {
      await finishClaude({ pasted: claudeInput });
      setClaudeFlow(false);
      setClaudeInput("");
      onBanner("✓ Claude sign-in saved — model access not tested.");
    } catch {
      onBanner("⚠ Sign-in failed. Try again.");
    } finally { setClaudeInput(""); setBusy(null); }
  }

  return (
    <section className="card">
      <h2>Connect a provider</h2>
      <p className="sub">{SUPPORTED} providers supported — sign in over OAuth, or paste a key. Each connection is yours only.</p>
      <div className="connect-grid">
        <button className="provider-btn" onClick={codex.connect} disabled={codex.busy}>
          <strong>Sign in with OpenAI</strong>
          <span>ChatGPT / Codex · oauth</span>
        </button>
        <button className="provider-btn" onClick={connectClaude} disabled={claudeFlow || !!busy}>
          <strong>Sign in with Claude</strong>
          <span>Pro / Max · oauth</span>
        </button>
        <button className="provider-btn" onClick={connectOpenRouter} disabled={!!busy}>
          <strong>Connect OpenRouter</strong>
          <span>oauth · hundreds of models</span>
        </button>
        <button className="provider-btn" onClick={copilot.connect} disabled={copilot.busy}>
          <strong>Sign in with GitHub Copilot</strong>
          <span>subscription · oauth</span>
        </button>
      </div>
      {(codex.busy && !codexFlow || copilot.busy && !copilotFlow || busy) && <p className="muted" role="status">Sign-in request pending…</p>}
      {codexFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;Open <a className="accent" href={codexFlow.url} target="_blank" rel="noreferrer">{codexFlow.url}</a></p>
          <p><span className="mono muted">02</span> &nbsp;Enter this code:</p>
          <CopyField value={codexFlow.code} label="device code" />
          <div className="row" style={{ alignItems: "center", gap: ".8rem" }}>
            <p className="spin" style={{ margin: 0 }}>◠ waiting for sign-in…</p>
            <button className="link" onClick={codex.cancel}>stop waiting</button>
          </div>
        </div>
      )}
      {copilotFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;Open <a className="accent" href={copilotFlow.url} target="_blank" rel="noreferrer">{copilotFlow.url}</a></p>
          <p><span className="mono muted">02</span> &nbsp;Enter this code:</p>
          <CopyField value={copilotFlow.code} label="device code" />
          <div className="row" style={{ alignItems: "center", gap: ".8rem" }}>
            <p className="spin" style={{ margin: 0 }}>◠ waiting for sign-in…</p>
            <button className="link" onClick={copilot.cancel}>stop waiting</button>
          </div>
        </div>
      )}
      {claudeFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;A Claude tab opened — approve access.</p>
          <p><span className="mono muted">02</span> &nbsp;Copy the <span className="accent">code#state</span> it shows and paste it here:</p>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <input placeholder="code#state" disabled={!!busy} type="password" autoComplete="off" aria-label="Claude authorization code" value={claudeInput} onChange={(e) => setClaudeInput(e.target.value)} />
            <button className="btn accent" disabled={!!busy || !claudeInput.trim()} onClick={() => void submitClaude()}>Connect</button>
            <button className="link" disabled={!!busy} onClick={() => { setClaudeFlow(false); setClaudeInput(""); }}>cancel</button>
          </div>
        </div>
      )}
      <ApiKeyForm setCredential={setCredential} testCredential={testCredential} catalog={catalog} isAdmin={isAdmin} />
      <CustomProviderForm isAdmin={isAdmin} />
    </section>
  );
}
