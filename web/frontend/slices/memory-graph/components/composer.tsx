"use client";

// Bottom "add a memory" dock — CONTROLLED (parent owns value + expanded). Adds an @// mention
// picker: typing `@` or `/` at the end of the input opens a node list; picking one inserts
// `@[Title]`, which the graph turns into a link edge. Keyboard: ↑/↓ move, Enter/Tab pick, Esc close.
import { forwardRef, useState } from "react";
import { ICONS } from "../config/icons";
import { type GraphLabels, type MentionItem } from "../types";

const TRIGGER = /[@/]([^\s@/]*)$/; // a trigger char + query run at the caret-end of the value

type ComposerProps = {
  labels: GraphLabels;
  expanded: boolean;
  contextTitle: string | null;
  value: string;
  mentionItems: MentionItem[];
  onChange: (v: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  onPlus: () => void;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { labels, expanded, contextTitle, value, mentionItems, onChange, onSubmit, onFocus, onPlus },
  ref,
) {
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const m = dismissed ? null : TRIGGER.exec(value);
  const q = m ? m[1].toLowerCase() : null;
  const matches = q != null ? mentionItems.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 8) : [];
  const open = q != null && matches.length > 0;
  const act = Math.min(active, matches.length - 1);

  const change = (v: string) => { setDismissed(false); setActive(0); onChange(v); };
  const pick = (item: MentionItem) => { if (m) { change(value.slice(0, m.index) + `@[${item.title}] `); } };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(matches[act] ?? matches[0]); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setDismissed(true); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  return (
    <div className={`mg-dock ${expanded ? "expanded" : ""} ${contextTitle ? "has-context" : ""}`}>
      <div className="mg-context-chip">{labels.subnodeOf} {contextTitle}</div>
      <form className="mg-composer" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <button type="button" className="mg-round-btn mg-plus" onClick={onPlus} aria-label={labels.addMemoryLabel}>{ICONS.plus}</button>
        <div className="mg-input-wrap">
          {open && (
            <div className="mg-mention" role="listbox" aria-label={labels.mentionHint}>
              {matches.map((item, i) => (
                <button key={item.id} type="button" role="option" aria-selected={i === act}
                  className={`mg-mention-item ${i === act ? "active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(item); }}>
                  {item.title}<small>{item.type}</small>
                </button>
              ))}
            </div>
          )}
          <textarea ref={ref} className="mg-input" rows={1} value={value}
            placeholder={contextTitle ? labels.addUnder.replace("{title}", contextTitle) : labels.addPlaceholder}
            onChange={(e) => change(e.target.value)} onFocus={onFocus} onKeyDown={onKeyDown} />
        </div>
        <button type="submit" className="mg-round-btn mg-send" aria-label={labels.addMemoryLabel}>{ICONS.send}</button>
      </form>
    </div>
  );
});
