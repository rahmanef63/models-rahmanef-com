"use client";
// Members management for the active workspace. Admin+ can invite (bearer link, shown once),
// change roles, and remove members. A personal workspace has no members to manage.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "../context";

export function MembersCard() {
  const { workspaceId, role, personal } = useWorkspace();
  const members = useQuery(api.workspaces.listMembers, workspaceId ? { workspaceId: workspaceId as never } : "skip");
  const invites = useQuery(api.workspaceInvites.listInvites, workspaceId && !personal ? { workspaceId: workspaceId as never } : "skip");
  const createInvite = useMutation(api.workspaceInvites.createInvite);
  const revokeInvite = useMutation(api.workspaceInvites.revokeInvite);
  const updateRole = useMutation(api.workspaces.updateRole);
  const removeMember = useMutation(api.workspaces.removeMember);
  const transferOwnership = useMutation(api.workspaces.transferOwnership);
  const [link, setLink] = useState<string | null>(null);
  const isAdmin = role === "admin" || role === "owner";
  const isOwner = role === "owner";

  async function makeOwner(userId: string, label: string) {
    if (!window.confirm(`Make ${label} the owner? You'll become an admin and can't undo this yourself.`)) return;
    try { await transferOwnership({ workspaceId: workspaceId as never, userId: userId as never }); }
    catch (e) { window.alert((e as { data?: { detail?: string } })?.data?.detail ?? "Failed to transfer ownership"); }
  }

  if (personal) return <section className="card"><h2>Members</h2><p className="sub">Your personal workspace is just you. Create a team workspace (switcher, top-left) to invite people and share provider keys.</p></section>;

  async function invite() {
    const email = window.prompt("Email to invite (informational — the link is what grants access)") ?? "";
    const r = (window.prompt("Role: admin | member | viewer", "member") ?? "member").trim();
    try {
      const raw = await createInvite({ workspaceId: workspaceId as never, email, role: r });
      setLink(`${window.location.origin}/invite/${raw}`);
    } catch (e) { window.alert((e as { data?: { detail?: string } })?.data?.detail ?? "Failed to create invite"); }
  }

  return (
    <section className="card">
      <h2>Members</h2>
      <p className="sub">Everyone here shares this workspace's connected provider keys (per its credential policy) and its usage.</p>
      {isAdmin && <button className="btn accent" onClick={() => void invite()}>+ Invite by link</button>}
      {link && (
        <div className="device" style={{ marginTop: "0.8rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Copy now — a bearer link, shown once. Don't share publicly:</p>
          <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{link}</div>
        </div>
      )}
      <ul className="creds" style={{ marginTop: "1rem" }}>
        {(members ?? []).map((m) => (
          <li key={m.userId}>
            <span className="name">{m.name ?? m.email ?? String(m.userId).slice(0, 10)}</span>
            <span className="cred-actions">
              {isAdmin && m.role !== "owner" ? (
                <>
                  <select value={m.role} onChange={(e) => void updateRole({ workspaceId: workspaceId as never, userId: m.userId as never, role: e.target.value })}>
                    <option value="admin">admin</option><option value="member">member</option><option value="viewer">viewer</option>
                  </select>
                  {isOwner && <button className="link" onClick={() => void makeOwner(String(m.userId), m.name ?? m.email ?? "this member")}>make owner</button>}
                  <button className="link danger" onClick={() => void removeMember({ workspaceId: workspaceId as never, userId: m.userId as never })}>remove</button>
                </>
              ) : <span className="badge">{m.role}</span>}
            </span>
          </li>
        ))}
      </ul>
      {isAdmin && invites && invites.length > 0 && (
        <>
          <div className="picker-step mono muted" style={{ marginTop: "1rem" }}>pending invites</div>
          <ul className="creds">
            {invites.map((iv) => (
              <li key={iv.id}><span className="name mono" style={{ fontSize: ".8rem" }}>{iv.email || "(link)"} · {iv.role}</span><button className="link danger" onClick={() => void revokeInvite({ inviteId: iv.id as never })}>revoke</button></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
