"use client";
// Memory panel — the facts/preferences/summaries agents recall across sessions. Scope tabs
// (user / workspace / summaries), a per-scope char-budget bar, add/forget, and pin/unpin. Agents
// also write user memories automatically (the `memory` tool); this is the manual view.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MemoryList, BudgetBar, type Mem } from "./memory-list";

type Scope = "user" | "workspace" | "summary";
type ListResult = { items: Mem[]; used: number; budget: number };
const TABS: { id: Scope; label: string }[] = [
  { id: "user", label: "User" },
  { id: "workspace", label: "Workspace" },
  { id: "summary", label: "Summaries" },
];

export function MemoryPanel({ workspaceId }: { workspaceId?: string }) {
  const [scope, setScope] = useState<Scope>("user");
  const settings = useQuery(api.settings.mySettings) as { memoryEnabled?: boolean; memoryAutoSummarize?: boolean } | null | undefined;
  const res = useQuery(api.memory.listMemories, { scope, workspaceId: workspaceId as never }) as ListResult | undefined;
  const add = useMutation(api.memory.addMemory);
  const remove = useMutation(api.memory.removeMemory);
  const pin = useMutation(api.memory.pinMemory);
  const setEnabled = useMutation(api.memory.setMemoryEnabled);
  const setSettings = useMutation(api.settings.setSettings);
  const [text, setText] = useState("");
  const enabled = settings?.memoryEnabled !== false;
  const autoSum = settings?.memoryAutoSummarize === true;
  const needsWs = scope === "workspace" && !workspaceId;

  return (
    <section className="card">
      <h2>Memory</h2>
      <p className="sub">Facts, preferences &amp; thread summaries your agents recall across sessions. Agents save user memories automatically when you correct them or state a lasting preference.</p>
      <label className="row" style={{ alignItems: "center", gap: ".5rem", marginTop: ".4rem" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => void setEnabled({ enabled: e.target.checked })} />
        <span className="mono muted" style={{ fontSize: ".82rem" }}>inject recalled memory into chat</span>
      </label>
      <label className="row" style={{ alignItems: "center", gap: ".5rem" }}>
        <input type="checkbox" checked={autoSum} onChange={(e) => void setSettings({ memoryAutoSummarize: e.target.checked })} />
        <span className="mono muted" style={{ fontSize: ".82rem" }}>auto-summarize long threads (off-turn, uses your model)</span>
      </label>

      <div className="row" style={{ gap: ".4rem", marginTop: "1rem" }}>
        {TABS.map((t) => (
          <button key={t.id} className={scope === t.id ? "btn accent" : "btn"} style={{ fontSize: ".8rem" }} onClick={() => setScope(t.id)}>{t.label}</button>
        ))}
      </div>

      {scope === "user" && (
        <div className="row" style={{ marginTop: "1rem" }}>
          <input placeholder="add a memory (e.g. prefers TypeScript, no semicolons)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn accent" disabled={!text.trim()} onClick={async () => { await add({ text: text.trim() }); setText(""); }}>Add</button>
        </div>
      )}

      {needsWs ? (
        <p className="sub" style={{ marginTop: "1rem" }}>Open a workspace to view its shared memory.</p>
      ) : res ? (
        <>
          <BudgetBar used={res.used} budget={res.budget} />
          <MemoryList
            items={res.items}
            canForget={true}
            onForget={(id) => void remove({ id: id as never })}
            onTogglePin={(id, pinned) => void pin({ id: id as never, pinned })}
          />
        </>
      ) : (
        <p className="muted mono" style={{ marginTop: "1rem" }}>…</p>
      )}
    </section>
  );
}
