import { type GraphNode, type GraphEdge } from "../types";
import { WORLD } from "../config/defaults";
import { resolveBodyLinks } from "./graph-links";

// Edges = the parent tree (core→cluster→leaf) + explicit cross-links (agent→its skills/tools) +
// links parsed from `@[Title]` / `/[Title]` references inside any node's body. Used when
// GraphData.edges isn't supplied — the common case for this app's adapter. Deduped, tree wins.
export function deriveEdges(nodes: GraphNode[]): GraphEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (e: GraphEdge) => { const k = `${e.from}|${e.to}`; if (!seen.has(k)) { seen.add(k); edges.push(e); } };
  for (const n of nodes) {
    if (n.parent && ids.has(n.parent)) add({ from: n.parent, to: n.id, kind: "tree" });
    for (const t of n.links ?? []) if (ids.has(t) && t !== n.id) add({ from: n.id, to: t, kind: "link" });
  }
  for (const e of resolveBodyLinks(nodes)) add(e);
  return edges;
}

// Radial placement around a parent — also used for the hover "add child" ghost + new-node drops.
export function childPosition(parent: GraphNode, childCount: number, linkDistance: number, extraIndex = 0): { x: number; y: number } {
  const px = parent.x ?? WORLD.cx;
  const py = parent.y ?? WORLD.cy;
  const outward = Math.atan2(py - WORLD.cy, px - WORLD.cx);
  const base = Number.isFinite(outward) && (px !== WORLD.cx || py !== WORLD.cy) ? outward : -Math.PI / 3;
  const spread = parent.type === "cluster" ? 0.55 : 0.85;
  const count = childCount + extraIndex;
  const angle = base + (count - Math.max(1, childCount) / 2) * spread;
  const dist = Math.max(85, linkDistance * (parent.type === "cluster" ? 1.08 : 0.82));
  return { x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist };
}

// Seed any missing x/y radially (clusters ring the core, leaves fan off their cluster) and init
// the physics fields. `prev` carries forward positions of nodes that persist across a server
// refetch so the graph never jumps or duplicates. Never mutates the input.
export function seedLayout(input: GraphNode[], prev?: Map<string, GraphNode>): GraphNode[] {
  // match by id, then by body — so an optimistic node (local id) that the server echoes back under
  // a real id keeps its on-screen position instead of hopping to a fresh seed.
  const prevByBody = new Map<string, GraphNode>();
  if (prev) for (const p of prev.values()) if (p.body) prevByBody.set(p.body, p);
  const nodes = input.map((n) => {
    const kept = prev?.get(n.id) ?? (n.body ? prevByBody.get(n.body) : undefined);
    return kept ? { ...n, x: kept.x, y: kept.y, anchorX: kept.anchorX, anchorY: kept.anchorY } : { ...n };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const core = nodes.find((n) => n.type === "core");
  const cx = core?.x ?? WORLD.cx;
  const cy = core?.y ?? WORLD.cy;
  if (core) { core.x ??= cx; core.y ??= cy; }

  const clusters = nodes.filter((n) => n.type === "cluster");
  clusters.forEach((c, i) => {
    if (c.x == null || c.y == null) {
      const a = (i / Math.max(1, clusters.length)) * Math.PI * 2 - Math.PI / 2;
      c.x = cx + Math.cos(a) * 185;
      c.y = cy + Math.sin(a) * 165;
    }
  });

  const kids = new Map<string, GraphNode[]>();
  for (const n of nodes) if (n.parent) (kids.get(n.parent) ?? kids.set(n.parent, []).get(n.parent)!).push(n);
  for (const [pid, arr] of kids) {
    const p = byId.get(pid);
    if (!p) continue;
    const base = Math.atan2((p.y ?? cy) - cy, (p.x ?? cx) - cx);
    arr.forEach((n, i) => {
      if (n.x == null || n.y == null) {
        const angle = base + (i - (arr.length - 1) / 2) * 0.5;
        const dist = p.type === "cluster" ? 150 : 110;
        n.x = (p.x ?? cx) + Math.cos(angle) * dist;
        n.y = (p.y ?? cy) + Math.sin(angle) * dist;
      }
    });
  }

  return nodes.map((n) => {
    const x = n.x ?? cx;
    const y = n.y ?? cy;
    return { ...n, x, y, anchorX: n.anchorX ?? x, anchorY: n.anchorY ?? y, vx: 0, vy: 0 };
  });
}
