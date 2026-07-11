"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/features/workspaces";
import { PROVIDER_LABEL, ErrorLine, type Cred, type Catalog } from "./shared";
import { splitModel, route, ModelInspector, ModelPicker, type AgentPickMeta } from "./chat-model-picker";
import { AgentMentionPicker, type MentionAgent } from "./agent-mention";
import { SkillMentionPicker } from "./skill-mention";

type Msg = { _id: string; role: string; content: string; imageUrls?: string[] };
type Thread = { _id: string; title: string; model: string; agentId?: string; agentName?: string };
type AgentLite = { _id: string; name: string; model: string; tools: string[] };

// typed at the very end of the message — the common Discord/Slack-style pattern. Not
// cursor-position-aware (a mention anywhere but the end won't trigger) — a deliberate scope cut.
const MENTION_RE = /@(\w*)$/;
// same caret-end pattern for "/skill" — mutually exclusive with @ (the trailing trigger char is one
// or the other, never both). Picking a skill prepends its instructions to the next message (client-
// only, no backend): the text rides through the unchanged sendMessage path into the system prompt.
const SKILL_RE = /\/(\w*)$/;

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
  const [model, setModel] = useState(""); // model chosen for a NEW (not-yet-created) thread
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null); // agent chosen for a NEW thread (wins over `model`)
  const [input, setInput] = useState("");
  const [pendingSkillIds, setPendingSkillIds] = useState<string[]>([]); // skills armed for the NEXT send (client-only)
  const [pendingImages, setPendingImages] = useState<{ id: string; preview: string }[]>([]); // images attached to the NEXT send
  const [useRag, setUseRag] = useState(false); // retrieve from my Knowledge docs for each message
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rebinding, setRebinding] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [showInsp, setShowInsp] = useState(false);
  const msgs = useQuery(api.threads.threadMessages, active ? { threadId: active as any } : "skip") as Msg[] | undefined;

  // a prompt handed over from the AI dock / mobile compose sheet — drop it into the composer once,
  // then tell the parent to clear it so it doesn't re-apply on every render.
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
  const currentModel = activeThread?.model ?? pendingAgent?.model ?? (model || null); // model in the header/composer context
  const currentAgentName = activeThread?.agentName ?? pendingAgent?.name;
  const currentProvider = currentModel ? splitModel(currentModel)[0] : null;
  const r = route(providers?.find((p) => p.provider === currentProvider)?.kind);
  const mentionMatch = input.match(MENTION_RE);
  const skillMatch = input.match(SKILL_RE);

  function newChat() { setActive(null); setModel(""); setPendingAgentId(null); setInput(""); setErr(null); setShowInsp(false); }

  async function pickMention(agentId: string) {
    if (rebinding) return; // a rebind is already in flight — a second pick here would race it
    setInput((v) => v.replace(MENTION_RE, ""));
    if (active) {
      setRebinding(true);
      try { await rebindThreadAgent({ threadId: active as any, agentId: agentId as any }); }
      catch (e) { setErr(e); }
      finally { setRebinding(false); }
    } else {
      setPendingAgentId(agentId);
      setModel("");
    }
  }

  function pickSkill(id: string) {
    setInput((v) => v.replace(SKILL_RE, ""));
    setPendingSkillIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  // upload each picked image straight to Convex storage (one-shot URL → POST bytes → storageId),
  // holding a local object-URL for the preview. The storageIds ride along with the next send.
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
      } catch (err) { setErr(err); }
    }
  }

  async function send() {
    if ((!input.trim() && pendingImages.length === 0) || busy || rebinding) return;
    setErr(null);
    setBusy(true);
    try {
      let tid = active;
      if (!tid) {
        if (pendingAgentId) tid = (await createThread({ agentId: pendingAgentId as any, title: input.slice(0, 60) })) as string;
        else if (model) tid = (await createThread({ model, title: input.slice(0, 60) })) as string;
        else { setErr("pick a model or agent first"); return; }
        setActive(tid);
      }
      // built AFTER createThread so the skill preamble never leaks into the thread title (raw input above)
      const preamble = pendingSkillIds.map((id) => skillDefs?.find((s) => s.id === id)?.instructions).filter(Boolean).join("\n\n");
      const content = preamble ? `${preamble}\n\n${input}` : input;
      const imageIds = pendingImages.map((i) => i.id);
      setInput("");
      setPendingSkillIds([]);
      setPendingImages([]);
      await sendMessage({ threadId: tid as any, content, workspaceId: (workspaceId ?? undefined) as any, imageIds: imageIds.length ? (imageIds as any) : undefined, useRag: useRag || undefined });
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
          <p className="sub" style={{ margin: 0 }}>Threaded, persisted conversations. Token savers + agent mode apply — @mention a saved agent to hand a thread its tools and instructions.</p>
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
                    <span className="t-model mono muted">
                      {t.agentName && <span className="badge" style={{ marginRight: ".3rem" }}>{t.agentName}</span>}
                      {PROVIDER_LABEL[tp] ?? tp} · <span className={`t-route ${tr.cls}`}>{tr.label.toLowerCase()}</span>
                    </span>
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
                {currentAgentName && <span className="badge">{currentAgentName}</span>}
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

          {!active && !model && !pendingAgentId ? (
            <ModelPicker
              byProvider={byProvider}
              providers={providers}
              catalog={catalog}
              agents={agentPicks}
              onPick={(pick) => {
                setErr(null);
                if (pick.kind === "agent") { setPendingAgentId(pick.agentId); setModel(""); }
                else { setModel(pick.ref); setPendingAgentId(null); }
              }}
            />
          ) : (
            <>
              <div className="wb-msgs">
                {!active ? (
                  <p className="sub">{pendingAgent ? `${pendingAgent.name} ready` : "Model ready"} — send a message to start the thread. <button className="link" onClick={() => { setModel(""); setPendingAgentId(null); }}>change</button></p>
                ) : msgs === undefined ? (
                  <p className="muted mono">…</p>
                ) : msgs.length === 0 ? (
                  <p className="sub">Empty thread — say something.</p>
                ) : (
                  msgs.map((m) => (
                    <div key={m._id} className={`msg ${m.role}`}>
                      <span className="who mono muted">{m.role}</span>
                      <div>
                        {m.imageUrls?.length ? <div className="msg-imgs">{m.imageUrls.map((u, i) => <img key={i} src={u} alt="attached" className="msg-img" />)}</div> : null}
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {busy && <div className="msg assistant"><span className="who mono muted">assistant</span><div className="wb-typing"><i /><i /><i /></div></div>}
              </div>
              {pendingSkillIds.length > 0 && (
                <div className="wb-skill-chips" style={{ display: "flex", gap: ".3rem", flexWrap: "wrap", marginBottom: ".4rem" }}>
                  {pendingSkillIds.map((id) => {
                    const s = skillDefs?.find((x) => x.id === id);
                    return <button key={id} type="button" className="badge" onClick={() => setPendingSkillIds((ids) => ids.filter((x) => x !== id))}>/{s?.label ?? id} ×</button>;
                  })}
                </div>
              )}
              {pendingImages.length > 0 && (
                <div className="wb-img-chips">
                  {pendingImages.map((img, i) => (
                    <span key={img.id} className="wb-img-chip">
                      <img src={img.preview} alt="" />
                      <button type="button" onClick={() => setPendingImages((imgs) => imgs.filter((_, j) => j !== i))} aria-label="remove image">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="wb-composer" style={{ position: "relative" }}>
                {mentionMatch && mentionAgents.length > 0 && (
                  <AgentMentionPicker agents={mentionAgents} query={mentionMatch[1]} onPick={(id) => void pickMention(id)} />
                )}
                {skillMatch && (skillDefs?.length ?? 0) > 0 && (
                  <SkillMentionPicker skills={skillDefs!} query={skillMatch[1]} onPick={pickSkill} />
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e)} />
                <button type="button" className="wb-attach" title="Attach image (vision models)" aria-label="Attach image" onClick={() => fileRef.current?.click()}>📎</button>
                <button type="button" className={`wb-attach ${useRag ? "on" : ""}`} title="Use my Knowledge documents (RAG)" aria-pressed={useRag} onClick={() => setUseRag((v) => !v)}>📚</button>
                <textarea rows={2} placeholder="message  ·  @ agent  ·  / skill  ·  📎 image  ·  (⌘/Ctrl+Enter to send)" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }} />
                <button className="btn accent" disabled={busy || rebinding || (!input.trim() && pendingImages.length === 0)} onClick={() => void send()}>{busy ? "…" : rebinding ? "switching…" : "Send"}</button>
              </div>
              {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
