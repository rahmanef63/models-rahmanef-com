"use client";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ErrorLine } from "./shared";
import { AgentForm, type AgentDef, type AgentPatch, type AgentPrefill, type SkillMeta, type ToolMeta } from "./agent-form";
import { ImportMenu } from "./agent-import";
import { exportAgentFile } from "./agent-io";

type Run = { _id: string; task: string; model: string; agentId?: string; agentName?: string; status: string; steps?: { text: string; tools: string[] }[]; result?: string; error?: string; errorCode?: string; at?: number; finishedAt?: number };

export function AgentsCard({ models, isAdmin }: { models: string[]; isAdmin: boolean }) {
  const runAgent = useAction(api.chat.runAgent);
  const runs = useQuery(api.agents.myRuns) as Run[] | undefined;
  const agentDefs = useQuery(api.agentDefs.list) as AgentDef[] | undefined;
  const toolRegistry = useQuery(api.agentDefs.listToolRegistry) as ToolMeta[] | undefined;
  const skillRegistry = useQuery(api.agentDefs.listSkillsRegistry) as SkillMeta[] | undefined;
  const createAgent = useMutation(api.agentDefs.create);
  const updateAgent = useMutation(api.agentDefs.update);
  const removeAgent = useMutation(api.agentDefs.remove);

  const [showForm, setShowForm] = useState<"new" | string | null>(null); // "new", or an agent _id being edited
  const [importPrefill, setImportPrefill] = useState<AgentPrefill | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [model, setModel] = useState("");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const selectedAgent = agentDefs?.find((a) => a._id === selectedAgentId);

  function closeForm() {
    setShowForm(null);
    setImportPrefill(null);
  }

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (selectedAgent) await runAgent({ agentId: selectedAgent._id as any, task });
      else await runAgent({ model, task });
      setTask("");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>AI Agents</h2>
      <p className="sub">Save a reusable agent (model, instructions, tools, skills, step budget) or run one off ad-hoc — either way it runs a multi-step tool loop and traces every step.</p>

      <div className="wb-head">
        <div className="picker-step mono muted">my agents</div>
        <div className="row" style={{ gap: "0.5rem" }}>
          {toolRegistry && skillRegistry && (
            <ImportMenu
              toolRegistry={toolRegistry}
              skillRegistry={skillRegistry}
              onImport={(prefill) => { setImportPrefill(prefill); setShowForm("new"); }}
            />
          )}
          {showForm !== "new" && <button className="btn" onClick={() => { setImportPrefill(null); setShowForm("new"); }}>+ New agent</button>}
        </div>
      </div>

      {showForm === "new" && (toolRegistry && skillRegistry ? (
        <AgentForm
          models={models}
          toolRegistry={toolRegistry}
          skillRegistry={skillRegistry}
          prefill={importPrefill ?? undefined}
          isAdmin={isAdmin}
          onSave={async (a) => { await createAgent({ ...a, instructions: a.instructions ?? undefined, temperature: a.temperature ?? undefined }); closeForm(); }}
          onCancel={closeForm}
        />
      ) : <p className="muted mono">…</p>)}

      {agentDefs === undefined ? (
        <p className="muted mono">…</p>
      ) : agentDefs.length === 0 && showForm !== "new" ? (
        <p className="sub">No saved agents yet — create one, or just run ad-hoc below.</p>
      ) : (
        <ul className="creds" style={{ marginBottom: "1.2rem" }}>
          {agentDefs.map((a) => (
            <li key={a._id}>
              {showForm === a._id && toolRegistry && skillRegistry ? (
                <AgentForm
                  models={models}
                  toolRegistry={toolRegistry}
                  skillRegistry={skillRegistry}
                  initial={a}
                  isAdmin={isAdmin}
                  onSave={async (patch: AgentPatch) => { await updateAgent({ id: a._id as any, ...patch }); closeForm(); }}
                  onCancel={closeForm}
                />
              ) : (
                <>
                  <span className="name">{a.name}</span>
                  <span className="mono muted model-id" style={{ fontSize: ".72rem" }}>{a.model}</span>
                  <span className="cred-actions">
                    <span className="badge">{a.tools.length} tool{a.tools.length === 1 ? "" : "s"}</span>
                    {(a.skills?.length ?? 0) > 0 && <span className="badge">{a.skills!.length} skill{a.skills!.length === 1 ? "" : "s"}</span>}
                    <span className="badge">max {a.maxSteps}</span>
                    {a.temperature != null && <span className="badge">temp {a.temperature}</span>}
                    <details className="dropdown">
                      <summary className="link">export ▾</summary>
                      <div className="dropdown-menu dropdown-menu-left">
                        <button className="link" onClick={(e) => { exportAgentFile(a, false); e.currentTarget.closest("details")?.removeAttribute("open"); }}>Export JSON</button>
                        <button className="link" onClick={(e) => { exportAgentFile(a, true); e.currentTarget.closest("details")?.removeAttribute("open"); }}>Export as template</button>
                      </div>
                    </details>
                    <button className="link" onClick={() => { setImportPrefill(null); setShowForm(a._id); }}>edit</button>
                    <button className="link danger" onClick={() => { if (selectedAgentId === a._id) setSelectedAgentId(""); void removeAgent({ id: a._id as any }); }}>delete</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="picker-step mono muted">run</div>
      <div className="row">
        <select value={selectedAgentId} onChange={(e) => { setSelectedAgentId(e.target.value); setErr(null); }} style={{ width: "auto" }}>
          <option value="">Ad-hoc — pick a model below</option>
          {(agentDefs ?? []).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>
      {!selectedAgent ? (
        <div className="row">
          <input list="agentmodels" placeholder="provider/model" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="agentmodels">{models.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
      ) : (
        <p className="sub" style={{ margin: "0 0 0.8rem" }}>
          <span className="mono">{selectedAgent.model}</span> · {selectedAgent.tools.length} tool{selectedAgent.tools.length === 1 ? "" : "s"} · max {selectedAgent.maxSteps} steps{selectedAgent.temperature != null ? ` · temp ${selectedAgent.temperature}` : ""}{selectedAgent.instructions ? " · has instructions" : ""}
        </p>
      )}
      <textarea rows={2} placeholder="e.g. list which providers I've connected, then summarize my usage" value={task} onChange={(e) => setTask(e.target.value)} />
      <button className="btn accent" disabled={busy || !task || (!selectedAgent && !model)} onClick={() => void run()}>
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
                  {r.agentName && <span className="badge oauth">{r.agentName}</span>}
                  <span className="mono muted model-id" style={{ fontSize: ".72rem" }}>{r.model}</span>
                  {r.finishedAt && r.at && <span className="badge" title="run duration">{((r.finishedAt - r.at) / 1000).toFixed(1)}s</span>}
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
