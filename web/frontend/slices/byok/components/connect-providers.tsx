"use client";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SUPPORTED, type Catalog } from "@/app/app/_components/shared";
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

  const [codexFlow, setCodexFlow] = useState<{ url: string; code: string } | null>(null);
  const [copilotFlow, setCopilotFlow] = useState<{ url: string; code: string } | null>(null);
  const [claudeFlow, setClaudeFlow] = useState(false);
  const [claudeInput, setClaudeInput] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const copilotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // This card only mounts while the Providers tab is active — navigating away unmounts it. Without
  // this, a device-code poll started here would keep ticking as an orphaned interval in the
  // background, and returning to the tab would show a fresh "not connecting" button that could
  // start a SECOND concurrent poll. Cancel on unmount so leaving the tab actually cancels the flow.
  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current); if (copilotTimer.current) clearInterval(copilotTimer.current); }, []);

  async function connectCodex() {
    onBanner("");
    try {
      const { verificationUrl, userCode, intervalMs } = await startCodex();
      setCodexFlow({ url: verificationUrl, code: userCode });
      pollTimer.current = setInterval(async () => {
        try {
          const { status } = await pollCodex();
          if (status !== "pending") {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setCodexFlow(null);
            onBanner(status === "done" ? "✓ OpenAI connected" : "⚠ login expired — try again");
          }
        } catch (e) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setCodexFlow(null);
          onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
        }
      }, intervalMs);
    } catch (e) {
      onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function connectCopilot() {
    onBanner("");
    try {
      const { verificationUrl, userCode, intervalMs } = await startCopilot();
      setCopilotFlow({ url: verificationUrl, code: userCode });
      copilotTimer.current = setInterval(async () => {
        try {
          const { status } = await pollCopilot();
          if (status !== "pending") {
            if (copilotTimer.current) clearInterval(copilotTimer.current);
            setCopilotFlow(null);
            onBanner(status === "done" ? "✓ GitHub Copilot connected" : "⚠ login expired — try again");
          }
        } catch (e) {
          if (copilotTimer.current) clearInterval(copilotTimer.current);
          setCopilotFlow(null);
          onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
        }
      }, intervalMs);
    } catch (e) {
      onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function connectOpenRouter() {
    const { url } = await startOpenRouter();
    window.location.href = url;
  }

  async function connectClaude() {
    onBanner("");
    try {
      const { url } = await startClaude();
      window.open(url, "_blank", "noopener");
      setClaudeFlow(true);
    } catch (e) {
      onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function submitClaude() {
    try {
      await finishClaude({ pasted: claudeInput });
      setClaudeFlow(false);
      setClaudeInput("");
      onBanner("✓ Claude connected");
    } catch (e) {
      onBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section className="card">
      <h2>Connect a provider</h2>
      <p className="sub">{SUPPORTED} providers supported — sign in over OAuth, or paste a key. Each connection is yours only.</p>
      <div className="connect-grid">
        <button className="provider-btn" onClick={connectCodex} disabled={!!codexFlow}>
          <strong>Sign in with OpenAI</strong>
          <span>ChatGPT / Codex · oauth</span>
        </button>
        <button className="provider-btn" onClick={connectClaude} disabled={claudeFlow}>
          <strong>Sign in with Claude</strong>
          <span>Pro / Max · oauth</span>
        </button>
        <button className="provider-btn" onClick={connectOpenRouter}>
          <strong>Connect OpenRouter</strong>
          <span>oauth · hundreds of models</span>
        </button>
        <button className="provider-btn" onClick={connectCopilot} disabled={!!copilotFlow}>
          <strong>Sign in with GitHub Copilot</strong>
          <span>subscription · oauth</span>
        </button>
      </div>
      {codexFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;Open <a className="accent" href={codexFlow.url} target="_blank" rel="noreferrer">{codexFlow.url}</a></p>
          <p><span className="mono muted">02</span> &nbsp;Enter this code:</p>
          <div className="devicecode">{codexFlow.code}</div>
          <p className="spin">◠ waiting for sign-in…</p>
        </div>
      )}
      {copilotFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;Open <a className="accent" href={copilotFlow.url} target="_blank" rel="noreferrer">{copilotFlow.url}</a></p>
          <p><span className="mono muted">02</span> &nbsp;Enter this code:</p>
          <div className="devicecode">{copilotFlow.code}</div>
          <p className="spin">◠ waiting for sign-in…</p>
        </div>
      )}
      {claudeFlow && (
        <div className="device">
          <p><span className="mono muted">01</span> &nbsp;A Claude tab opened — approve access.</p>
          <p><span className="mono muted">02</span> &nbsp;Copy the <span className="accent">code#state</span> it shows and paste it here:</p>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <input placeholder="code#state" value={claudeInput} onChange={(e) => setClaudeInput(e.target.value)} />
            <button className="btn accent" disabled={!claudeInput.trim()} onClick={() => void submitClaude()}>Connect</button>
            <button className="link" onClick={() => { setClaudeFlow(false); setClaudeInput(""); }}>cancel</button>
          </div>
        </div>
      )}
      <ApiKeyForm setCredential={setCredential} testCredential={testCredential} catalog={catalog} isAdmin={isAdmin} />
      <CustomProviderForm isAdmin={isAdmin} />
    </section>
  );
}
