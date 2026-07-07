// memory-graph public types. The renderer is data-driven + portable: feed it a GraphData built
// from ANY source (this app assembles memories + agents + skills + tools; another app feeds its
// own). Nothing here references Convex or a consumer — that coupling lives in the adapter layer.

export type NodeType = "core" | "cluster" | "memory" | "agent" | "skill" | "tool";

export type GraphNode = {
  id: string;
  type: NodeType;
  title: string;
  body?: string;
  icon?: string; // icon key (cluster nodes) — resolves against config/icons
  parent?: string; // primary cluster/parent id → drawn as a tree edge + physics anchor
  group?: string; // cluster id for the Groups filter (defaults to the parent chain's top)
  tags?: string[];
  links?: string[]; // cross-reference target ids (agent → its skills/tools) → drawn as link edges
  attachment?: boolean;
  existing?: boolean;
  orphan?: boolean;
  pinned?: boolean; // memory pin state (drives the inspector Pin/Unpin action)
  // runtime layout — mutated in place by the view/physics; optional in input (seeded on mount)
  x?: number;
  y?: number;
  anchorX?: number;
  anchorY?: number;
  vx?: number;
  vy?: number;
};

export type EdgeKind = "tree" | "link";
export type GraphEdge = { from: string; to: string; kind?: EdgeKind };

export type ClusterDef = { id: string; label: string; icon: string };

export type GraphData = {
  nodes: GraphNode[];
  // optional explicit edges; when omitted the renderer derives them from node.parent + node.links
  edges?: GraphEdge[];
  clusters?: ClusterDef[]; // ordered cluster metadata for the Groups filter
};

export type GraphFilters = {
  query: string;
  tags: boolean;
  attachments: boolean;
  existingOnly: boolean;
  orphans: boolean;
  groups: Record<string, boolean>; // cluster id → visible
};

export type GraphSettings = {
  arrows: boolean;
  textFade: number; // 0–100
  nodeSize: number; // 70–145 (%)
  linkThickness: number; // 60–240 (%)
  animate: boolean;
  centerForce: number; // 0–100
  repelForce: number; // 0–100
  linkForce: number; // 0–100
  linkDistance: number; // 80–260
};

// Copy map — props-driven portability (no inline strings in components). ID default, EN parallel
// lives in config/defaults. Consumers override any key via `labels`.
export type GraphLabels = {
  brand: string;
  heroTitle: string;
  heroSubtitle: string;
  addPlaceholder: string;
  addUnder: string; // "Add memory under {title}" — {title} is interpolated
  subnodeOf: string; // "Subnode of:"
  importLabel: string;
  hint: string;
  help: string;
  inspectorEmpty: string;
  inspectFocus: string;
  inspectAddChild: string;
  inspectClose: string;
  inspectPin: string;
  inspectUnpin: string;
  inspectDelete: string;
  linksTitle: string;
  mentionHint: string;
  toastDeleted: string;
  toastPinned: string;
  toastUnpinned: string;
  filters: string;
  searchPlaceholder: string;
  tags: string;
  attachments: string;
  existingOnly: string;
  orphans: string;
  groups: string;
  display: string;
  arrows: string;
  textFade: string;
  nodeSize: string;
  linkThickness: string;
  animate: string;
  animateStop: string;
  forces: string;
  centerForce: string;
  repelForce: string;
  linkForce: string;
  linkDistance: string;
  reset: string;
  toastAdded: string;
  toastSubAdded: string;
  toastImported: string; // "{n} memories imported" — {n} interpolated
  toastReset: string;
  toastAddSub: string;
  addMemoryLabel: string;
};

// lightweight node reference for the composer's @// mention picker
export type MentionItem = Pick<GraphNode, "id" | "title" | "type">;

export type MemoryGraphProps = {
  data: GraphData;
  labels?: Partial<GraphLabels>;
  className?: string;
  // handlers are optional so the renderer works read-only; the adapter wires them to Convex
  onAddMemory?: (text: string, parentId: string | null) => void | Promise<void>;
  onImport?: (items: string[]) => void | Promise<void>;
  onDeleteNode?: (node: GraphNode) => void | Promise<void>;
  onPinNode?: (node: GraphNode, pinned: boolean) => void | Promise<void>;
  onSelect?: (node: GraphNode | null) => void;
};
