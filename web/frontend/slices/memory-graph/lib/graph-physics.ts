import { type GraphNode, type GraphEdge, type GraphSettings } from "../types";

const n = (v: number | undefined) => v ?? 0;

// One force-simulation tick, mutating vx/vy/x/y in place (deterministic — no Math.random, so a
// paused/resumed sim stays stable). Ports the wireframe's forces: anchor pull + parent/core
// gravity (centerForce), all-pairs repulsion (repelForce), and edge springs (linkForce); explicit
// cross-links (agent→skill/tool) pull at 40% so they don't distort the primary tree.
export function physicsStep(nodes: GraphNode[], edges: GraphEdge[], s: GraphSettings, core?: GraphNode): void {
  const sim = nodes.filter((node) => node.type !== "core");
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const centerF = s.centerForce / 100;
  const repel = s.repelForce / 100;
  const linkF = s.linkForce / 100;

  for (const node of sim) {
    node.vx = n(node.vx) + (n(node.anchorX) - n(node.x)) * 0.0028 * centerF;
    node.vy = n(node.vy) + (n(node.anchorY) - n(node.y)) * 0.0028 * centerF;
    const p = node.parent ? byId.get(node.parent) : !node.orphan ? core : undefined;
    if (p) {
      node.vx = n(node.vx) + (n(p.x) - n(node.x)) * 0.00035 * centerF;
      node.vy = n(node.vy) + (n(p.y) - n(node.y)) * 0.00035 * centerF;
    }
  }

  for (let i = 0; i < sim.length; i++) {
    for (let j = i + 1; j < sim.length; j++) {
      const a = sim[i], b = sim[j];
      let dx = n(a.x) - n(b.x), dy = n(a.y) - n(b.y);
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = 0.5; dy = 0.5; d2 = 1; }
      const d = Math.sqrt(d2);
      const f = Math.min(2.2, (900 * repel) / d2);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx = n(a.vx) + fx; a.vy = n(a.vy) + fy;
      b.vx = n(b.vx) - fx; b.vy = n(b.vy) - fy;
    }
  }

  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) continue;
    const dx = n(b.x) - n(a.x), dy = n(b.y) - n(a.y);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const desired = b.type === "cluster" ? s.linkDistance * 0.78 : s.linkDistance * (a.type === "memory" || a.type === "agent" || a.type === "skill" || a.type === "tool" ? 0.72 : 1);
    const diff = (d - desired) * 0.0055 * linkF * (e.kind === "link" ? 0.4 : 1);
    const fx = (dx / d) * diff, fy = (dy / d) * diff;
    if (a.type !== "core") { a.vx = n(a.vx) + fx; a.vy = n(a.vy) + fy; }
    if (b.type !== "core") { b.vx = n(b.vx) - fx; b.vy = n(b.vy) - fy; }
  }

  for (const node of sim) {
    node.vx = n(node.vx) * 0.86;
    node.vy = n(node.vy) * 0.86;
    node.x = n(node.x) + n(node.vx);
    node.y = n(node.y) + n(node.vy);
  }
}
