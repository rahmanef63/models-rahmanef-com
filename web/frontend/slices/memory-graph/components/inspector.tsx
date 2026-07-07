"use client";

// Node-detail inspector — presentational, props-driven. Shows the node body, tags, its outgoing
// links (clickable → navigate), and actions. Pin/Delete appear only for real memory nodes; agents/
// skills/tools are read-only mirrors of other data. Classes from config/graph-styles.
import { type GraphLabels, type GraphNode, type MentionItem } from "../types";
import { TYPE_LABEL } from "../config/defaults";

const LEAF = new Set(["memory", "agent", "skill", "tool"]);

export function Inspector({ labels, node, links, open, onFocus, onAddChild, onPin, onDelete, onNavigate, onClose }: {
  labels: GraphLabels;
  node: GraphNode | null;
  links: MentionItem[];
  open: boolean;
  onFocus: () => void;
  onAddChild: () => void;
  onPin: (node: GraphNode, pinned: boolean) => void;
  onDelete: (node: GraphNode) => void;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  // agents/skills/tools are read-only mirrors; a not-yet-persisted optimistic node (local-*) has no
  // server row to pin/delete, so hide those actions until the refetch turns it into a real mem-*.
  const editable = node?.type === "memory" && node.existing !== false && !node.id.startsWith("local-");
  return (
    <aside className={`mg-inspector ${open ? "open" : ""}`} aria-live="polite">
      <div className="mg-inspector-kicker">
        {node && LEAF.has(node.type) && <span className={`mg-legend-dot is-${node.type}`} aria-hidden />}
        {node ? TYPE_LABEL[node.type] : "Node"}
      </div>
      <h2>{node ? node.title : labels.brand}</h2>
      <p>{node?.body || labels.inspectorEmpty}</p>
      {node?.tags?.length ? <p className="mg-tags">{node.tags.map((t) => `#${t}`).join("  ")}</p> : null}
      {links.length > 0 && (
        <div className="mg-links">
          <span className="mg-links-h">{labels.linksTitle}</span>
          {links.map((l) => (
            <button key={l.id} className={`mg-link-chip is-${l.type}`} onClick={() => onNavigate(l.id)}>
              <span className={`mg-legend-dot is-${l.type}`} aria-hidden />{l.title}
            </button>
          ))}
        </div>
      )}
      <div className="mg-inspector-actions">
        {node && <button className="mg-ghost-btn" onClick={onFocus}>{labels.inspectFocus}</button>}
        {node && <button className="mg-ghost-btn" onClick={onAddChild}>{labels.inspectAddChild}</button>}
        {editable && node && <button className="mg-ghost-btn" onClick={() => onPin(node, !node.pinned)}>{node.pinned ? labels.inspectUnpin : labels.inspectPin}</button>}
        {editable && node && <button className="mg-ghost-btn danger" onClick={() => onDelete(node)}>{labels.inspectDelete}</button>}
        <button className="mg-ghost-btn" onClick={onClose}>{labels.inspectClose}</button>
      </div>
    </aside>
  );
}
