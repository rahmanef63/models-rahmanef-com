// graph-links — cross-link edges from `@`/`/` reference tokens embedded in node bodies.
//
// The ref parser + resolver live in the `memory` slice (frontend/slices/memory/lib/refs.ts) so the
// vault editor can use them without memory-graph installed; this file only turns resolved refs into
// graph edges. See that file for the bracket-only link syntax and the resolution order.

import type { GraphEdge, GraphNode } from "../types";
import { parseRefs, resolveRef } from "@/features/memory";

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
