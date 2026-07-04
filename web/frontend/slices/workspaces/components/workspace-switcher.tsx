"use client";
// Workspace switcher — a dropdown in the app sidebar. Lists my workspaces + a "new workspace"
// action (native prompt; ponytail — no custom dialog). An individual just sees "Personal".
import { useWorkspace } from "../context";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function WorkspaceSwitcher() {
  const { workspaceId, workspaces, switchTo, ready } = useWorkspace();
  const create = useMutation(api.workspaces.create);
  if (!ready) return null;

  async function onChange(value: string) {
    if (value === "__new") {
      const name = typeof window !== "undefined" ? window.prompt("New workspace name (a team/org)") : "";
      if (name && name.trim()) switchTo((await create({ name: name.trim() })) as unknown as string);
      return;
    }
    switchTo(value);
  }

  return (
    <select className="ws-switcher mono" value={workspaceId ?? ""} onChange={(e) => void onChange(e.target.value)} title="Active workspace" style={{ width: "100%", marginBottom: "0.6rem" }}>
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>{w.personal ? "🏠 Personal" : w.name}{!w.personal && w.role !== "owner" ? ` · ${w.role}` : ""}</option>
      ))}
      <option value="__new">+ New workspace…</option>
    </select>
  );
}
