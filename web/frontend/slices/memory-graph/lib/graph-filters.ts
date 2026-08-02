import { type GraphNode, type GraphFilters, type GraphEdge } from "../types";

type ById = (id: string) => GraphNode | undefined;

export function normalize(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[-_:"']/g, " ");
}

// Obsidian-style query: whitespace-split terms; leading "-" negations are ignored (wireframe
// parity — negation is display-only), remaining terms AND-match against title/body/tags.
export function matchesQuery(node: GraphNode, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const positive = raw.split(/\s+/).filter(Boolean).filter((t) => !t.startsWith("-")).join(" ");
  if (!positive) return true;
  return normalize(`${node.title} ${node.body ?? ""} ${(node.tags ?? []).join(" ")}`).includes(normalize(positive));
}

// walk parent chain up to the owning cluster id (for the Groups filter)
export function topGroupId(node: GraphNode, byId: ById): string | null {
  if (node.group) return node.group;
  let cur: GraphNode | undefined = node;
  let n = 0;
  while (cur?.parent && n++ < 12) {
    const p = byId(cur.parent);
    if (!p) return cur.parent; // parent id points at a cluster even if the row is filtered out
    if (p.type === "cluster") return p.id;
    cur = p;
  }
  return node.type === "cluster" ? node.id : null;
}

export function isVisible(node: GraphNode, filters: GraphFilters, byId: ById): boolean {
  if (node.type === "core") return true;
  if (node.type === "cluster") return filters.groups[node.id] !== false;
  const group = topGroupId(node, byId);
  if (group && filters.groups[group] === false) return false;
  if (node.orphan && !filters.orphans) return false;
  if (!filters.attachments && node.attachment) return false;
  if (filters.existingOnly && node.existing === false) return false;
  return matchesQuery(node, filters.query);
}

export function visibleNodes(nodes: GraphNode[], filters: GraphFilters): GraphNode[] {
  const byId = (id: string) => nodes.find((n) => n.id === id);
  return nodes.filter((n) => isVisible(n, filters, byId));
}

export function visibleEdges(edges: GraphEdge[], visibleIds: Set<string>): GraphEdge[] {
  return edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
}
