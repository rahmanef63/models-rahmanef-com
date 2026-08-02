"use client";
// Memory list rows + a per-scope budget bar. Extracted from MemoryPanel to keep both files small
// and let the list be reused (e.g. a read-only workspace view). Pure presentational.

export type Mem = { id: string; text: string; kind: string; pinned: boolean; createdAt: number };

export function BudgetBar({ used, budget }: { used: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const over = used > budget;
  return (
    <div style={{ marginTop: ".75rem" }}>
      <div className="mono muted" style={{ fontSize: ".78rem", marginBottom: ".25rem" }}>
        {pct}% — {used.toLocaleString()}/{budget.toLocaleString()} chars
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "var(--border, #2a2a2a)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? "var(--danger, #e5484d)" : "var(--accent, #6ee7b7)" }} />
      </div>
    </div>
  );
}

export function MemoryList({
  items, canForget, onForget, onTogglePin,
}: {
  items: Mem[];
  canForget: boolean;
  onForget: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}) {
  if (!items.length) return <p className="sub" style={{ marginTop: "1rem" }}>Nothing here yet.</p>;
  return (
    <ul className="creds" style={{ marginTop: "1rem" }}>
      {items.map((m) => (
        <li key={m.id}>
          <span className="name" style={{ fontSize: ".85rem" }}>
            {m.pinned ? "📌 " : ""}{m.text}
          </span>
          <span className="row" style={{ gap: ".5rem" }}>
            <button className="link" onClick={() => onTogglePin(m.id, !m.pinned)}>{m.pinned ? "unpin" : "pin"}</button>
            {canForget && <button className="link danger" onClick={() => onForget(m.id)}>forget</button>}
          </span>
        </li>
      ))}
    </ul>
  );
}
