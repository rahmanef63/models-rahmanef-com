"use client";

// Floating "@agent" picker shown while the user is mid-mention in a chat input. Pure/presentational
// — no Convex calls, no keyboard nav (click-only is a deliberate scope cut, not an oversight; the
// caller owns positioning via the `mention-menu` class hook).
export type MentionAgent = { id: string; name: string; model: string };

export function AgentMentionPicker({ agents, query, onPick }: {
  agents: MentionAgent[];
  query: string;
  onPick: (agentId: string) => void;
}) {
  const q = query.toLowerCase();
  const matches = agents.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) return null;

  return (
    <div className="dropdown-menu mention-menu">
      {matches.map((a) => (
        <button key={a.id} className="link" onClick={() => onPick(a.id)}>
          <strong>@{a.name}</strong> <span className="muted mono" style={{ fontSize: ".7rem" }}>{a.model}</span>
        </button>
      ))}
    </div>
  );
}
