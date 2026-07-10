"use client";
// Vault data-structure sidebar — the note tree rendered in the app's secondary sidebar. Groups the
// user's docs by scope (notes / facts / summaries) and lets you open one or start a new note.
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type VaultNote = {
  id: string; title: string; text: string; format: string;
  scope: string; kind: string; pinned: boolean; updatedAt: number;
};

const clip = (s: string) => (s.length > 30 ? s.slice(0, 30).trim() + "…" : s);
export const nameOf = (n: VaultNote) => n.title || clip(n.text) || "untitled";
const SCOPE_LABEL: Record<string, string> = { note: "Notes", user: "Facts", summary: "Summaries" };
const GROUPS = ["note", "user", "summary"] as const;

export function NoteTree({ selectedId, onOpen, onNew }: {
  selectedId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const notes = useQuery(api.memoryNotes.listNotes) as VaultNote[] | undefined;
  return (
    <div className="vault-tree">
      <button className="vault-new" onClick={onNew}>+ New note</button>
      {notes === undefined ? (
        <p className="muted mono vault-hint">…</p>
      ) : notes.length === 0 ? (
        <p className="muted vault-hint">Empty vault — start a note.</p>
      ) : (
        GROUPS.map((g) => {
          const rows = notes.filter((n) => n.scope === g);
          if (!rows.length) return null;
          return (
            <div className="vault-group" key={g}>
              <div className="vault-group-label">{SCOPE_LABEL[g] ?? g}</div>
              {rows.map((n) => (
                <button key={n.id} className={`vault-node ${selectedId === n.id ? "on" : ""}`} onClick={() => onOpen(n.id)}>
                  <span className="vault-node-ic mono">{n.format === "json" ? "{ }" : "#"}</span>
                  <span className="vault-node-t">{n.pinned ? "📌 " : ""}{nameOf(n)}</span>
                </button>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
