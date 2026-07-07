"use client";

// Node-detail inspector panel — presentational, props-driven (no inline copy, no Convex).
// Classes come verbatim from config/graph-styles.ts (.mg-inspector*, .mg-ghost-btn).
import { type GraphLabels, type GraphNode } from "../types";
import { TYPE_LABEL } from "../config/defaults";

export function Inspector({ labels, node, open, onFocus, onAddChild, onClose }: {
  labels: GraphLabels;
  node: GraphNode | null;
  open: boolean;
  onFocus: () => void;
  onAddChild: () => void;
  onClose: () => void;
}) {
  return (
    <aside className={`mg-inspector ${open ? "open" : ""}`} aria-live="polite">
      <div className="mg-inspector-kicker">{node ? TYPE_LABEL[node.type] : "Node"}</div>
      <h2>{node ? node.title : labels.brand}</h2>
      <p>{node?.body || labels.inspectorEmpty}</p>
      {node?.tags?.length ? (
        <p style={{ marginTop: 8, color: "#8d8e94", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
          {node.tags.map((t) => `#${t}`).join("  ")}
        </p>
      ) : null}
      <div className="mg-inspector-actions">
        <button className="mg-ghost-btn" onClick={onFocus}>{labels.inspectFocus}</button>
        <button className="mg-ghost-btn" onClick={onAddChild}>{labels.inspectAddChild}</button>
        <button className="mg-ghost-btn" onClick={onClose}>{labels.inspectClose}</button>
      </div>
    </aside>
  );
}
