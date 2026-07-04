"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { type Cred, type Catalog } from "./_components/shared";
import { Overview } from "./_components/overview";
import { UsageCard } from "./_components/usage";
import { TokenSaverCard } from "./_components/settings";
import { McpCard } from "./_components/mcp";
import { AdminCard } from "./_components/admin";
import { ConnectProviders, ConnectedCreds } from "@/features/byok";
import { AgentsCard } from "./_components/agents-card";
import { WorkbenchCard } from "./_components/workbench";
import { WorkspaceProvider, WorkspaceSwitcher, MembersCard, useWorkspace } from "@/features/workspaces";
import { ApiKeysCard } from "@/features/api-compat";
import { MemoryPanel } from "@/features/memory";
import { ComboBuilderCard } from "@/features/combos";
import { McpServersCard } from "@/features/mcp-client";
import { ChannelsCard } from "@/features/channels";

export default function AppPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  return (
    <main className="app-main">
      <div className="app-top">
        <Link href="/" className="brand">models<b>.</b></Link>
        <TopRight authed={isAuthenticated} />
      </div>
      {isLoading ? <p className="muted mono">loading…</p> : isAuthenticated ? <WorkspaceProvider><Dashboard /></WorkspaceProvider> : <SignIn />}
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

function Dashboard() {
  const me = useQuery(api.admin.me);
  const { workspaceId } = useWorkspace();
  const providers = useQuery(api.credentials.listConfiguredProviders) as Cred[] | undefined;
  const setCredential = useAction(api.credentials.setCredential);
  const deleteCredential = useMutation(api.credentials.deleteCredential);
  const testCredential = useAction(api.chat.testCredential);
  const isAdmin = !!me?.isSuperAdmin;
  const codexModelList = useAction(api.oauth.codexModelList);
  const claudeModelList = useAction(api.oauth.claudeModelList);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [codexModels, setCodexModels] = useState<string[]>([]);
  const [claudeModels, setClaudeModels] = useState<string[]>([]);
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

  const nav = [
    { id: "overview", label: "Overview" },
    { id: "chat", label: "Chat" },
    { id: "agents", label: "Agents" },
    { id: "providers", label: "Providers" },
    { id: "usage", label: "Usage" },
    { id: "settings", label: "Settings" },
    { id: "memory", label: "Memory" },
    { id: "members", label: "Members" },
    { id: "mcp", label: "MCP" },
    { id: "mcp-servers", label: "MCP Servers" },
    { id: "api", label: "API" },
    { id: "combos", label: "Combos" },
    { id: "channels", label: "Channels" },
    ...(me?.isSuperAdmin ? [{ id: "admin", label: "Admin" }] : []),
  ];

  return (
    <div className="app-body">
      <nav className="side">
        <WorkspaceSwitcher />
        {nav.map((s) => (
          <button key={s.id} className={`side-link ${section === s.id ? "on" : ""}`} onClick={() => setSection(s.id)}>{s.label}</button>
        ))}
      </nav>

      <div className="app-content">
        {banner && <div className="banner">{banner}</div>}

        {section === "overview" && (
          <>
            <Overview providers={providers} models={myModels} go={setSection} />
            <UsageCard catalog={catalog} />
          </>
        )}

        {section === "chat" && <WorkbenchCard models={myModels} providers={providers} catalog={catalog} isAdmin={isAdmin} />}

        {section === "agents" && <AgentsCard models={myModels} isAdmin={isAdmin} />}

        {section === "providers" && (
          <>
            <ConnectProviders catalog={catalog} isAdmin={isAdmin} setCredential={setCredential} testCredential={testCredential} onBanner={setBanner} />

            <section className="card">
              <h2>Connected</h2>
              <p className="sub">Health is checked once when you connect a key — hit <b>test</b> anytime to re-verify (e.g. after rotating a key).</p>
              {providers === undefined ? (
                <p className="muted mono">…</p>
              ) : providers.length === 0 ? (
                <p className="muted">Nothing yet — connect a provider or add a key above.</p>
              ) : (
                <ConnectedCreds providers={providers} catalog={catalog} isAdmin={isAdmin} deleteCredential={deleteCredential} testCredential={testCredential} />
              )}
            </section>
          </>
        )}

        {section === "usage" && <UsageCard catalog={catalog} />}

        {section === "settings" && <TokenSaverCard />}

        {section === "memory" && <MemoryPanel workspaceId={workspaceId ?? undefined} />}

        {section === "members" && <MembersCard />}

        {section === "mcp" && <McpCard />}

        {section === "api" && <ApiKeysCard />}

        {section === "combos" && <ComboBuilderCard />}

        {section === "mcp-servers" && <McpServersCard />}

        {section === "channels" && <ChannelsCard />}

        {section === "admin" && me?.isSuperAdmin && <AdminCard />}
      </div>
    </div>
  );
}
