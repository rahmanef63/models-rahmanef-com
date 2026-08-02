"use client";
import { forwardRef } from "react";
import { type GraphNode, type GraphEdge } from "../types";

// SVG edge layer. Lines carry data-a/data-b so the engine can rewrite their coords imperatively on
// every physics/drag frame; React only re-renders when the visible edge SET changes. `hover` draws
// the dashed ghost edge to the pending add-child position.
export const GraphEdges = forwardRef<SVGSVGElement, {
  edges: GraphEdge[];
  byId: (id: string) => GraphNode | undefined;
  selected: string | null;
  arrows: boolean;
  hover: { x: number; y: number; parent: GraphNode } | null;
}>(function GraphEdges({ edges, byId, selected, arrows, hover }, ref) {
  return (
    <svg className="mg-edges" ref={ref} viewBox="0 0 1600 1000" aria-hidden>
      {arrows && (
        <defs>
          <marker id="mg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" style={{ fill: "var(--mg-line-2)" }} />
          </marker>
          <marker id="mg-arrow-hot" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" style={{ fill: "var(--mg-accent)" }} />
          </marker>
        </defs>
      )}
      {edges.map((e) => {
        const a = byId(e.from), b = byId(e.to);
        if (!a || !b) return null;
        const hot = !!selected && (e.from === selected || e.to === selected);
        const cls = hot ? "hot" : e.kind === "link" ? "link" : "";
        return (
          <line
            key={`${e.from}|${e.to}`}
            data-a={e.from}
            data-b={e.to}
            className={cls}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            markerEnd={arrows ? `url(#${hot ? "mg-arrow-hot" : "mg-arrow"})` : undefined}
          />
        );
      })}
      {hover && <line className="temp" x1={hover.parent.x} y1={hover.parent.y} x2={hover.x} y2={hover.y} />}
    </svg>
  );
});
