"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "OpenAI · ChatGPT / Codex",
  "anthropic-oauth": "Claude · Pro / Max",
  openrouter: "OpenRouter",
  openai: "OpenAI API",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  togetherai: "Together AI",
  "fireworks-ai": "Fireworks",
  cerebras: "Cerebras",
  perplexity: "Perplexity",
  deepinfra: "DeepInfra",
  nebius: "Nebius",
  hyperbolic: "Hyperbolic",
  sambanova: "SambaNova",
  novita: "Novita",
  cohere: "Cohere",
  glm: "Zhipu GLM",
  "github-models": "GitHub Models",
  "vercel-gateway": "Vercel AI Gateway",
};

export default function AppPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  return (
    <main className="app-main">
      <div className="app-top">
        <Link href="/" className="brand">models<b>.</b></Link>
        <TopRight authed={isAuthenticated} />
      </div>
      {isLoading ? <p className="muted mono">loading…</p> : isAuthenticated ? <Dashboard /> : <SignIn />}
    </main>
  );
}

function TopRight({ authed }: { authed: boolean }) {
  const { signOut } = useAuthActions();
  const me = useQuery(api.admin.me);
  if (!authed) return <span className="mono muted" style={{ fontSize: "0.8rem" }}>bring your own key</span>;
  return (
    <span className="account">
      {me?.email && <span className="mono muted" style={{ fontSize: "0.8rem" }}>{me.email}</span>}
      {me?.isSuperAdmin && <span className="badge oauth">SUPER</span>}
      <button className="link" onClick={() => void signOut()}>sign out</button>
    </span>
  );
}

function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try { await signIn("password", { email, password, flow }); }
        catch { setErr(flow === "signUp" ? "sign-up failed — weak password or email taken" : "sign-in failed"); }
        finally { setBusy(false); }
      }}
    >
      <h2>{flow === "signIn" ? "Sign in" : "Create account"}</h2>
      <p className="sub">Your credentials are scoped to you alone.</p>
      <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn accent" type="submit" disabled={busy}>{busy ? "…" : flow === "signIn" ? "Sign in" : "Sign up"}</button>
      <button type="button" className="link" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

type Cred = { provider: string; kind: string };
type Catalog = Record<string, { models?: Record<string, unknown> }>;

