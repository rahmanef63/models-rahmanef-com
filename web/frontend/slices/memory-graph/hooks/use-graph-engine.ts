"use client";
import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import { type GraphNode, type GraphEdge, type GraphFilters, type GraphSettings } from "../types";
import { WORLD } from "../config/defaults";
import { physicsStep } from "../lib/graph-physics";
import { visibleNodes, visibleEdges } from "../lib/graph-filters";

type EngineArgs = {
  nodesRef: MutableRefObject<GraphNode[]>;
  edgesRef: MutableRefObject<GraphEdge[]>;
  stageRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  edgesSvgRef: RefObject<SVGSVGElement | null>;
  nodeLayerRef: RefObject<HTMLDivElement | null>;
  filters: GraphFilters;
  settings: GraphSettings;
};

// The imperative engine: pan / zoom-to-cursor / node drag / force-sim loop, all mutating the DOM
// directly (node --x/--y vars + edge line coords) so high-frequency motion never re-renders React.
export function useGraphEngine({ nodesRef, edgesRef, stageRef, worldRef, edgesSvgRef, nodeLayerRef, filters, settings }: EngineArgs) {
  const filtersRef = useRef(filters); filtersRef.current = filters;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const pan = useRef({ x: 0, y: 0 });
  const scale = useRef(0.92);
  const gesture = useRef<{ mode: "pan" | "drag" | null; sx: number; sy: number; px: number; py: number; node: GraphNode | null }>({ mode: null, sx: 0, sy: 0, px: 0, py: 0, node: null });
  const raf = useRef<number | null>(null);
  const byId = (id?: string | null) => (id ? nodesRef.current.find((x) => x.id === id) : undefined);
  const rect = () => stageRef.current?.getBoundingClientRect();

  const applyTransform = useCallback(() => {
    const w = worldRef.current;
    if (w) w.style.transform = `translate(${pan.current.x}px, ${pan.current.y}px) scale(${scale.current})`;
  }, [worldRef]);

  const setNodeEl = (node: GraphNode) => {
    const el = nodeLayerRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(node.id)}"]`);
    if (el) { el.style.setProperty("--x", `${node.x ?? 0}px`); el.style.setProperty("--y", `${node.y ?? 0}px`); }
  };

  const syncEdges = useCallback(() => {
    edgesSvgRef.current?.querySelectorAll<SVGLineElement>("line[data-a]").forEach((line) => {
      const a = byId(line.dataset.a), b = byId(line.dataset.b);
      if (a && b) { line.setAttribute("x1", `${a.x}`); line.setAttribute("y1", `${a.y}`); line.setAttribute("x2", `${b.x}`); line.setAttribute("y2", `${b.y}`); }
    });
  }, [edgesSvgRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncPositions = useCallback(() => {
    for (const node of nodesRef.current) setNodeEl(node);
    syncEdges();
  }, [syncEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = useCallback(() => {
    const r = rect(); if (!r) return;
    scale.current = Math.min(1, Math.max(0.6, r.width / 1700));
    pan.current.x = r.width / 2 - WORLD.cx * scale.current;
    pan.current.y = r.height / 2 - WORLD.cy * scale.current;
    applyTransform();
  }, [applyTransform]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusNode = useCallback((node?: GraphNode | null) => {
    const r = rect(); if (!r || !node) return;
    scale.current = Math.max(scale.current, 0.98);
    pan.current.x = r.width / 2 - (node.x ?? 0) * scale.current;
    pan.current.y = r.height / 2 - (node.y ?? 0) * scale.current;
    applyTransform();
  }, [applyTransform]); // eslint-disable-line react-hooks/exhaustive-deps

  const onStagePointerDown = useCallback((e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest(".mg-node,.mg-hover-add,.mg-dock,.mg-topbar,.mg-inspector,.mg-panel")) return;
    gesture.current = { mode: "pan", sx: e.clientX, sy: e.clientY, px: pan.current.x, py: pan.current.y, node: null };
    stageRef.current?.classList.add("dragging");
  }, [stageRef]);

  const onNodePointerDown = useCallback((e: ReactPointerEvent, id: string) => {
    const node = byId(id);
    if (!node || node.type === "core") return;
    e.stopPropagation();
    gesture.current = { mode: "drag", sx: e.clientX, sy: e.clientY, px: node.x ?? 0, py: node.y ?? 0, node };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (g.mode === "pan") {
        pan.current.x = g.px + e.clientX - g.sx; pan.current.y = g.py + e.clientY - g.sy; applyTransform();
      } else if (g.mode === "drag" && g.node) {
        g.node.x = g.px + (e.clientX - g.sx) / scale.current;
        g.node.y = g.py + (e.clientY - g.sy) / scale.current;
        g.node.anchorX = g.node.x; g.node.anchorY = g.node.y;
        setNodeEl(g.node); syncEdges();
      }
    };
    const up = () => { gesture.current.mode = null; stageRef.current?.classList.remove("dragging"); };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = rect(); if (!r) return;
      const lx = e.clientX - r.left, ly = e.clientY - r.top;
      const bx = (lx - pan.current.x) / scale.current, by = (ly - pan.current.y) / scale.current;
      scale.current = Math.min(1.55, Math.max(0.45, scale.current * (1 - e.deltaY * 0.001)));
      pan.current.x = lx - bx * scale.current; pan.current.y = ly - by * scale.current; applyTransform();
    };
    const stage = stageRef.current;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up); // pointer released off-window → don't wedge the gesture
    stage?.addEventListener("wheel", wheel, { passive: false });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); stage?.removeEventListener("wheel", wheel); };
  }, [applyTransform, syncEdges, stageRef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settings.animate) { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; return; }
    const core = nodesRef.current.find((x) => x.type === "core");
    const loop = () => {
      if (!settingsRef.current.animate) { raf.current = null; return; }
      const vis = visibleNodes(nodesRef.current, filtersRef.current);
      physicsStep(vis, visibleEdges(edgesRef.current, new Set(vis.map((x) => x.id))), settingsRef.current, core);
      syncPositions();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; };
  }, [settings.animate, syncPositions]); // eslint-disable-line react-hooks/exhaustive-deps

  return { onStagePointerDown, onNodePointerDown, resetView, focusNode, syncPositions, applyTransform };
}
