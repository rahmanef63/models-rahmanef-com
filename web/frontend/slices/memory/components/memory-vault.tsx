"use client";
// Vault editor (main region) — edit one md/json doc, with Obsidian-style [[Title]] links + backlinks
// resolved over the whole vault (shares parseRefs/resolveRef with the graph so both agree). Create =
// noteId "new". Saving a new note calls back with its real id so the tree + editor stay in sync.
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { parseRefs, resolveRef } from "@/features/memory-graph";
import { errData } from "@/app/app/_components/shared";
import { type VaultNote, nameOf } from "./note-tree";

// outgoing links (this note's [[refs]] that resolve) + backlinks (notes whose body resolves to this).
function linksFor(note: VaultNote, all: VaultNote[]) {
  const nodes = all.map((n) => ({ id: n.id, title: n.title || n.text })) as never;
  const outIds = new Set(parseRefs(note.text).map((r) => resolveRef(r, nodes)).filter((id): id is string => !!id && id !== note.id));
  const out = all.filter((n) => outIds.has(n.id));
  const back = all.filter((n) => n.id !== note.id && parseRefs(n.text).some((r) => resolveRef(r, nodes) === note.id));
  return { out, back };
}

function LinkRow({ label, items, onOpen }: { label: string; items: VaultNote[]; onOpen: (id: string) => void }) {
  return (
    <div className="vault-linkrow">
      <span className="vault-linkrow-t mono muted">{label}</span>
      {items.map((n) => <button key={n.id} className="vault-chip" onClick={() => onOpen(n.id)}>{nameOf(n)}</button>)}
    </div>
  );
}

export function MemoryVault({ noteId, onOpen, onClosed }: {
  noteId: string | null;
  onOpen: (id: string) => void;
  onClosed: () => void;
}) {
  const notes = useQuery(api.memoryNotes.listNotes) as VaultNote[] | undefined;
  const upsert = useMutation(api.memoryNotes.upsertNote);
  const remove = useMutation(api.memory.removeMemory);
  const note = notes?.find((n) => n.id === noteId) ?? null;
  const creating = noteId === "new";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [format, setFormat] = useState("md");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // load selection into the editor; re-runs when a different note opens or the row changes upstream
  useEffect(() => {
    if (note) { setTitle(note.title); setBody(note.text); setFormat(note.format); }
    else if (creating) { setTitle(""); setBody(""); setFormat("md"); }
    setErr("");
  }, [noteId, note?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (noteId === null)
    return (
      <section className="card vault-empty">
        <h2>Vault</h2>
        <p className="sub">Pick a note on the left or start a new one. Notes are markdown or JSON documents; link them with <span className="mono">[[Title]]</span> and they wire up in the graph.</p>
      </section>
    );
  // note missing while a real id is selected = either just-created (query catching up) or deleted
  // elsewhere — a neutral dash covers both without a false "removed" flash right after Create.
  if (!creating && notes && !note)
    return <section className="card vault-empty"><p className="muted mono">…</p></section>;

  const links = note && notes ? linksFor(note, notes) : { out: [], back: [] };

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const id = await upsert({ id: note ? (note.id as never) : undefined, title, text: body, format });
      if (creating && id) onOpen(id as unknown as string);
    } catch (e) {
      const d = errData(e);
      setErr(typeof d === "string" ? d : d.detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card vault-editor">
      <div className="vault-bar">
        <input className="vault-title" placeholder="Untitled" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="vault-fmt">
          {["md", "json"].map((f) => (
            <button key={f} className={format === f ? "btn accent" : "btn"} style={{ fontSize: ".72rem" }} onClick={() => setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>
      <textarea
        className="vault-body mono"
        placeholder={format === "json" ? '{\n  "key": "value"\n}' : "# Notes\n\nLink another note with [[Its Title]]…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
      />
      {err && <p className="mono" style={{ color: "var(--danger)", fontSize: ".8rem", margin: ".3rem 0 0" }}>{err}</p>}
      <div className="vault-actions">
        <button className="btn accent" disabled={saving} onClick={() => void save()}>{saving ? "…" : creating ? "Create" : "Save"}</button>
        {note && <button className="btn" disabled={saving} onClick={async () => { await remove({ id: note.id as never }); onClosed(); }}>Delete</button>}
        <span className="mono muted" style={{ fontSize: ".72rem", marginLeft: "auto" }}>{body.length}/8000</span>
      </div>
      {note && (links.out.length > 0 || links.back.length > 0) && (
        <div className="vault-links">
          {links.out.length > 0 && <LinkRow label="Links →" items={links.out} onOpen={onOpen} />}
          {links.back.length > 0 && <LinkRow label="← Backlinks" items={links.back} onOpen={onOpen} />}
        </div>
      )}
    </section>
  );
}