function Dashboard() {
  const me = useQuery(api.admin.me);
  const providers = useQuery(api.credentials.listConfiguredProviders) as Cred[] | undefined;
  const setCredential = useAction(api.credentials.setCredential);
  const deleteCredential = useMutation(api.credentials.deleteCredential);
  const startCodex = useAction(api.oauth.startCodexLogin);
  const pollCodex = useAction(api.oauth.pollCodexLogin);
  const startOpenRouter = useAction(api.oauth.startOpenRouterConnect);
  const codexModelList = useAction(api.oauth.codexModelList);
  const startClaude = useAction(api.oauth.startClaudeConnect);
  const finishClaude = useAction(api.oauth.finishClaudeConnect);
  const claudeModelList = useAction(api.oauth.claudeModelList);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [codexModels, setCodexModels] = useState<string[]>([]);
  const [claudeModels, setClaudeModels] = useState<string[]>([]);
  const [codexFlow, setCodexFlow] = useState<{ url: string; code: string } | null>(null);
  const [claudeFlow, setClaudeFlow] = useState(false);
  const [claudeInput, setClaudeInput] = useState("");
  const [banner, setBanner] = useState("");
  const [section, setSection] = useState("overview");

  useEffect(() => {
    fetch("https://models.dev/api.json").then((r) => r.json()).then(setCatalog).catch(() => {});
    const q = new URLSearchParams(window.location.search).get("connect");
    if (q === "openrouter") setBanner("✓ OpenRouter connected");
    else if (q === "error") setBanner("⚠ connect failed — try again");
    if (q) window.history.replaceState({}, "", "/app");
  }, []);

  const hasCodex = !!providers?.some((p) => p.provider === "openai-codex");
  const hasClaude = !!providers?.some((p) => p.provider === "anthropic-oauth");
  useEffect(() => {
    if (hasCodex) codexModelList().then(setCodexModels).catch(() => {});
    else setCodexModels([]);
  }, [hasCodex]);
  useEffect(() => {
    if (hasClaude) claudeModelList().then(setClaudeModels).catch(() => {});
    else setClaudeModels([]);
  }, [hasClaude]);

  const myModels = useMemo(() => {
    const mine = new Set((providers ?? []).map((p) => p.provider));
    const out: string[] = [...codexModels, ...claudeModels];
    for (const [pid, p] of Object.entries(catalog)) {
      if (!mine.has(pid)) continue;
      for (const mid of Object.keys(p.models ?? {})) out.push(`${pid}/${mid}`);
    }
    return out.sort();
  }, [catalog, providers, codexModels, claudeModels]);

  async function connectCodex() {
    setBanner("");
    try {
      const { verificationUrl, userCode, intervalMs } = await startCodex();
      setCodexFlow({ url: verificationUrl, code: userCode });
      const timer = setInterval(async () => {
        try {
          const { status } = await pollCodex();
          if (status !== "pending") {
            clearInterval(timer);
            setCodexFlow(null);
            setBanner(status === "done" ? "✓ OpenAI connected" : "⚠ login expired — try again");
          }
        } catch (e) {
          clearInterval(timer);
          setCodexFlow(null);
          setBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
        }
      }, intervalMs);
    } catch (e) {
      setBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function connectOpenRouter() {
    const { url } = await startOpenRouter();
    window.location.href = url;
  }

  async function connectClaude() {
    setBanner("");
    try {
      const { url } = await startClaude();
      window.open(url, "_blank", "noopener");
      setClaudeFlow(true);
    } catch (e) {
      setBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function submitClaude() {
    try {
      await finishClaude({ pasted: claudeInput });
      setClaudeFlow(false);
      setClaudeInput("");
      setBanner("✓ Claude connected");
    } catch (e) {
      setBanner("⚠ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const nav = [
    { id: "overview", label: "Overview" },
    { id: "chat", label: "Chat" },
    { id: "agents", label: "Agents" },
    { id: "providers", label: "Providers" },
    { id: "usage", label: "Usage" },
    { id: "settings", label: "Settings" },
    { id: "mcp", label: "MCP" },
    ...(me?.isSuperAdmin ? [{ id: "admin", label: "Admin" }] : []),
  ];

  return (
    <div className="app-body">
      <nav className="side">
        {nav.map((s) => (
          <button key={s.id} className={`side-link ${section === s.id ? "on" : ""}`} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </nav>

      <div className="app-content">
        {banner && <div className="banner">{banner}</div>}

        {section === "overview" && (
          <>
            <Overview providers={providers} models={myModels} go={setSection} />
            <UsageCard />
          </>
        )}

        {section === "chat" && <WorkbenchCard models={myModels} providers={providers} catalog={catalog} isAdmin={!!me?.isSuperAdmin} />}

        {section === "agents" && <AgentsCard models={myModels} isAdmin={!!me?.isSuperAdmin} />}

        {section === "providers" && (
          <>
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
              </div>
              {codexFlow && (
                <div className="device">
                  <p><span className="mono muted">01</span> &nbsp;Open <a className="accent" href={codexFlow.url} target="_blank" rel="noreferrer">{codexFlow.url}</a></p>
                  <p><span className="mono muted">02</span> &nbsp;Enter this code:</p>
                  <div className="devicecode">{codexFlow.code}</div>
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
              <ApiKeyForm setCredential={setCredential} />
            </section>

            <section className="card">
              <h2>Connected</h2>
              {providers === undefined ? (
                <p className="muted mono">…</p>
              ) : providers.length === 0 ? (
                <p className="muted">Nothing yet — connect a provider or add a key above.</p>
              ) : (
                <ul className="creds">
                  {providers.map((p) => (
                    <li key={p.provider}>
                      <span className="name">{PROVIDER_LABEL[p.provider] ?? p.provider}</span>
                      <span className={`badge ${p.kind}`}>{p.kind === "oauth" ? "OAUTH" : "API KEY"}</span>
                      <button className="link danger" onClick={() => void deleteCredential({ provider: p.provider })}>remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {section === "usage" && <UsageCard />}

        {section === "settings" && <TokenSaverCard />}

        {section === "mcp" && <McpCard />}

        {section === "admin" && me?.isSuperAdmin && <AdminCard />}
      </div>
    </div>
  );
}

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
const SUPPORTED = 23; // openai, anthropic, google, openrouter + 18 openai-compatible + openai-codex (oauth)

function Overview({ providers, models, go }: { providers: Cred[] | undefined; models: string[]; go: (s: string) => void }) {
  const u = useQuery(api.usage.myUsage);
  const tiles = [
    { n: providers === undefined ? "—" : String(providers.length), l: "connected" },
    { n: providers === undefined ? "—" : fmt(models.length), l: "models ready" },
    { n: u ? fmt(u.requests) : "—", l: "requests" },
    { n: u ? fmt(u.totalTokens) : "—", l: "tokens" },
  ];
  const quick = [
    { id: "chat", t: "Workbench", d: "chat any model" },
    { id: "agents", t: "Agents", d: "run a task loop" },
    { id: "providers", t: "Providers", d: `${SUPPORTED} to connect` },
    { id: "mcp", t: "MCP server", d: "expose your tools" },
  ];
  return (
    <>
      <section className="overview">
        {tiles.map((t) => (
          <div className="ov-tile" key={t.l}>
            <div className="ov-num">{t.n}</div>
            <div className="ov-lbl">{t.l}</div>
          </div>
        ))}
      </section>
      <div className="quicklinks">
        {quick.map((q) => (
          <button className="qlink" key={q.id} onClick={() => go(q.id)}>
            <strong>{q.t}</strong>
            <span>{q.d}</span>
          </button>
        ))}
      </div>
      {providers !== undefined && providers.length === 0 && (
        <div className="banner">No providers connected yet — <button className="link" onClick={() => go("providers")}>connect one →</button></div>
      )}
    </>
  );
}

function ByDayBars({ byDay }: { byDay: Record<string, number> }) {
  const days: string[] = [];
  const now = Date.now();
  for (let i = 13; i >= 0; i--) days.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  const max = Math.max(1, ...days.map((d) => byDay[d] ?? 0));
  return (
    <div className="bars" aria-hidden>
      {days.map((d) => (
        <div key={d} className="bar" style={{ height: `${Math.round(((byDay[d] ?? 0) / max) * 100)}%` }} title={`${d}: ${byDay[d] ?? 0}`} />
      ))}
    </div>
  );
}

function TokenSaverCard() {
  const s = useQuery(api.settings.mySettings);
  const set = useMutation(api.settings.setSettings);
  if (!s) return null;
  return (
    <section className="card">
      <h2>Chat settings</h2>
      <p className="sub">Agent mode lets the model inspect your setup. Token savers cut output tokens.</p>
      <label className="toggle">
        <input type="checkbox" checked={!!s.agentMode} onChange={(e) => void set({ agentMode: e.target.checked })} />
        <span><strong>Agent mode</strong> <span className="muted">— model can call tools (your providers, usage). Needs a tool-capable model.</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!s.cavemanEnabled} onChange={(e) => void set({ cavemanEnabled: e.target.checked })} />
        <span><strong>Caveman</strong> <span className="muted">— terse output, keeps all technical substance</span></span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={!!s.ponytailEnabled} onChange={(e) => void set({ ponytailEnabled: e.target.checked })} />
        <span><strong>Ponytail</strong> <span className="muted">— lazy / YAGNI, minimal answers</span></span>
      </label>
    </section>
  );
}

type Tok = { id: string; label: string; createdAt: number; lastUsedAt: number | null; revoked: boolean };

function McpCard() {
  const issue = useAction(api.mcpNode.issueMcpToken);
  const tokens = useQuery(api.mcp.listMcpTokens) as Tok[] | undefined;
  const revoke = useMutation(api.mcp.revokeMcpToken);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "https://models.rahmanef.com/mcp";
  return (
    <section className="card">
      <h2>MCP server</h2>
      <p className="sub">Expose your gateway tools (chat, providers, usage) to MCP clients — Claude Code, Cursor, any MCP-aware agent. Each token acts as you (your BYOK keys).</p>
      <div className="mcp-endpoint mono">{endpoint}</div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <input placeholder="token label (e.g. my-laptop)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn accent" disabled={busy} onClick={async () => { setBusy(true); setFresh(""); try { const { token } = await issue({ label: label || "token" }); setFresh(token); setLabel(""); } finally { setBusy(false); } }}>
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
        <ul className="creds" style={{ marginTop: "1.2rem" }}>
          {tokens.map((t) => (
            <li key={t.id}>
              <span className="name mono" style={{ fontSize: ".85rem", textDecoration: t.revoked ? "line-through" : "none" }}>{t.label}</span>
              <span className="mono muted" style={{ fontSize: ".7rem" }}>{t.lastUsedAt ? "used " + new Date(t.lastUsedAt).toISOString().slice(0, 10) : "never used"}</span>
              {t.revoked ? <span className="badge">revoked</span> : <button className="link danger" onClick={() => void revoke({ id: t.id as any })}>revoke</button>}
            </li>
          ))}
        </ul>
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

function UsageCard() {
  const u = useQuery(api.usage.myUsage);
  if (u === undefined) return <section className="card"><h2>Usage</h2><p className="muted mono">…</p></section>;
  if (!u || u.requests === 0) return <section className="card"><h2>Usage</h2><p className="sub">Your model calls will show up here — run a chat above.</p></section>;
  const topModels = Object.entries(u.byModel).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <section className="card">
      <h2>Usage</h2>
      <p className="sub">Live across all your model calls.</p>
      <div className="row" style={{ gap: "2.25rem" }}>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.requests)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>requests</div></div>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.totalTokens)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>tokens</div></div>
        <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{fmt(u.promptTokens)}<span className="muted"> / </span>{fmt(u.completionTokens)}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>in / out</div></div>
        {u.errors > 0 && <div><div className="mono" style={{ fontSize: "1.6rem", color: "var(--danger)" }}>{u.errors}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>errors</div></div>}
      </div>
      <ByDayBars byDay={u.byDay} />
      {topModels.length > 0 && (
        <ul className="creds" style={{ marginTop: "1.1rem" }}>
          {topModels.map(([m, n]) => (
            <li key={m}><span className="name mono" style={{ fontSize: ".82rem" }}>{m}</span><span className="mono muted">{n}×</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ n, l, danger }: { n: number; l: string; danger?: boolean }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: "1.5rem", color: danger ? "var(--danger)" : "var(--accent)" }}>{fmt(n)}</div>
      <div className="muted mono" style={{ fontSize: ".72rem" }}>{l}</div>
    </div>
  );
}

function AdminCard() {
  const stats = useQuery(api.admin.adminStats);
  const users = useQuery(api.admin.adminUsers);
  const ov = useQuery(api.admin.adminOverview);
  return (
    <section className="card">
      <h2>Admin <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Operator console — identities, counts, and aggregates only. Never a key or message content.</p>
      {stats === undefined ? (
        <p className="muted mono">…</p>
      ) : (
        <div className="row" style={{ gap: "1.75rem", rowGap: "1rem" }}>
          <Stat n={stats.users} l="users" />
          <Stat n={stats.connections} l="connections" />
          <Stat n={stats.oauth} l="via oauth" />
          {ov && <Stat n={ov.totals.requests} l="requests" />}
          {ov && <Stat n={ov.totals.agentRuns} l="agent runs" />}
          {ov && <Stat n={ov.totals.threads} l="threads" />}
          {ov && <Stat n={ov.totals.messages} l="messages" />}
          {ov && ov.totals.errors > 0 && <Stat n={ov.totals.errors} l="errors" danger />}
        </div>
      )}

      {ov && ov.providers.length > 0 && (
        <div className="admin-block">
          <h3>Providers connected</h3>
          <ul className="creds">
            {ov.providers.map(([slug, n]) => (
              <li key={slug}><span className="name">{PROVIDER_LABEL[slug] ?? slug}</span><span className="mono muted">{n}</span></li>
            ))}
          </ul>
        </div>
      )}

      {ov && ov.topModels.length > 0 && (
        <div className="admin-block">
          <h3>Top models · global</h3>
          <ul className="creds">
            {ov.topModels.map(([m, n]) => (
              <li key={m}><span className="name mono" style={{ fontSize: ".82rem" }}>{m}</span><span className="mono muted">{n}×</span></li>
            ))}
          </ul>
        </div>
      )}

      {users !== undefined && (
        <div className="admin-block">
          <h3>Users</h3>
          <ul className="creds">
            {users.map((u) => (
              <li key={u.id}>
                <span className="name mono" style={{ fontSize: ".85rem" }}>{u.email || u.name || "user·" + u.id.slice(-6)}</span>
                <span className="mono muted" style={{ fontSize: ".72rem" }}>{new Date(u.createdAt).toISOString().slice(0, 10)}</span>
                <span className="badge">{u.providers} {u.providers === 1 ? "provider" : "providers"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ApiKeyForm({ setCredential }: { setCredential: (a: { provider: string; apiKey: string }) => Promise<unknown> }) {
  const [provider, setProvider] = useState("anthropic");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const opts = ["anthropic", "openai", "google", "openrouter", "groq", "deepseek", "xai", "mistral", "moonshotai", "togetherai", "fireworks-ai", "cerebras", "perplexity", "deepinfra", "nebius", "hyperbolic", "sambanova", "novita", "cohere", "glm", "github-models", "vercel-gateway"];
  return (
    <div className="apikey">
      <div className="apikey-label mono muted">or paste an API key — any of {SUPPORTED} providers</div>
      <div className="row">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: "auto" }}>
          {opts.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p] ?? p}</option>)}
        </select>
        <input type="password" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button
          className="btn"
          disabled={busy || !key}
          onClick={async () => { setBusy(true); try { await setCredential({ provider, apiKey: key }); setKey(""); } finally { setBusy(false); } }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

type Run = { _id: string; task: string; model: string; status: string; steps?: { text: string; tools: string[] }[]; result?: string; error?: string; errorCode?: string };

function AgentsCard({ models, isAdmin }: { models: string[]; isAdmin: boolean }) {
  const runAgent = useAction(api.chat.runAgent);
  const runs = useQuery(api.agents.myRuns) as Run[] | undefined;
  const [model, setModel] = useState("");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  return (
    <section className="card">
      <h2>AI Agents</h2>
      <p className="sub">Give a tool-capable model a task — it runs a multi-step loop with tools and traces every step.</p>
      <div className="row">
        <input list="agentmodels" placeholder="provider/model" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="agentmodels">{models.map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <textarea rows={2} placeholder="e.g. list which providers I've connected, then summarize my usage" value={task} onChange={(e) => setTask(e.target.value)} />
      <button
        className="btn accent"
        disabled={!model || !task || busy}
        onClick={async () => { setBusy(true); setErr(null); try { await runAgent({ model, task }); setTask(""); } catch (e) { setErr(e); } finally { setBusy(false); } }}
      >
        {busy ? "running…" : "Run agent"}
      </button>
      {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
      {runs && runs.length > 0 && (
        <ul className="runs">
          {runs.map((r) => (
            <li key={r._id}>
              <details>
                <summary>
                  <span className="badge" style={r.status === "error" ? { color: "var(--danger)" } : undefined}>{r.status}</span>
                  <span className="name">{r.task}</span>
                  <span className="mono muted" style={{ fontSize: ".72rem" }}>{r.model}</span>
                </summary>
                <div className="trace">
                  {(r.steps ?? []).map((s, i) => (
                    <div key={i} className="step">
                      {s.tools.length > 0 && <div className="tools">{s.tools.map((t, j) => <span key={j} className="badge">{t}</span>)}</div>}
                      {s.text && <p>{s.text}</p>}
                    </div>
                  ))}
                  {r.result && <pre>{r.result}</pre>}
                  {r.error && <ErrorLine e={{ data: { code: r.errorCode ?? "internal", detail: r.error, model: r.model } }} isAdmin={isAdmin} />}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Msg = { _id: string; role: string; content: string };
type Thread = { _id: string; title: string; model: string };

// ConvexError from an action arrives with the real payload in `.data` — either a plain string
// (e.g. "Please sign in.") or the structured {code,status,detail,provider,model} chat.ts throws
// for a model-call failure. Plain (non-Convex) errors fall back to `.message`.
type ChatErrData = { code: string; status?: number; detail: string; provider?: string; model?: string };
function errData(e: unknown): ChatErrData | string {
  const d = (e as { data?: unknown })?.data;
  if (d && typeof d === "object") return d as ChatErrData;
  if (typeof d === "string" && d) return d;
  return e instanceof Error ? e.message : String(e);
}
// non-admin message per error code — no raw provider text, just what the user can act on.
const FRIENDLY: Record<string, (provider: string) => string> = {
  not_connected: (p) => `${p} isn't connected — add it in the Providers tab.`,
  invalid_api_key: (p) => `Your ${p} API key was rejected — check it in the Providers tab.`,
  rate_limited: (p) => `${p} is rate-limiting requests right now — try again shortly.`,
  quota_exceeded: (p) => `${p} says this key is out of credit or quota.`,
  not_found: (p) => `This model isn't available from ${p} — try a different one.`,
  invalid_request: (p) => `${p} couldn't process this request — try a different model.`,
  provider_error: (p) => `${p} had a problem handling this request. Try again.`,
  internal: () => `Something went wrong on our side. Try again, or ask an admin.`,
};
function ErrorLine({ e, isAdmin }: { e: unknown; isAdmin: boolean }) {
  const d = errData(e);
  if (typeof d === "string") return <p className="err">{d}</p>;
  const label = d.provider ? (PROVIDER_LABEL[d.provider] ?? d.provider) : "This provider";
  const friendly = (FRIENDLY[d.code] ?? FRIENDLY.internal)(label);
  return (
    <p className="err">
      {friendly}
      {isAdmin && (
        <span className="mono muted" style={{ display: "block", fontSize: ".72rem", marginTop: ".3rem" }}>
          {d.code}{d.status != null ? ` · ${d.status}` : ""}{d.model ? ` · ${d.model}` : ""} · {d.detail}
        </span>
      )}
    </p>
  );
}
const splitModel = (m: string): [string, string] => { const i = m.indexOf("/"); return [m.slice(0, i), m.slice(i + 1)]; };
const route = (kind?: string) => (kind === "oauth" ? { label: "OAUTH", cls: "oauth" } : { label: "API KEY", cls: "key" });
const kfmt = (n?: number) => (n == null ? "—" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n));

// pull models.dev metadata (context, cost, modalities…) for the inspector. null for oauth models
// or anything not in the catalog.
function modelMeta(catalog: Catalog, provider: string, id: string) {
  const m = (catalog[provider]?.models as Record<string, any> | undefined)?.[id];
  if (!m) return null;
  const cells: [string, string][] = [];
  if (m.limit?.context != null) cells.push(["context", kfmt(m.limit.context) + " tok"]);
  if (m.limit?.output != null) cells.push(["max out", kfmt(m.limit.output) + " tok"]);
  if (m.cost?.input != null) cells.push(["in $/M", "$" + m.cost.input]);
  if (m.cost?.output != null) cells.push(["out $/M", "$" + m.cost.output]);
  if (m.tool_call != null) cells.push(["tools", m.tool_call ? "yes" : "no"]);
  if (m.reasoning != null) cells.push(["reasoning", m.reasoning ? "yes" : "no"]);
  if (Array.isArray(m.modalities?.input) && m.modalities.input.length) cells.push(["input", m.modalities.input.join(" · ")]);
  if (m.knowledge) cells.push(["knowledge", String(m.knowledge)]);
  if (m.release_date) cells.push(["released", String(m.release_date)]);
  return cells;
}

function ModelInspector({ catalog, model }: { catalog: Catalog; model: string }) {
  const [provider, id] = splitModel(model);
  const cells = modelMeta(catalog, provider, id);
  return (
    <div className="wb-inspector">
      <div className="insp-id mono">{provider}<span className="muted">/</span>{id}</div>
      {!cells || cells.length === 0 ? (
        <p className="muted mono" style={{ fontSize: ".74rem", margin: 0 }}>No catalog metadata for this model.</p>
      ) : (
        <div className="insp-grid">
          {cells.map(([k, val]) => (
            <div className="insp-cell" key={k}><span className="mono muted">{k}</span><b>{val}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

// provider-first model picker — never dumps every model at once. Pick a provider, then its models.
function ModelPicker({ byProvider, providers, catalog, onPick }: {
  byProvider: Record<string, string[]>;
  providers: Cred[] | undefined;
  catalog: Catalog;
  onPick: (m: string) => void;
}) {
  const provs = Object.keys(byProvider).sort((a, b) => (PROVIDER_LABEL[a] ?? a).localeCompare(PROVIDER_LABEL[b] ?? b));
  const [prov, setProv] = useState<string | null>(provs.length === 1 ? provs[0] : null);
  const [q, setQ] = useState("");
  if (provs.length === 0) return <p className="sub">No models available — connect a provider in the <b>Providers</b> tab first.</p>;
  const list = prov ? byProvider[prov] ?? [] : []; // ?? [] — the live query can drop the selected provider mid-mount
  const ids = list.filter((id) => id.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="picker">
      <div className="picker-step mono muted">1 · provider</div>
      <div className="prov-chips">
        {provs.map((p) => {
          const r = route(providers?.find((x) => x.provider === p)?.kind);
          return (
            <button key={p} className={`prov-chip ${prov === p ? "on" : ""}`} onClick={() => { setProv(p); setQ(""); }}>
              <strong>{PROVIDER_LABEL[p] ?? p}</strong>
              <span className={`badge ${r.cls}`}>{r.label}</span>
              <em>{byProvider[p].length}</em>
            </button>
          );
        })}
      </div>
      {prov && (
        <>
          <div className="picker-step mono muted">2 · model · {list.length} available</div>
          <input placeholder={`search ${PROVIDER_LABEL[prov] ?? prov} models…`} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="model-list">
            {ids.length === 0 ? (
              <p className="muted mono" style={{ fontSize: ".78rem", padding: ".55rem .85rem", margin: 0 }}>no match</p>
            ) : (
              ids.slice(0, 200).map((id) => {
                const ctx = (catalog[prov]?.models as Record<string, any> | undefined)?.[id]?.limit?.context as number | undefined;
                return (
                  <button key={id} className="model-row" onClick={() => onPick(`${prov}/${id}`)}>
                    <span className="mono">{id}</span>
                    {ctx != null && <span className="mono muted" style={{ fontSize: ".72rem" }}>{kfmt(ctx)} tok</span>}
                  </button>
                );
              })
            )}
            {ids.length > 200 && <p className="muted mono" style={{ fontSize: ".72rem", padding: ".4rem .85rem", margin: 0 }}>+{ids.length - 200} more — refine search</p>}
          </div>
        </>
      )}
    </div>
  );
}

function WorkbenchCard({ models, providers, catalog, isAdmin }: { models: string[]; providers: Cred[] | undefined; catalog: Catalog; isAdmin: boolean }) {
  const threads = useQuery(api.threads.listThreads) as Thread[] | undefined;
  const createThread = useMutation(api.threads.createThread);
  const deleteThread = useMutation(api.threads.deleteThread);
  const sendMessage = useAction(api.threads.sendMessage);
  const [active, setActive] = useState<string | null>(null);
  const [model, setModel] = useState(""); // model chosen for a NEW (not-yet-created) thread
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [showInsp, setShowInsp] = useState(false);
  const msgs = useQuery(api.threads.threadMessages, active ? { threadId: active as any } : "skip") as Msg[] | undefined;

  const byProvider = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const m of models) { const [p, id] = splitModel(m); if (p && id) (g[p] ??= []).push(id); }
    return g;
  }, [models]);

  const activeThread = threads?.find((t) => t._id === active);
  const currentModel = activeThread?.model ?? (model || null); // model in the header/composer context
  const currentProvider = currentModel ? splitModel(currentModel)[0] : null;
  const r = route(providers?.find((p) => p.provider === currentProvider)?.kind);

  function newChat() { setActive(null); setModel(""); setInput(""); setErr(null); setShowInsp(false); }

  async function send() {
    if (!input.trim() || busy) return;
    setErr(null);
    setBusy(true);
    try {
      let tid = active;
      if (!tid) {
        if (!model) { setErr("pick a model first"); return; }
        tid = (await createThread({ model, title: input.slice(0, 60) })) as string;
        setActive(tid);
      }
      const content = input;
      setInput("");
      await sendMessage({ threadId: tid as any, content });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="wb-head">
        <div>
          <h2>Chat workbench</h2>
          <p className="sub" style={{ margin: 0 }}>Threaded, persisted conversations. Token savers + agent mode apply.</p>
        </div>
        <button className="btn" onClick={newChat}>+ New chat</button>
      </div>
      <div className="wb">
        <aside className="wb-threads">
          <div className="wb-threads-h mono muted">threads</div>
          <ul>
            {threads === undefined ? <li className="empty muted mono">…</li> : threads.length === 0 ? <li className="empty muted mono">no threads yet</li> : null}
            {(threads ?? []).map((t) => {
              const [tp] = splitModel(t.model);
              const tr = route(providers?.find((p) => p.provider === tp)?.kind);
              return (
                <li key={t._id} className={active === t._id ? "on" : ""}>
                  <button className="thread-btn" onClick={() => { setActive(t._id); setShowInsp(false); setErr(null); }}>
                    <span className="t-title">{t.title}</span>
                    <span className="t-model mono muted">{PROVIDER_LABEL[tp] ?? tp} · <span className={`t-route ${tr.cls}`}>{tr.label.toLowerCase()}</span></span>
                  </button>
                  <button className="link del" title="delete thread" aria-label="delete thread" onClick={() => { if (active === t._id) newChat(); void deleteThread({ threadId: t._id as any }); }}>×</button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="wb-main">
          {currentModel && currentProvider && (
            <div className="wb-modelbar">
              <div className="wb-mb-id">
                <span className="wb-mb-prov">{PROVIDER_LABEL[currentProvider] ?? currentProvider}</span>
                <span className="wb-mb-model mono">{splitModel(currentModel)[1]}</span>
              </div>
              <div className="wb-mb-right">
                <span className={`badge ${r.cls}`}>{r.label}</span>
                <button className="link" aria-expanded={showInsp} onClick={() => setShowInsp((v) => !v)}>{showInsp ? "hide details" : "details"}</button>
              </div>
            </div>
          )}
          {currentModel && showInsp && <ModelInspector catalog={catalog} model={currentModel} />}

          {!active && !model ? (
            <ModelPicker byProvider={byProvider} providers={providers} catalog={catalog} onPick={(m) => { setModel(m); setErr(null); }} />
          ) : (
            <>
              <div className="wb-msgs">
                {!active ? (
                  <p className="sub">Model ready — send a message to start the thread. <button className="link" onClick={() => setModel("")}>change model</button></p>
                ) : msgs === undefined ? (
                  <p className="muted mono">…</p>
                ) : msgs.length === 0 ? (
                  <p className="sub">Empty thread — say something.</p>
                ) : (
                  msgs.map((m) => (
                    <div key={m._id} className={`msg ${m.role}`}>
                      <span className="who mono muted">{m.role}</span>
                      <div>{m.content}</div>
                    </div>
                  ))
                )}
                {busy && <div className="msg assistant"><span className="who mono muted">assistant</span><div className="wb-typing"><i /><i /><i /></div></div>}
              </div>
              <div className="wb-composer">
                <textarea rows={2} placeholder="message  (⌘/Ctrl+Enter to send)" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }} />
                <button className="btn accent" disabled={busy || !input.trim()} onClick={() => void send()}>{busy ? "…" : "Send"}</button>
              </div>
              {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
