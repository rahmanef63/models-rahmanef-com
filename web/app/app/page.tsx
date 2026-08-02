"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { type Cred, type Catalog } from "./_components/shared";
import { Overview } from "./_components/overview";
import { UsageCard } from "./_components/usage";
import { TokenSaverCard } from "./_components/settings";
import { McpCard } from "./_components/mcp";
import { EmbedCard } from "./_components/embed";
import { AdminCard } from "./_components/admin";
import { AdminAnalyticsCard } from "./_components/admin-analytics";
import { AdminTrafficCard } from "./_components/admin-traffic";
import { AdminSeedCard } from "./_components/admin-seed";
import { ConnectProviders, ConnectedCreds } from "@/features/byok";
import { AgentsCard } from "./_components/agents-card";
import { WorkbenchCard } from "./_components/workbench";
import { WorkspaceProvider, WorkspaceSwitcher, MembersCard, useWorkspace } from "@/features/workspaces";
import { ApiKeysCard } from "@/features/api-compat";
import { MemoryPanel, MemoryVault, NoteTree } from "@/features/memory";
import { KnowledgeCard } from "./_components/knowledge";
import { ComboBuilderCard } from "@/features/combos";
import { McpServersCard } from "@/features/mcp-client";
import { ChannelsCard } from "@/features/channels";
import { SchedulesCard } from "@/features/scheduled-agents";
import { WorkspaceUsageCard } from "@/features/usage-rollups";
import { AuditLogCard } from "@/features/audit-log";
import { SpendCapCard } from "@/features/spend-caps";
import { MemoryGraphPanel } from "@/features/memory-graph";
import { SignIn } from "./_components/sign-in";
import { DashboardShell } from "./_components/dashboard-shell";
import { AiDock, AiComposer } from "./_components/ai-dock";
import { ResponsiveDialog } from "./_components/responsive-dialog";
import { SectionErrorBoundary } from "./_components/error-boundary";
import { groupsFor } from "./_components/nav-config";
import { useTheme } from "./_components/use-theme";

export default function AppPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) return <main className="app-main"><p className="muted mono">loading…</p></main>;
  if (!isAuthenticated)
    return (
      <main className="app-main">
        <div className="app-top">
          <Link href="/" className="brand">models<b>.</b></Link>
          <span className="mono muted" style={{ fontSize: "0.8rem" }}>bring your own key</span>
        </div>
        <SignIn />
      </main>
    );
  return (
    <WorkspaceProvider>
      <Dashboard />
    </WorkspaceProvider>
  );
}

