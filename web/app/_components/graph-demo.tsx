"use client";
// Landing demo: the REAL <MemoryGraph> slice renderer fed SAMPLE_GRAPH (no Convex, no auth). Loaded
// browser-only via ssr:false so the static marketing page never server-renders the physics/canvas.
import dynamic from "next/dynamic";
import { SAMPLE_GRAPH } from "@/features/memory-graph";

const MemoryGraph = dynamic(() => import("@/features/memory-graph").then((m) => m.MemoryGraph), {
  ssr: false,
  loading: () => <div className="gd-loading">loading graph…</div>,
});

export function GraphDemo() {
  return <MemoryGraph data={SAMPLE_GRAPH} labels={{ brand: "models" }} />;
}
