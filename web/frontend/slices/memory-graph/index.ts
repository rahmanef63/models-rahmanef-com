// memory-graph slice public barrel (memory-graph v0.2.0). Obsidian-style force-directed graph over
// memories + agents + skills + tools. Portable <MemoryGraph> renderer + wired <MemoryGraphPanel>.
export { MemoryGraph } from "./components/memory-graph";
export { MemoryGraphPanel } from "./components/memory-graph-panel";
export { useGraphData } from "./hooks/use-graph-data";
export { SAMPLE_GRAPH } from "./examples/sample-graph";
// link resolution (shared with the memory vault so both agree on what a [[Title]] link is)
export { parseRefs, resolveRef, resolveBodyLinks } from "./lib/graph-links";
export type { GraphData, GraphNode, GraphEdge, NodeType, ClusterDef, MemoryGraphProps, GraphLabels } from "./types";