function Dashboard() {
  const me = useQuery(api.admin.me);
  const { signOut } = useAuthActions();
  const { workspaceId } = useWorkspace();
  const [theme, toggleTheme] = useTheme();
  const providers = useQuery(api.credentials.listConfiguredProviders) as Cred[] | undefined;
  const setCredential = useAction(api.credentials.setCredential);
  const deleteCredential = useMutation(api.credentials.deleteCredential);
  const testCredential = useAction(api.chat.testCredential);
  const isAdmin = !!me?.isSuperAdmin;
  const codexModelList = useAction(api.oauth.codexModelList);
  const claudeModelList = useAction(api.oauth.claudeModelList);
  const copilotModelList = useAction(api.oauthCopilot.copilotModelList);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [codexModels, setCodexModels] = useState<string[]>([]);
  const [claudeModels, setClaudeModels] = useState<string[]>([]);
  const [copilotModels, setCopilotModels] = useState<string[]>([]);
  const [banner, setBanner] = useState("");
  const [section, setSection] = useState("overview");
  const [noteId, setNoteId] = useState<string | null>(null); // selected vault note (or "new")
  const [chatPrefill, setChatPrefill] = useState(""); // prompt handed from the AI composer to the Workbench
  const [composeOpen, setComposeOpen] = useState(false); // mobile FAB compose sheet

  // URL-backed navigation: Back/forward + refresh + shareable links, no router refactor.
  const go = useCallback((s: string) => {
    setSection(s);
    if (typeof window !== "undefined") window.history.pushState({ s }, "", "?s=" + s);
  }, []);
  const startChat = useCallback((text: string) => { setChatPrefill(text); go("chat"); }, [go]);

  useEffect(() => {
    fetch("https://models.dev/api.json").then((r) => r.json()).then(setCatalog).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const q = params.get("connect");
    // after an OAuth return, LAND on Providers (where you verify the key) instead of dumping on Overview
    if (q === "openrouter") { setBanner("✓ OpenRouter connected"); setSection("providers"); window.history.replaceState({ s: "providers" }, "", "?s=providers"); }
    else if (q === "error") { setBanner("⚠ connect failed — try again"); window.history.replaceState({ s: "overview" }, "", "/app"); }
    else { const s = params.get("s"); if (s) setSection(s); } // restore the section on refresh / deep link
    const onPop = () => setSection(new URLSearchParams(window.location.search).get("s") || "overview"); // Back/forward
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const hasCodex = !!providers?.some((p) => p.provider === "openai-codex");
  const hasClaude = !!providers?.some((p) => p.provider === "anthropic-oauth");
  const hasCopilot = !!providers?.some((p) => p.provider === "github-copilot");
  useEffect(() => {
    if (hasCodex) codexModelList().then(setCodexModels).catch(() => {});
    else setCodexModels([]);
  }, [hasCodex]);
  useEffect(() => {
    if (hasClaude) claudeModelList().then(setClaudeModels).catch(() => {});
    else setClaudeModels([]);
  }, [hasClaude]);
  useEffect(() => {
    if (hasCopilot) copilotModelList().then(setCopilotModels).catch(() => {});
    else setCopilotModels([]);
  }, [hasCopilot]);

  const myModels = useMemo(() => {
    const mine = new Set((providers ?? []).map((p) => p.provider));
    const out: string[] = [...codexModels, ...claudeModels, ...copilotModels];
    for (const [pid, p] of Object.entries(catalog)) {
      if (!mine.has(pid)) continue;
      for (const mid of Object.keys(p.models ?? {})) out.push(`${pid}/${mid}`);
    }
    // manually-saved custom-provider models (no models.dev catalog) — makes them selectable in chat
    for (const p of providers ?? []) for (const mid of p.models ?? []) out.push(`${p.provider}/${mid}`);
    return [...new Set(out)].sort();
  }, [catalog, providers, codexModels, claudeModels, copilotModels]);

  return (
    <DashboardShell
      groups={groupsFor(isAdmin)}
      section={section}
      go={go}
      isAdmin={isAdmin}
      account={{ email: me?.email ?? undefined, isSuperAdmin: me?.isSuperAdmin, onSignOut: () => void signOut() }}
      theme={theme}
      toggleTheme={toggleTheme}
      workspaceSwitcher={<WorkspaceSwitcher />}
      aiDock={section === "overview" ? <AiDock modelCount={providers === undefined ? undefined : myModels.length} onCompose={startChat} openWorkbench={() => go("chat")} /> : undefined}
      onCompose={() => setComposeOpen(true)}
      bleed={section === "graph" || section === "chat"}
      secondaryPanel={section === "notes" ? <NoteTree selectedId={noteId} onOpen={setNoteId} onNew={() => setNoteId("new")} /> : undefined}
    >
      {banner && <div className="banner">{banner}</div>}
      <ResponsiveDialog open={composeOpen} onClose={() => setComposeOpen(false)} title="AI Assistant">
        <AiComposer autoFocus modelCount={providers === undefined ? undefined : myModels.length} onSubmit={(t) => { startChat(t); setComposeOpen(false); }} />
      </ResponsiveDialog>

      <SectionErrorBoundary section={section}>
      {section === "overview" && (
        <>
          <Overview providers={providers} models={myModels} go={go} />
          <UsageCard />
        </>
      )}
      {section === "chat" && <WorkbenchCard models={myModels} providers={providers} catalog={catalog} isAdmin={isAdmin} prefill={chatPrefill} onPrefillConsumed={() => setChatPrefill("")} />}
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
      {section === "usage" && <UsageCard />}
      {section === "settings" && <TokenSaverCard />}
      {section === "graph" && <MemoryGraphPanel />}
      {section === "notes" && <MemoryVault noteId={noteId} onOpen={setNoteId} onClosed={() => setNoteId(null)} />}
      {section === "memory" && <MemoryPanel workspaceId={workspaceId ?? undefined} />}
      {section === "knowledge" && <KnowledgeCard />}
      {section === "members" && <MembersCard />}
      {section === "mcp" && <McpCard />}
      {section === "embed" && <EmbedCard models={myModels} />}
      {section === "api" && <ApiKeysCard />}
      {section === "combos" && <ComboBuilderCard />}
      {section === "mcp-servers" && <McpServersCard />}
      {section === "channels" && <ChannelsCard />}
      {section === "schedules" && <SchedulesCard />}
      {section === "workspace-usage" && <WorkspaceUsageCard />}
      {section === "budget" && <SpendCapCard />}
      {section === "audit" && <AuditLogCard />}
      {section === "admin" && me?.isSuperAdmin && <AdminCard />}
      {section === "analytics" && me?.isSuperAdmin && <AdminAnalyticsCard />}
      {section === "traffic" && me?.isSuperAdmin && <AdminTrafficCard />}
      {section === "seed" && me?.isSuperAdmin && <AdminSeedCard />}
      </SectionErrorBoundary>
    </DashboardShell>
  );
}
