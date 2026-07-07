"use client";

import { type NodeType } from "../types";
import { TYPE_LABEL } from "../config/defaults";

const TYPES = ["memory", "agent", "skill", "tool"] as const satisfies readonly NodeType[];

export function GraphLegend({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="mg-legend" aria-label="Legend">
      {TYPES.map((t) => (
        <div className="mg-legend-item" key={t}>
          <span className={`mg-legend-dot is-${t}`} aria-hidden />
          {TYPE_LABEL[t]}
          <b>{counts[t] ?? 0}</b>
        </div>
      ))}
    </div>
  );
}
