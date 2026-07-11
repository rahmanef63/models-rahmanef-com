"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { PROVIDER_LABEL, ErrorLine, type Cred, type Catalog } from "./shared";
import { splitModel, route, ModelInspector, ModelPicker, type AgentPickMeta } from "./chat-model-picker";
import { type MentionAgent } from "./agent-mention";
import { WbComposer } from "./wb-composer";

type Msg = { _id: string; role: string; content: string; imageUrls?: string[] };
type Thread = { _id: string; title: string; model: string; agentId?: string; agentName?: string };
type AgentLite = { _id: string; name: string; model: string; tools: string[] };

const MENTION_RE = /@(\w*)$/;
const SKILL_RE = /\/(\w*)$/;

// Full-bleed two-pane chat workspace: thread list left, conversation right (rr: workspace surfaces
// render h-dvh, no marketing chrome). Mobile shows one pane at a time (list ↔ chat via a back arrow).
export function WorkbenchCard({ models, providers, catalog, isAdmin, prefill, onPrefillConsumed }: { models: string[]; providers: Cred[] | undefined; catalog: Catalog; isAdmin: boolean; prefill?: string; onPrefillConsumed?: () => void }) {
  const threads = useQuery(api.threads.listThreads) as Thread[] | undefined;
  const agentDefs = useQuery(api.agentDefs.list) as AgentLite[] | undefined;
  const skillDefs = useQuery(api.agentDefs.listSkillsRegistry) as { id: string; label: string; description: string; instructions: string }[] | undefined;
  const createThread = useMutation(api.threads.createThread);
  const deleteThread = useMutation(api.threads.deleteThread);
  const rebindThreadAgent = useMutation(api.threads.rebindThreadAgent);
  const sendMessage = useAction(api.threads.sendMessage);
  const generateUploadUrl = useMutation(api.threads.generateUploadUrl);
  const { workspaceId } = useWorkspace();
  const [active, setActive] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingSkillIds, setPendingSkillIds] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<{ id: string; preview: string }[]>([]);
  const [useRag, setUseRag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rebinding, setRebinding] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [showInsp, setShowInsp] = useState(false);
  const msgs = useQuery(api.threads.threadMessages, active ? { threadId: active as any } : "skip") as Msg[] | undefined;

  useEffect(() => { if (prefill) { setInput(prefill); onPrefillConsumed?.(); } }, [prefill]);

  const byProvider = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const m of models) { const [p, id] = splitModel(m); if (p && id) (g[p] ??= []).push(id); }
    return g;
  }, [models]);

  const agentPicks: AgentPickMeta[] = (agentDefs ?? []).map((a) => ({ id: a._id, name: a.name, model: a.model, toolCount: a.tools.length }));
  const mentionAgents: MentionAgent[] = (agentDefs ?? []).map((a) => ({ id: a._id, name: a.name, model: a.model }));

  const activeThread = threads?.find((t) => t._id === active);
  const pendingAgent = pendingAgentId ? agentDefs?.find((a) => a._id === pendingAgentId) : undefined;
  const currentModel = activeThread?.model ?? pendingAgent?.model ?? (model || null);
  const currentAgentName = activeThread?.agentName ?? pendingAgent?.name;
  const currentProvider = currentModel ? splitModel(currentModel)[0] : null;
  const r = route(providers?.find((p) => p.provider === currentProvider)?.kind);
  const inChat = !!(active || model || pendingAgentId);

  function newChat() { setActive(null); setModel(""); setPendingAgentId(null); setInput(""); setErr(null); setShowInsp(false); }

  async function pickMention(agentId: string) {
    if (rebinding) return;
    setInput((v) => v.replace(MENTION_RE, ""));
    if (active) {
      setRebinding(true);
      try { await rebindThreadAgent({ threadId: active as any, agentId: agentId as any }); } catch (e) { setErr(e); } finally { setRebinding(false); }
    } else { setPendingAgentId(agentId); setModel(""); }
  }
  function pickSkill(id: string) {
    setInput((v) => v.replace(SKILL_RE, ""));
    setPendingSkillIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    for (const file of files) {
      try {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error(`upload failed (${res.status})`);
        const { storageId } = await res.json();
        setPendingImages((imgs) => [...imgs, { id: storageId, preview: URL.createObjectURL(file) }]);
      } catch (e2) { setErr(e2); }
    }
  }

  async function send() {
    if ((!input.trim() && pendingImages.length === 0) || busy || rebinding) return;
    setErr(null); setBusy(true);
    try {
      let tid = active;
      if (!tid) {
        if (pendingAgentId) tid = (await createThread({ agentId: pendingAgentId as any, title: input.slice(0, 60) })) as string;
        else if (model) tid = (await createThread({ model, title: input.slice(0, 60) })) as string;
        else { setErr("pick a model or agent first"); return; }
        setActive(tid);
      }
      const preamble = pendingSkillIds.map((id) => skillDefs?.find((s) => s.id === id)?.instructions).filter(Boolean).join("\n\n");
      const content = preamble ? `${preamble}\n\n${input}` : input;
      const imageIds = pendingImages.map((i) => i.id);
      setInput(""); setPendingSkillIds([]); setPendingImages([]);
      await sendMessage({ threadId: tid as any, content, workspaceId: (workspaceId ?? undefined) as any, imageIds: imageIds.length ? (imageIds as any) : undefined, useRag: useRag || undefined });
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <div className="wb-shell" data-view={inChat ? "chat" : "list"}>
      <aside className="wb-threads">
        <div className="wb-threads-head">
          <strong>Chats</strong>
          <button className="btn wb-send" onClick={newChat} title="New chat"><Plus size={15} /> New</button>
        </div>
        <ul>
          {threads === undefined ? <li className="empty muted mono">…</li> : threads.length === 0 ? <li className="empty muted mono">no chats yet</li> : null}
          {(threads ?? []).map((t) => {
            const [tp] = splitModel(t.model);
            const tr = route(providers?.find((p) => p.provider === tp)?.kind);
            return (
              <li key={t._id} className={active === t._id ? "on" : ""}>
                <button className="thread-btn" onClick={() => { setActive(t._id); setShowInsp(false); setErr(null); }}>
                  <span className="t-title">{t.title}</span>
                  <span className="t-model mono muted">
                    {t.agentName && <span className="badge" style={{ marginRight: ".3rem" }}>{t.agentName}</span>}
                    {PROVIDER_LABEL[tp] ?? tp} · <span className={`t-route ${tr.cls}`}>{tr.label.toLowerCase()}</span>
                  </span>
                </button>
                <button className="link del" title="delete chat" aria-label="delete chat" onClick={() => { if (active === t._id) newChat(); void deleteThread({ threadId: t._id as any }); }}><Trash2 size={14} /></button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="wb-main">
        <div className="wb-modelbar">
          <button className="link wb-back" onClick={newChat} aria-label="Back to chats"><ChevronLeft size={18} /></button>
          {currentModel && currentProvider ? (
            <>
              <div className="wb-mb-id">
                {currentAgentName && <span className="badge">{currentAgentName}</span>}
                <span className="wb-mb-prov">{PROVIDER_LABEL[currentProvider] ?? currentProvider}</span>
                <span className="wb-mb-model mono">{splitModel(currentModel)[1]}</span>
              </div>
              <span className={`badge ${r.cls}`}>{r.label}</span>
              <button className="link" aria-expanded={showInsp} onClick={() => setShowInsp((v) => !v)}>{showInsp ? "hide" : "details"}</button>
            </>
          ) : <span className="wb-mb-id mono muted">New chat — pick a model</span>}
        </div>

        {currentModel && showInsp && <div className="wb-body" style={{ flex: "none" }}><ModelInspector catalog={catalog} model={currentModel} /></div>}

        {!inChat ? (
          <div className="wb-body">
            <ModelPicker byProvider={byProvider} providers={providers} catalog={catalog} agents={agentPicks}
              onPick={(pick) => { setErr(null); if (pick.kind === "agent") { setPendingAgentId(pick.agentId); setModel(""); } else { setModel(pick.ref); setPendingAgentId(null); } }} />
          </div>
        ) : (
          <>
            <div className="wb-msgs">
              {!active ? (
                <p className="sub">{pendingAgent ? `${pendingAgent.name} ready` : "Model ready"} — send a message to start the chat.</p>
              ) : msgs === undefined ? (
                <p className="muted mono">…</p>
              ) : msgs.length === 0 ? (
                <p className="sub">Empty chat — say something.</p>
              ) : (
                msgs.map((m) => (
                  <div key={m._id} className={`msg ${m.role}`}>
                    <div className="msg-bubble">
                      {m.imageUrls?.length ? <div className="msg-imgs">{m.imageUrls.map((u, i) => <img key={i} src={u} alt="attached" className="msg-img" />)}</div> : null}
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {busy && <div className="msg assistant"><div className="msg-bubble"><div className="wb-typing"><i /><i /><i /></div></div></div>}
            </div>
            <WbComposer input={input} setInput={setInput} onSend={send} busy={busy} rebinding={rebinding} fileRef={fileRef} onFiles={onFiles}
              useRag={useRag} setUseRag={setUseRag} pendingSkillIds={pendingSkillIds} setPendingSkillIds={setPendingSkillIds} skillDefs={skillDefs}
              pendingImages={pendingImages} setPendingImages={setPendingImages} mentionAgents={mentionAgents} onPickMention={(id) => void pickMention(id)} onPickSkill={pickSkill} />
            {err != null && <div style={{ padding: "0 clamp(0.85rem, 3vw, 1.4rem) 0.7rem" }}><ErrorLine e={err} isAdmin={isAdmin} /></div>}
          </>
        )}
      </div>
    </div>
  );
}
