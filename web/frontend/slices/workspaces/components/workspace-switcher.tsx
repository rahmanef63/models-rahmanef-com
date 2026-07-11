"use client";
// Workspace switcher — a dropdown in the app sidebar. Lists my workspaces + a "new workspace" action
// that opens the shared ResponsiveDialog (was a native window.prompt). An individual just sees "Personal".
import { useState } from "react";
import { useWorkspace } from "../context";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ResponsiveDialog } from "@/app/app/_components/responsive-dialog";

export function WorkspaceSwitcher() {
  const { workspaceId, workspaces, switchTo, ready } = useWorkspace();
  const create = useMutation(api.workspaces.create);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) return null;

  function onChange(value: string) {
    if (value === "__new") { setName(""); setCreating(true); return; } // select is controlled → snaps back to the active ws
    switchTo(value);
  }
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { switchTo((await create({ name: name.trim() })) as unknown as string); setCreating(false); }
    finally { setBusy(false); }
  }

  return (
    <>
      <select className="ws-switcher mono" value={workspaceId ?? ""} onChange={(e) => onChange(e.target.value)} title="Active workspace" style={{ width: "100%", marginBottom: "0.6rem" }}>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>{w.personal ? "🏠 Personal" : w.name}{!w.personal && w.role !== "owner" ? ` · ${w.role}` : ""}</option>
        ))}
        <option value="__new">+ New workspace…</option>
      </select>
      <ResponsiveDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New workspace"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setCreating(false)}>Batal</button>
            <button type="button" className="btn accent" disabled={busy || !name.trim()} onClick={() => void submit()}>{busy ? "…" : "Create"}</button>
          </>
        }
      >
        <p className="sub" style={{ margin: "0 0 0.7rem" }}>A team/org workspace — invite people and share provider keys.</p>
        <input autoFocus placeholder="workspace name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} style={{ width: "100%" }} />
      </ResponsiveDialog>
    </>
  );
}
