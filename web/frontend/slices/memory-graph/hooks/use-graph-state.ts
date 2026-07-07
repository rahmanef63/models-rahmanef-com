"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type GraphData, type GraphNode, type GraphEdge, type GraphFilters, type GraphSettings } from "../types";
import { DEFAULT_FILTERS, DEFAULT_SETTINGS } from "../config/defaults";
import { deriveEdges, seedLayout, childPosition } from "../lib/graph-model";

// Owns the interactive graph state. `nodesRef` holds live positions (mutated in place by the
// engine — never triggers React); `structural` bumps only when the visible SET or selection
// changes, which is what actually needs a re-render. Re-seeding on new server data preserves the
// positions of nodes that persist, so a refetch never makes the graph jump.
export function useGraphState(data: GraphData, onAddMemory?: (text: string, parentId: string | null) => void | Promise<void>) {
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const seededKey = useRef<string>("");
  const dataKey = data.nodes.map((n) => n.id).join(",") + "|" + (data.edges?.length ?? 0);
  if (seededKey.current !== dataKey) {
    seededKey.current = dataKey;
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = seedLayout(data.nodes, prev);
    edgesRef.current = data.edges ?? deriveEdges(nodesRef.current);
  }

  const [structural, setStructural] = useState(0);
  const bump = useCallback(() => setStructural((s) => s + 1), []);
  const [filters, setFilters] = useState<GraphFilters>({ ...DEFAULT_FILTERS, groups: {} });
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverParent, setHoverParentState] = useState<string | null>(null);
  const [contextParent, setContextParent] = useState<string | null>(null);
  const pendingBody = useRef<string | null>(null);

  const byId = useCallback((id: string | null) => (id ? nodesRef.current.find((n) => n.id === id) : undefined), []);

  // after a server refetch swaps the optimistic node for the real one, follow the selection by body
  // (the mutation returns void, so we can't match on id) — otherwise the open inspector would blank.
  useEffect(() => {
    if (!selected || byId(selected)) return;
    const match = pendingBody.current ? nodesRef.current.find((n) => n.body === pendingBody.current) : undefined;
    setSelected(match ? match.id : null);
    pendingBody.current = null;
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = useCallback((id: string | null) => setSelected(id), []);
  const patchFilters = useCallback((patch: Partial<GraphFilters>) => { setFilters((f) => ({ ...f, ...patch })); bump(); }, [bump]);
  const toggleGroup = useCallback((id: string) => { setFilters((f) => ({ ...f, groups: { ...f.groups, [id]: f.groups[id] === false } })); bump(); }, [bump]);
  const patchSettings = useCallback((patch: Partial<GraphSettings>) => { setSettings((s) => ({ ...s, ...patch })); if ("arrows" in patch) bump(); }, [bump]);
  const reset = useCallback(() => { setFilters({ ...DEFAULT_FILTERS, groups: {} }); setSettings(DEFAULT_SETTINGS); bump(); }, [bump]);
  const setHoverParent = useCallback((id: string | null) => setHoverParentState(id), []);

  const addMemory = useCallback((text: string, parentId?: string | null, opts?: { persist?: boolean }): GraphNode | null => {
    const clean = text.trim();
    if (!clean) return null;
    const nodes = nodesRef.current;
    const sel = nodes.find((n) => n.id === selected);
    const chosen = parentId ?? contextParent ?? (sel && sel.type !== "core" ? sel.id : null);
    const parent = nodes.find((n) => n.id === chosen) ?? nodes.find((n) => n.type === "cluster") ?? nodes.find((n) => n.type === "core");
    if (!parent) return null;
    const childCount = nodes.filter((n) => n.parent === parent.id).length;
    const pos = childPosition(parent, childCount, settings.linkDistance);
    const node: GraphNode = {
      id: `local-${nodes.length}-${clean.length}-${clean.slice(0, 6)}`,
      type: "memory",
      parent: parent.id,
      title: clean.length > 24 ? clean.slice(0, 24).trim() + "…" : clean,
      body: clean,
      tags: ["new"],
      existing: true,
      x: pos.x, y: pos.y, anchorX: pos.x, anchorY: pos.y, vx: 0, vy: 0,
    };
    nodesRef.current = [...nodes, node];
    edgesRef.current = [...edgesRef.current, { from: parent.id, to: node.id, kind: "tree" }];
    pendingBody.current = clean;
    setSelected(node.id);
    bump();
    if (opts?.persist !== false) void onAddMemory?.(clean, parent.id);
    return node;
  }, [selected, contextParent, settings.linkDistance, bump, onAddMemory]);

  const removeNode = useCallback((id: string) => {
    nodesRef.current = nodesRef.current.filter((n) => n.id !== id);
    edgesRef.current = edgesRef.current.filter((e) => e.from !== id && e.to !== id);
    setSelected((s) => (s === id ? null : s));
    bump();
  }, [bump]);

  const setPinned = useCallback((id: string, pinned: boolean) => {
    const n = nodesRef.current.find((x) => x.id === id);
    if (n) n.pinned = pinned;
    bump();
  }, [bump]);

  return {
    nodesRef, edgesRef, structural, dataKey, byId,
    filters, settings, selected, hoverParent, contextParent,
    select, patchFilters, toggleGroup, patchSettings, reset,
    setHoverParent, setContextParent, addMemory, removeNode, setPinned,
  };
}
