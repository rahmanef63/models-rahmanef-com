"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { catalogMetadata, PROVIDER_LABEL, type Cred, type Catalog } from "@/features/byok";

export const splitModel = (m: string): [string, string] => { const i = m.indexOf("/"); return [m.slice(0, i), m.slice(i + 1)]; };
export const route = (kind?: string) => (kind === "oauth" ? { label: "OAUTH", cls: "oauth" } : { label: "API KEY", cls: "key" });
export const kfmt = (n?: number) => (n == null ? "—" : n >= 1000 ? Math.round(n / 1000) + "k" : String(n));

export function ModelInspector({ catalog, model }: { catalog: Catalog; model: string }) {
  const [provider, id] = splitModel(model);
  const cells = catalogMetadata(catalog[provider]?.models?.[id]);
  return (
    <div className="wb-inspector">
      <div className="insp-id mono">{provider}<span className="muted">/</span>{id}</div>
      {!cells || cells.length === 0 ? (
        <p className="muted mono" style={{ fontSize: ".74rem", margin: 0 }}>No models.dev metadata for this model. Pricing and capabilities are unknown.</p>
      ) : (
        <div className="insp-grid">
          {cells.map(([k, val]) => (
            <div className="insp-cell" key={k}><span className="mono muted">{k}</span><b>{val}</b></div>
          ))}
        </div>
      )}
      {cells.length > 0 && <p className="muted mono" style={{ fontSize: ".72rem", margin: ".5rem 0 0" }}>Source: <a href="https://models.dev" target="_blank" rel="noreferrer">models.dev</a> catalog · prices per million tokens. Account access and current provider pricing are not verified.</p>}
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
  // catalog providers (models from models.dev) + connected CUSTOM providers with no catalog — a custom
  // endpoint, or any connected provider models.dev doesn't cover. The latter had no chip at all before
  // (byProvider is catalog-only), so they were invisible + unusable in the workbench; give them a
  // type-the-model-id step instead of a list.
  const catalogProvs = Object.keys(byProvider);
  const customProvs = [...new Set((providers ?? []).map((p) => p.provider))].filter((p) => !byProvider[p]);
  const provs = [...catalogProvs, ...customProvs].sort((a, b) => (PROVIDER_LABEL[a] ?? a).localeCompare(PROVIDER_LABEL[b] ?? b));
  const [prov, setProv] = useState<string | null>(provs.length === 1 ? provs[0] : null);
  const [q, setQ] = useState("");
  const saveModel = useMutation(api.credentials.setProviderModels);
  if (provs.length === 0) return <p className="sub">No models available — connect a provider in the <b>Providers</b> tab first.</p>;
  const isCustom = !!prov && !catalog[prov]; // no models.dev catalog = a custom endpoint → allow typing/saving model ids
  const list = prov ? byProvider[prov] ?? [] : []; // ?? [] — the live query can drop the selected provider mid-mount
  const ids = list.filter((id) => id.toLowerCase().includes(q.toLowerCase()));
  // pick a model; for a custom provider also PERSIST the id so it's a saved dropdown option next time
  // (setProviderModels patches models[] without touching the key — no re-entry). Best-effort save.
  const pickModel = (id: string) => {
    if (prov && isCustom && !list.includes(id)) void saveModel({ provider: prov, models: [...list, id] }).catch(() => {});
    onPick({ kind: "model", ref: `${prov}/${id}` });
  };
  const typed = q.trim();
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
              <em>{byProvider[p]?.length ?? "✎"}</em>
            </button>
          );
        })}
      </div>
      {prov && (
        <>
          <div className="picker-step mono muted">2 · model{isCustom ? "" : ` · ${list.length} available`}</div>
          <input placeholder={isCustom ? "type a model id, or search saved ones…" : `search ${PROVIDER_LABEL[prov] ?? prov} models…`} value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (isCustom && e.key === "Enter" && typed && !list.includes(typed)) pickModel(typed); }} />
          {(list.length > 0 || !isCustom) && (
            <div className="model-list">
              {ids.length === 0 ? (
                <p className="muted mono" style={{ fontSize: ".78rem", padding: ".55rem .85rem", margin: 0 }}>{isCustom ? "no saved model matches — type an id to add it" : "no match"}</p>
              ) : (
                ids.slice(0, 200).map((id) => {
                  const ctx = (catalog[prov]?.models as Record<string, any> | undefined)?.[id]?.limit?.context as number | undefined;
                  return (
                    <button key={id} className="model-row" onClick={() => pickModel(id)}>
                      <span className="mono">{id}</span>
                      {ctx != null && <span className="mono muted" style={{ fontSize: ".72rem" }}>{kfmt(ctx)} tok</span>}
                    </button>
                  );
                })
              )}
              {ids.length > 200 && <p className="muted mono" style={{ fontSize: ".72rem", padding: ".4rem .85rem", margin: 0 }}>+{ids.length - 200} more — refine search</p>}
            </div>
          )}
          {isCustom && typed && !list.includes(typed) && (
            <button className="btn accent" style={{ marginTop: ".4rem" }} onClick={() => pickModel(typed)}>use “{typed}” — saves to {PROVIDER_LABEL[prov] ?? prov}</button>
          )}
          {isCustom && list.length === 0 && !typed && (
            <p className="muted mono" style={{ fontSize: ".72rem", margin: ".35rem 0 0" }}>Custom provider — type a model id to use it; it’s saved for next time.</p>
          )}
        </>
      )}
    </div>
  );
}
