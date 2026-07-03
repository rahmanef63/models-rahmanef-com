"use client";
import { useState } from "react";
import { PROVIDER_LABEL, type Cred, type Catalog } from "./shared";

export const splitModel = (m: string): [string, string] => { const i = m.indexOf("/"); return [m.slice(0, i), m.slice(i + 1)]; };
export const route = (kind?: string) => (kind === "oauth" ? { label: "OAUTH", cls: "oauth" } : { label: "API KEY", cls: "key" });
export const kfmt = (n?: number) => (n == null ? "—" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n));

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

export function ModelInspector({ catalog, model }: { catalog: Catalog; model: string }) {
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

export type ModelPick = { kind: "model"; ref: string } | { kind: "agent"; agentId: string };
export type AgentPickMeta = { id: string; name: string; model: string; toolCount: number };

// provider-first model picker — never dumps every model at once. Pick a provider, then its models.
// also offers saved agents up top, so a new thread can bind to an agent instead of a raw model.
export function ModelPicker({ byProvider, providers, catalog, agents, onPick }: {
  byProvider: Record<string, string[]>;
  providers: Cred[] | undefined;
  catalog: Catalog;
  agents: AgentPickMeta[];
  onPick: (pick: ModelPick) => void;
}) {
  const provs = Object.keys(byProvider).sort((a, b) => (PROVIDER_LABEL[a] ?? a).localeCompare(PROVIDER_LABEL[b] ?? b));
  const [prov, setProv] = useState<string | null>(provs.length === 1 ? provs[0] : null);
  const [q, setQ] = useState("");
  if (provs.length === 0) return <p className="sub">No models available — connect a provider in the <b>Providers</b> tab first.</p>;
  const list = prov ? byProvider[prov] ?? [] : []; // ?? [] — the live query can drop the selected provider mid-mount
  const ids = list.filter((id) => id.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="picker">
      {agents.length > 0 && (
        <>
          <div className="picker-step mono muted">saved agents</div>
          <div className="prov-chips">
            {agents.map((a) => (
              <button key={a.id} className="prov-chip" onClick={() => onPick({ kind: "agent", agentId: a.id })}>
                <strong>{a.name}</strong>
                <span className="badge">{a.toolCount} tool{a.toolCount === 1 ? "" : "s"}</span>
                {/* a plain flowing span, not <em> — <em> here is `.prov-chip em`'s absolutely-positioned
                    top-right corner slot sized for a short digit count, not a full "provider/model" string */}
                <span className="mono muted model-id" style={{ fontSize: ".68rem" }}>{a.model}</span>
              </button>
            ))}
          </div>
        </>
      )}
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
                  <button key={id} className="model-row" onClick={() => onPick({ kind: "model", ref: `${prov}/${id}` })}>
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
