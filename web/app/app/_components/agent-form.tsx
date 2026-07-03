"use client";
import { useId, useState } from "react";
import { ErrorLine } from "./shared";

export type AgentDef = { _id: string; name: string; model: string; instructions?: string; tools: string[]; maxSteps: number; temperature?: number };
export type ToolMeta = { id: string; label: string; description: string };
// instructions/temperature: null = "clear this field" (only meaningful on edit — see onSave below;
// Convex's client silently drops `undefined` args before they reach the wire, so `undefined` can't
// distinguish "not touched" from "cleared" the way `null` can).
export type AgentPatch = { name?: string; model?: string; instructions?: string | null; tools?: string[]; maxSteps?: number; temperature?: number | null };
export const isValidModelRef = (m: string) => { const i = m.trim().indexOf("/"); return i > 0 && i !== m.trim().length - 1; };

export function AgentForm({ models, toolRegistry, initial, onSave, onCancel, isAdmin }: {
  models: string[];
  toolRegistry: ToolMeta[];
  initial?: AgentDef;
  onSave: (a: AgentPatch & { name: string; model: string; tools: string[]; maxSteps: number }) => Promise<void>;
  onCancel: () => void;
  isAdmin: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [tools, setTools] = useState<string[]>(initial?.tools ?? toolRegistry.map((t) => t.id)); // new agent defaults: every tool on
  const [maxSteps, setMaxSteps] = useState(initial?.maxSteps ?? 8);
  const [temperature, setTemperature] = useState(initial?.temperature != null ? String(initial.temperature) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const formId = useId();

  function toggleTool(id: string) {
    setTools((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  return (
    <div className="agent-form">
      <input placeholder="Agent name — e.g. Research assistant" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="row">
        <input list={formId} placeholder="provider/model" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id={formId}>{models.map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <textarea rows={3} placeholder="Instructions / system prompt — optional, e.g. &quot;You are a terse research assistant. Cite sources.&quot;" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      <div className="agent-form-tools">
        <div className="picker-step mono muted">tools</div>
        {toolRegistry.map((t) => (
          <label key={t.id} className="toggle">
            <input type="checkbox" checked={tools.includes(t.id)} onChange={() => toggleTool(t.id)} />
            <span><strong>{t.label}</strong> <span className="muted">— {t.description}</span></span>
          </label>
        ))}
      </div>
      <div className="row">
        <label className="mono muted" style={{ fontSize: ".78rem", display: "flex", alignItems: "center", gap: ".5rem" }}>
          max steps
          <input type="number" min={1} max={20} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))} style={{ width: "5rem" }} />
        </label>
        <label className="mono muted" style={{ fontSize: ".78rem", display: "flex", alignItems: "center", gap: ".5rem" }}>
          temperature
          <input type="number" min={0} max={2} step={0.1} placeholder="default" value={temperature} onChange={(e) => setTemperature(e.target.value)} style={{ width: "5rem" }} />
        </label>
      </div>
      <div className="row">
        <button
          className="btn accent"
          disabled={busy || !name.trim() || !isValidModelRef(model)}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              // editing: null clears a blanked field (survives Convex's arg serializer); creating:
              // undefined omits it — there's no existing value to distinguish "cleared" from.
              const empty = initial ? null : undefined;
              await onSave({
                name: name.trim(),
                model: model.trim(),
                instructions: instructions.trim() ? instructions.trim() : empty,
                tools,
                maxSteps,
                temperature: temperature.trim() ? Number(temperature) : empty,
              });
            } catch (e) {
              setErr(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "…" : initial ? "Save changes" : "Create agent"}
        </button>
        <button className="link" onClick={onCancel}>cancel</button>
      </div>
      {err != null && <ErrorLine e={err} isAdmin={isAdmin} />}
    </div>
  );
}
