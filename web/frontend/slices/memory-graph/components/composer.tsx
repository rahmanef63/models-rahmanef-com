"use client";

// Bottom "add a memory" dock — presentational + CONTROLLED. The parent owns `value` and the
// `expanded` state; this component only renders and forwards intent up via callbacks. The textarea
// ref is forwarded so the parent can focus it (e.g. after clicking a node's hover-add button).
// Classes/state hooks (`expanded`, `has-context` on mg-dock) come from config/graph-styles.

import { forwardRef } from "react";
import { ICONS } from "../config/icons";
import { type GraphLabels } from "../types";

type ComposerProps = {
  labels: GraphLabels;
  expanded: boolean;
  contextTitle: string | null; // parent node title → shows the context chip; null = none
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void; // called on form submit / Enter (no shift)
  onFocus: () => void;
  onPlus: () => void;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { labels, expanded, contextTitle, value, onChange, onSubmit, onFocus, onPlus },
  ref,
) {
  return (
    <div className={`mg-dock ${expanded ? "expanded" : ""} ${contextTitle ? "has-context" : ""}`}>
      <div className="mg-context-chip">
        {labels.subnodeOf} {contextTitle}
      </div>
      <form
        className="mg-composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <button
          type="button"
          className="mg-round-btn mg-plus"
          onClick={onPlus}
          aria-label={labels.addMemoryLabel}
        >
          {ICONS.plus}
        </button>
        <div className="mg-input-wrap">
          <textarea
            ref={ref}
            className="mg-input"
            rows={1}
            value={value}
            placeholder={
              contextTitle ? labels.addUnder.replace("{title}", contextTitle) : labels.addPlaceholder
            }
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
        <button type="submit" className="mg-round-btn mg-send" aria-label={labels.addMemoryLabel}>
          {ICONS.send}
        </button>
      </form>
    </div>
  );
});
