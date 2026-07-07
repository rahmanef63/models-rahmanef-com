"use client";
import { MemoryGraph } from "./memory-graph";
import { useGraphData } from "../hooks/use-graph-data";

// Wired entry point mounted by the dashboard. Binds this app's Convex data to the portable
// renderer. Props-less by default (like the other dashboard cards); `brand` retargets the wordmark.
export function MemoryGraphPanel({ brand = "Memory" }: { brand?: string }) {
  const { data, onAddMemory, onImport, onDeleteNode, onPinNode } = useGraphData(brand);
  return <MemoryGraph data={data} onAddMemory={onAddMemory} onImport={onImport} onDeleteNode={onDeleteNode} onPinNode={onPinNode} labels={{ brand }} />;
}
