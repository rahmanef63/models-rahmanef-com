"use client";
// Memory panel — the facts/preferences agents recall across sessions. Agents also write these
// automatically (the `memory` tool); this is the manual view: toggle injection, add, forget.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Mem = { id: string; text: string; kind: string; pinned: boolean; createdAt: number };

export function MemoryPanel() {
  const mems = useQuery(api.memory.listMemories) as Mem[] | undefined;
  const settings = useQuery(api.settings.mySettings) as { memoryEnabled?: boolean } | null | undefined;
  const add = useMutation(api.memory.addMemory);
  const remove = useMutation(api.memory.removeMemory);
  const setEnabled = useMutation(api.memory.setMemoryEnabled);
  const [text, setText] = useState("");
  const enabled = settings?.memoryEnabled !== false;

  return (
    <section className="card">
      <h2>Memory</h2>
      <p className="sub">Facts &amp; preferences your agents recall across every session. Agents save these automatically when you correct them or state a lasting preference.</p>
      <label className="row" style={{ alignItems: "center", gap: ".5rem", marginTop: ".4rem" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => void setEnabled({ enabled: e.target.checked })} />
        <span className="mono muted" style={{ fontSize: ".82rem" }}>inject recalled memory into chat</span>
      </label>
      <div className="row" style={{ marginTop: "1rem" }}>
        <input placeholder="add a memory (e.g. prefers TypeScript, no semicolons)" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn accent" disabled={!text.trim()} onClick={async () => { await add({ text: text.trim() }); setText(""); }}>Add</button>
      </div>
      {mems && mems.length > 0 ? (
        <ul className="creds" style={{ marginTop: "1rem" }}>
          {mems.map((m) => (
            <li key={m.id}><span className="name" style={{ fontSize: ".85rem" }}>{m.text}</span><button className="link danger" onClick={() => void remove({ id: m.id as never })}>forget</button></li>
          ))}
        </ul>
      ) : mems ? <p className="sub" style={{ marginTop: "1rem" }}>No memories yet — they'll appear as your agents learn.</p> : <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>}
    </section>
  );
}
