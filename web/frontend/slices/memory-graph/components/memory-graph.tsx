"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { type MemoryGraphProps, type MentionItem, type GraphNode } from "../types";
import { DEFAULT_LABELS } from "../config/defaults";
import { GRAPH_CSS } from "../config/graph-styles";
import { ICONS } from "../config/icons";
import { visibleNodes, visibleEdges } from "../lib/graph-filters";
import { childPosition } from "../lib/graph-model";
import { parseImport } from "../lib/graph-import";
import { useGraphState } from "../hooks/use-graph-state";
import { useGraphEngine } from "../hooks/use-graph-engine";
import { GraphEdges } from "./graph-edges";
import { GraphNodes } from "./graph-nodes";
import { GraphTopbar } from "./graph-topbar";
import { ControlPanel } from "./control-panel";
import { Inspector } from "./inspector";
import { Composer } from "./composer";
import { GraphLegend } from "./graph-legend";

// The portable renderer: an Obsidian-style force graph over ANY GraphData. Zero Convex/consumer
// coupling — handlers are optional (read-only without them). Styles are injected as a scoped
// <style>, so it drops into any project as one component.
export function MemoryGraph({ data, labels: over, className, onAddMemory, onImport, onDeleteNode, onPinNode, onSelect }: MemoryGraphProps) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...over }), [over]);
  const st = useGraphState(data, onAddMemory);
  const clusters = data.clusters ?? [];

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const edgesSvgRef = useRef<SVGSVGElement>(null);
  const nodeLayerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [panelOpen, setPanelOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState("");
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const showToast = useCallback((m: string) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 1600); }, []);
  const posFor = useCallback((id: string) => {
    const p = st.byId(id); if (!p) return null;
    const count = st.nodesRef.current.filter((x) => x.parent === p.id).length;
    return childPosition(p, count, st.settings.linkDistance);
  }, [st]);
  const engine = useGraphEngine({ nodesRef: st.nodesRef, edgesRef: st.edgesRef, stageRef, worldRef, edgesSvgRef, nodeLayerRef, filters: st.filters, settings: st.settings });

  const hasNodes = st.nodesRef.current.length > 0;
  useEffect(() => { engine.resetView(); }, [hasNodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(toastTimer.current); }, []);
  // the controls panel is a bottom sheet on phones — start it closed so it doesn't bury the graph
  useEffect(() => { if (window.matchMedia?.("(max-width:680px)").matches) setPanelOpen(false); }, []);

  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    el.style.setProperty("--mg-node-scale", String(st.settings.nodeSize / 100));
    el.style.setProperty("--mg-link-width", ((st.settings.linkThickness / 100) * 1.35).toFixed(2));
    el.style.setProperty("--mg-pill-alpha", (1 - (st.settings.textFade / 100) * 0.7).toFixed(2));
    el.classList.toggle("tags-on", st.filters.tags);
  }, [st.settings.nodeSize, st.settings.linkThickness, st.settings.textFade, st.filters.tags]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) { e.preventDefault(); setExpanded(true); inputRef.current?.focus(); }
      if (e.key === "Escape") { setInspectorOpen(false); setExpanded(false); st.setContextParent(null); inputRef.current?.blur(); engine.resetView(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, st]);

  const select = (id: string) => { st.select(id); setInspectorOpen(true); onSelect?.(st.byId(id) ?? null); };
  const clearHover = () => { clearTimeout(hideTimer.current); st.setHoverParent(null); setHoverPos(null); };
  const hover = (id: string) => { clearTimeout(hideTimer.current); st.setHoverParent(id); setHoverPos(posFor(id)); };
  const hoverLeave = () => { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(clearHover, 180); };
  const grab = (e: ReactPointerEvent, id: string) => { engine.onNodePointerDown(e, id); clearHover(); };
  const openChild = (parentId: string | null) => { st.setContextParent(parentId); setExpanded(true); inputRef.current?.focus(); clearHover(); };
  const onStageDown = (e: ReactPointerEvent) => { engine.onStagePointerDown(e); setInspectorOpen(false); };
  const submit = () => { if (st.addMemory(composerValue)) { setComposerValue(""); setExpanded(false); const sub = !!st.contextParent; st.setContextParent(null); showToast(sub ? labels.toastSubAdded : labels.toastAdded); } };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const items = parseImport(await file.text()).slice(0, 18);
    if (items.length) { items.forEach((it) => st.addMemory(it, null, { persist: false })); void onImport?.(items); showToast(labels.toastImported.replace("{n}", String(items.length))); }
    e.target.value = "";
  };

  const vis = useMemo(() => visibleNodes(st.nodesRef.current, st.filters), [st.filters, st.structural, st.dataKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const visIds = new Set(vis.map((v) => v.id));
  const vEdges = visibleEdges(st.edgesRef.current, visIds);
  const hoverParentNode = st.hoverParent && visIds.has(st.hoverParent) ? st.byId(st.hoverParent) : undefined;
  const selectedNode = st.byId(st.selected) ?? null;

  const mentionItems = useMemo<MentionItem[]>(() => st.nodesRef.current.map((n) => ({ id: n.id, title: n.title, type: n.type })), [st.structural, st.dataKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedLinks = useMemo<MentionItem[]>(() => st.edgesRef.current
    .filter((e) => e.from === st.selected && e.kind === "link")
    .map((e) => st.byId(e.to)).filter((n): n is GraphNode => !!n)
    .map((n) => ({ id: n.id, title: n.title, type: n.type })), [st.selected, st.structural, st.dataKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const n of vis) c[n.type] = (c[n.type] ?? 0) + 1; return c; }, [vis]);

  const deleteNode = (n: GraphNode) => { st.removeNode(n.id); setInspectorOpen(false); void onDeleteNode?.(n); showToast(labels.toastDeleted); };
  const pinNode = (n: GraphNode, pinned: boolean) => { st.setPinned(n.id, pinned); void onPinNode?.(n, pinned); showToast(pinned ? labels.toastPinned : labels.toastUnpinned); };
  const navigate = (id: string) => { select(id); engine.focusNode(st.byId(id)); };

  return (
    <div className={`mgraph ${className ?? ""}`} ref={rootRef}>
      <style>{GRAPH_CSS}</style>
      <GraphTopbar labels={labels} controlsOn={panelOpen} onToggleControls={() => setPanelOpen((o) => !o)} fileRef={fileRef} onFile={onFile} />
      <section className="mg-stage" ref={stageRef} onPointerDown={onStageDown} aria-label={labels.heroTitle}>
        <div className="mg-world" ref={worldRef}>
          <GraphEdges ref={edgesSvgRef} edges={vEdges} byId={st.byId} selected={st.selected} arrows={st.settings.arrows} hover={hoverParentNode && hoverPos ? { ...hoverPos, parent: hoverParentNode } : null} />
          <div className="mg-hero"><h1>{labels.heroTitle}</h1><p>{labels.heroSubtitle}</p></div>
          <GraphNodes ref={nodeLayerRef} nodes={vis} selected={st.selected} onNodePointerDown={grab} onSelect={select} onHover={hover} onHoverLeave={hoverLeave} />
          {hoverParentNode && hoverPos && (
            <button className="mg-hover-add visible" style={{ "--x": `${hoverPos.x}px`, "--y": `${hoverPos.y}px` } as CSSProperties}
              onPointerEnter={() => clearTimeout(hideTimer.current)} onPointerLeave={hoverLeave}
              onClick={(e) => { e.stopPropagation(); openChild(st.hoverParent); showToast(labels.toastAddSub); }} aria-label={labels.addMemoryLabel}>
              {ICONS.plus}<span className="mg-hover-label">{labels.addMemoryLabel}</span>
            </button>
          )}
        </div>
      </section>
      <Inspector labels={labels} node={selectedNode} links={selectedLinks} open={inspectorOpen} onFocus={() => engine.focusNode(selectedNode)} onAddChild={() => openChild(st.selected)} onPin={pinNode} onDelete={deleteNode} onNavigate={navigate} onClose={() => setInspectorOpen(false)} />
      <ControlPanel labels={labels} filters={st.filters} settings={st.settings} clusters={clusters} open={panelOpen} onClose={() => setPanelOpen(false)} onReset={() => { st.reset(); showToast(labels.toastReset); }} onFilters={st.patchFilters} onSettings={st.patchSettings} onToggleGroup={st.toggleGroup} />
      <Composer ref={inputRef} labels={labels} expanded={expanded} contextTitle={st.byId(st.contextParent)?.title ?? null} value={composerValue} mentionItems={mentionItems} onChange={setComposerValue} onSubmit={submit} onFocus={() => setExpanded(true)} onPlus={() => { st.setContextParent(null); setExpanded(true); inputRef.current?.focus(); }} />
      <GraphLegend counts={counts} />
      <div className="mg-hint">{labels.hint}</div>
      <div className={`mg-toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
