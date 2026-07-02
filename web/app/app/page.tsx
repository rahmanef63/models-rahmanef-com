"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "OpenAI · ChatGPT / Codex",
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
  const chat = useAction(api.chat.chat);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [codexModels, setCodexModels] = useState<string[]>([]);
  const [codexFlow, setCodexFlow] = useState<{ url: string; code: string } | null>(null);
  const [banner, setBanner] = useState("");

  useEffect(() => {
    fetch("https://models.dev/api.json").then((r) => r.json()).then(setCatalog).catch(() => {});
    const q = new URLSearchParams(window.location.search).get("connect");
    if (q === "openrouter") setBanner("✓ OpenRouter connected");
    else if (q === "error") setBanner("⚠ connect failed — try again");
    if (q) window.history.replaceState({}, "", "/app");
  }, []);

  const hasCodex = !!providers?.some((p) => p.provider === "openai-codex");
  useEffect(() => {
    if (hasCodex) codexModelList().then(setCodexModels).catch(() => {});
    else setCodexModels([]);
  }, [hasCodex]);

  const myModels = useMemo(() => {
    const mine = new Set((providers ?? []).map((p) => p.provider));
    const out: string[] = [...codexModels];
    for (const [pid, p] of Object.entries(catalog)) {
      if (!mine.has(pid)) continue;
      for (const mid of Object.keys(p.models ?? {})) out.push(`${pid}/${mid}`);
    }
    return out.sort();
  }, [catalog, providers, codexModels]);

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

  return (
    <>
      {banner && <div className="banner">{banner}</div>}

      <Overview providers={providers} />

      <section className="card">
        <h2>Connect a provider</h2>
        <p className="sub">{SUPPORTED} providers supported — sign in over OAuth, or paste a key. Each connection is yours only.</p>
        <div className="connect-grid">
          <button className="provider-btn" onClick={connectCodex} disabled={!!codexFlow}>
            <strong>Sign in with OpenAI</strong>
            <span>ChatGPT / Codex · oauth</span>
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

      <ChatCard models={myModels} chat={chat} />

      <UsageCard />

      {me?.isSuperAdmin && <AdminCard />}
    </>
  );
}

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
const SUPPORTED = 23; // openai, anthropic, google, openrouter + 18 openai-compatible + openai-codex (oauth)

function Overview({ providers }: { providers: Cred[] | undefined }) {
  const u = useQuery(api.usage.myUsage);
  const tiles = [
    { n: providers === undefined ? "—" : String(providers.length), l: "connected" },
    { n: u ? fmt(u.requests) : "—", l: "requests" },
    { n: u ? fmt(u.totalTokens) : "—", l: "tokens" },
    { n: String(SUPPORTED), l: "providers" },
  ];
  return (
    <section className="overview">
      {tiles.map((t) => (
        <div className="ov-tile" key={t.l}>
          <div className="ov-num">{t.n}</div>
          <div className="ov-lbl">{t.l}</div>
        </div>
      ))}
    </section>
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

function AdminCard() {
  const stats = useQuery(api.admin.adminStats);
  const users = useQuery(api.admin.adminUsers);
  return (
    <section className="card">
      <h2>Admin <span className="badge oauth">SUPER</span></h2>
      <p className="sub">Operator view — identities and counts only, never any key.</p>
      {stats === undefined ? (
        <p className="muted mono">…</p>
      ) : (
        <div className="row" style={{ gap: "2.25rem" }}>
          <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{stats.users}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>users</div></div>
          <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{stats.connections}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>connections</div></div>
          <div><div className="mono accent" style={{ fontSize: "1.6rem" }}>{stats.oauth}</div><div className="muted mono" style={{ fontSize: ".75rem" }}>via oauth</div></div>
        </div>
      )}
      {users === undefined ? null : (
        <ul className="creds" style={{ marginTop: "1.25rem" }}>
          {users.map((u) => (
            <li key={u.id}>
              <span className="name mono" style={{ fontSize: ".85rem" }}>{u.email || u.name || "user·" + u.id.slice(-6)}</span>
              <span className="mono muted" style={{ fontSize: ".72rem" }}>{new Date(u.createdAt).toISOString().slice(0, 10)}</span>
              <span className="badge">{u.providers} {u.providers === 1 ? "provider" : "providers"}</span>
            </li>
          ))}
        </ul>
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
    <details className="apikey">
      <summary>…or paste an API key</summary>
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
    </details>
  );
}

function ChatCard({ models, chat }: { models: string[]; chat: (a: { model: string; messages: { role: string; content: string }[] }) => Promise<{ text: string }> }) {
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="card">
      <h2>Try a model</h2>
      <p className="sub">{models.length ? `${models.length} models available` : "connect a provider to see models"}</p>
      <div className="row">
        <input list="mymodels" placeholder="provider/model" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="mymodels">{models.map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <textarea rows={2} placeholder="say hi" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button
        className="btn accent"
        disabled={!model || !prompt || busy}
        onClick={async () => {
          setBusy(true);
          setOut("…");
          try { setOut((await chat({ model, messages: [{ role: "user", content: prompt }] })).text); }
          catch (e) { setOut("error: " + (e instanceof Error ? e.message : String(e))); }
          finally { setBusy(false); }
        }}
      >
        {busy ? "…" : "Send"}
      </button>
      {out && <pre>{out}</pre>}
    </section>
  );
}
