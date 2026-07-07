"use client";
import { forwardRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { type GraphNode } from "../types";
import { iconFor } from "../config/icons";

type NodeHandlers = {
  onNodePointerDown: (e: ReactPointerEvent, id: string) => void;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onHoverLeave: () => void;
};

// The node layer. React renders one button per visible node (structural); the engine moves them by
// writing --x/--y. Node TYPE drives the visual: core = orb, cluster = icon hub, else a pill whose
// coloured dot (is-memory/agent/skill/tool) is what makes agents/skills/tools legible at a glance.
export const GraphNodes = forwardRef<HTMLDivElement, { nodes: GraphNode[]; selected: string | null } & NodeHandlers>(
  function GraphNodes({ nodes, selected, ...h }, ref) {
    return (
      <div className="mg-node-layer" ref={ref}>
        {nodes.map((node) => (
          <NodeButton key={node.id} node={node} active={selected === node.id} {...h} />
        ))}
      </div>
    );
  }
);

function NodeButton({ node, active, onNodePointerDown, onSelect, onHover, onHoverLeave }: { node: GraphNode; active: boolean } & NodeHandlers) {
  const style = { "--x": `${node.x ?? 0}px`, "--y": `${node.y ?? 0}px` } as CSSProperties;
  const common = {
    "data-id": node.id,
    style,
    onPointerDown: (e: ReactPointerEvent) => onNodePointerDown(e, node.id),
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onSelect(node.id); },
    onPointerEnter: () => onHover(node.id),
    onPointerLeave: onHoverLeave,
  };
  if (node.type === "core") return <button className="mg-node mg-core" {...common} aria-label={node.title} />;
  if (node.type === "cluster")
    return <button className={`mg-node mg-hub ${active ? "active" : ""}`} {...common} aria-label={node.title}>{iconFor(node)}</button>;
  return (
    <button className={`mg-node mg-pill is-${node.type} ${active ? "active" : ""}`} {...common} data-tags={node.tags?.length ? "true" : "false"} title={node.title}>
      <span className="mg-dot" aria-hidden />
      <span className="mg-tag-dot" aria-hidden />
      {node.title}
    </button>
  );
}
