import { type GraphLabels, type GraphSettings, type GraphFilters, type NodeType } from "../types";

// English defaults. Every string is overridable via the `labels` prop — props-driven portability,
// no inline copy in components. {title}/{n} interpolate. (Pass a localized `labels` map to translate.)
export const DEFAULT_LABELS: GraphLabels = {
  brand: "Memory",
  heroTitle: "Memory Graph",
  heroSubtitle: "Memory, agent, skill & tool",
  addPlaceholder: "Add memory",
  addUnder: "Add memory under {title}",
  subnodeOf: "Subnode of:",
  importLabel: "Import",
  hint: "LLMs can be wrong and calls use credit",
  help: "Drag the canvas to pan · Scroll to zoom · Hover a node for the Add button · Drag nodes · Right panel controls filter/display/forces · Press / to add · Esc to reset",
  inspectorEmpty: "Click a memory, cluster, agent, skill, or tool to see details.",
  inspectFocus: "Focus",
  inspectAddChild: "Add child",
  inspectClose: "Close",
  inspectPin: "Pin",
  inspectUnpin: "Unpin",
  inspectDelete: "Delete",
  linksTitle: "Links",
  mentionHint: "Type @ or / to link a node",
  toastDeleted: "Memory deleted",
  toastPinned: "Pinned",
  toastUnpinned: "Unpinned",
  filters: "Filter",
  searchPlaceholder: "Search nodes…",
  tags: "Tags",
  attachments: "Attachments",
  existingOnly: "Existing only",
  orphans: "Orphans",
  groups: "Groups",
  display: "Display",
  arrows: "Arrows",
  textFade: "Text fade threshold",
  nodeSize: "Node size",
  linkThickness: "Link thickness",
  animate: "Animate",
  animateStop: "Stop animation",
  forces: "Forces",
  centerForce: "Center force",
  repelForce: "Repel force",
  linkForce: "Link force",
  linkDistance: "Link distance",
  reset: "Reset",
  toastAdded: "Memory added",
  toastSubAdded: "Sub-memory added",
  toastImported: "{n} memories imported",
  toastReset: "Controls reset",
  toastAddSub: "Add sub-memory",
  addMemoryLabel: "Add memory",
};

export const DEFAULT_SETTINGS: GraphSettings = {
  arrows: false,
  textFade: 42,
  nodeSize: 100,
  linkThickness: 100,
  animate: false,
  centerForce: 47,
  repelForce: 56,
  linkForce: 96,
  linkDistance: 170,
};

// groups is seeded from the actual clusters at runtime (all visible) — see use-graph-state.
export const DEFAULT_FILTERS: Omit<GraphFilters, "groups"> = {
  query: "",
  tags: false,
  attachments: true,
  existingOnly: true,
  orphans: true,
};

export const TYPE_LABEL: Record<NodeType, string> = {
  core: "Core",
  cluster: "Cluster",
  memory: "Memory",
  agent: "Agent",
  skill: "Skill",
  tool: "Tool",
};

export const WORLD = { width: 1600, height: 1000, cx: 800, cy: 500 } as const;
