"use client";

// Floating "/skill" picker shown while the user is mid-slash in a chat input. Sibling of
// AgentMentionPicker (same dropdown markup) — kept a separate file, not a generic one, because "@"
// and "/" carry different second-slot metadata (model vs description) and different prefixes.
export type MentionSkill = { id: string; label: string; description: string };

export function SkillMentionPicker({ skills, query, onPick }: {
  skills: MentionSkill[];
  query: string;
  onPick: (skillId: string) => void;
}) {
  const q = query.toLowerCase();
  const matches = skills.filter((s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)).slice(0, 8);
  if (matches.length === 0) return null;

  return (
    <div className="dropdown-menu mention-menu">
      {matches.map((s) => (
        <button key={s.id} className="link" onClick={() => onPick(s.id)}>
          <strong>/{s.label}</strong> <span className="muted mono" style={{ fontSize: ".7rem" }}>{s.description}</span>
        </button>
      ))}
    </div>
  );
}
