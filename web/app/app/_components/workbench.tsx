"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PROVIDER_LABEL, ErrorLine, type Cred, type Catalog } from "./shared";
import { splitModel, route, ModelInspector, ModelPicker } from "./chat-model-picker";

type Msg = { _id: string; role: string; content: string };
type Thread = { _id: string; title: string; model: string };

export function WorkbenchCard({ models, providers, catalog, isAdmin }: { models: string[]; providers: Cred[] | undefined; catalog: Catalog; isAdmin: boolean }) {
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
