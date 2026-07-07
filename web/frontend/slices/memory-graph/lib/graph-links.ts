// graph-links — cross-link edges from `@`/`/` reference tokens embedded in node bodies.
//
// Link syntax inside a memory's body text — BRACKET FORM ONLY:
//   @[Convex]        → resolves to the node titled/ided "Convex"
//   /[Researcher]    → same, `/` sigil (mirrors the composer's @// mention picker)
// A resolved ref becomes a `{ kind: "link" }` edge from the authoring node to the target.
// Bracket-only is deliberate: bare `@word` / `/word` appears constantly in prose (n/a, and/or,
// URLs, dates like 12/25, emails) and must NOT create edges. The composer always inserts brackets.
// Pure TS — no deps, no React. Resolution is best-effort: unmatched refs are dropped.

import type { GraphEdge, GraphNode } from "../types";

const REF_RE = /[@/]\[([^\]]+)\]/g;

// lowercase, non-alphanumerics → single space, trimmed + collapsed
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// lowercase, non-alphanumerics → "-", collapsed + edge-trimmed (id-slug form)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extract every `@`/`/` reference token from `text`. Brackets are stripped and the
 * inner ref trimmed; empty refs are dropped; duplicates removed (case-insensitive).
 */
export function parseRefs(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(REF_RE)) {
    const ref = match[1].trim();
    if (ref.length < 2) continue; // ignore 1-char refs (too ambiguous for substring resolution)
    const key = ref.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Resolve a ref string to a node id. Tries, in order: exact id → normalized-title
 * equality → id ends with `-<slug>` → normalized-title substring. First hit wins.
 */
export function resolveRef(ref: string, nodes: GraphNode[]): string | null {
  // a) exact id equality
  for (const n of nodes) {
    if (n.id === ref) return n.id;
  }
  const normRef = normalize(ref);
  // b) normalized-title equality
  for (const n of nodes) {
    if (normalize(n.title) === normRef) return n.id;
  }
  // c) id ends with `-<slug>`  (e.g. "Researcher" → id "skill-researcher")
  const slug = slugify(ref);
  if (slug) {
    const suffix = `-${slug}`;
    for (const n of nodes) {
      if (n.id.toLowerCase().endsWith(suffix)) return n.id;
    }
  }
  // d) normalized-title substring
  if (normRef) {
    for (const n of nodes) {
      if (normalize(n.title).includes(normRef)) return n.id;
    }
  }
  return null;
}

/**
 * Scan every node with a `body`, resolve its embedded refs, and emit a `"link"` edge
 * to each resolved target (self-links skipped). Edges deduplicated by `from|to`.
 */
export function resolveBodyLinks(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node.body) continue;
    for (const ref of parseRefs(node.body)) {
      const targetId = resolveRef(ref, nodes);
      if (!targetId || targetId === node.id) continue;
      const key = `${node.id}|${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: node.id, to: targetId, kind: "link" });
    }
  }
  return edges;
}
