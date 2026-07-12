"use client";
// Members management for the active workspace. Admin+ can invite (bearer link, shown once), change
// roles, and remove members. Invite + all destructive actions go through the shared dialogs (were
// native window.prompt / confirm). A personal workspace has no members to manage.
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "../context";
import { ResponsiveDialog, ConfirmDialog } from "@/app/app/_components/responsive-dialog";

type Confirm = { title: string; message: string; run: () => unknown };

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const isAdmin = role === "admin" || role === "owner";
  const isOwner = role === "owner";

  if (personal) return <section className="card"><h2>Members</h2><p className="sub">Your personal workspace is just you. Create a team workspace (switcher, top-left) to invite people and share provider keys.</p></section>;

  async function submitInvite() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const raw = await createInvite({ workspaceId: workspaceId as never, email, role: inviteRole });
      setLink(`${window.location.origin}/invite/${raw}`);
      setInviteOpen(false); setEmail("");
    } catch (e) { setErr((e as { data?: { detail?: string } })?.data?.detail ?? "Failed to create invite"); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2>Members</h2>
      <p className="sub">Everyone here shares this workspace's connected provider keys (per its credential policy) and its usage.</p>
      {isAdmin && <button className="btn accent" onClick={() => { setEmail(""); setInviteRole("member"); setErr(null); setInviteOpen(true); }}>+ Invite by link</button>}
      {link && (
        <div className="device" style={{ marginTop: "0.8rem" }}>
          <p className="mono muted" style={{ fontSize: ".78rem" }}>Copy now — a bearer link, shown once. Don't share publicly:</p>
          <div className="devicecode" style={{ fontSize: ".8rem", letterSpacing: "normal", wordBreak: "break-all" }}>{link}</div>
        </div>
      )}
      <ul className="creds" style={{ marginTop: "1rem" }}>
        {(members ?? []).map((m) => {
          const label = m.name ?? m.email ?? "this member";
          return (
            <li key={m.userId}>
              <span className="name">{m.name ?? m.email ?? String(m.userId).slice(0, 10)}</span>
              <span className="cred-actions">
                {isAdmin && m.role !== "owner" ? (
                  <>
                    <select value={m.role} onChange={(e) => void updateRole({ workspaceId: workspaceId as never, userId: m.userId as never, role: e.target.value })}>
                      <option value="admin">admin</option><option value="member">member</option><option value="viewer">viewer</option>
                    </select>
                    {isOwner && <button className="link" onClick={() => setConfirm({ title: "Transfer ownership?", message: `Make ${label} the owner? You'll become an admin and can't undo this yourself.`, run: () => transferOwnership({ workspaceId: workspaceId as never, userId: m.userId as never }) })}>make owner</button>}
                    <button className="link danger" onClick={() => setConfirm({ title: "Remove member?", message: `Remove ${label} from this workspace?`, run: () => removeMember({ workspaceId: workspaceId as never, userId: m.userId as never }) })}>remove</button>
                  </>
                ) : <span className="badge">{m.role}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {isAdmin && invites && invites.length > 0 && (
        <>
          <div className="picker-step mono muted" style={{ marginTop: "1rem" }}>pending invites</div>
          <ul className="creds">
            {invites.map((iv) => (
              <li key={iv.id}>
                <span className="name mono" style={{ fontSize: ".8rem" }}>{iv.email || "(link)"} · {iv.role}</span>
                <button className="link danger" onClick={() => setConfirm({ title: "Revoke invite?", message: `Revoke the invite for ${iv.email || "(link)"}?`, run: () => revokeInvite({ inviteId: iv.id as never }) })}>revoke</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ResponsiveDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite by link"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button type="button" className="btn accent" disabled={busy} onClick={() => void submitInvite()}>{busy ? "…" : "Create link"}</button>
          </>
        }
      >
        <p className="sub" style={{ margin: "0 0 0.7rem" }}>The link is what grants access — email is informational.</p>
        <label className="hint">Email (optional)</label>
        <input placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", margin: "0.3rem 0 0.7rem" }} />
        <label className="hint">Role</label>
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ width: "100%", marginTop: "0.3rem" }}>
          <option value="admin">admin</option><option value="member">member</option><option value="viewer">viewer</option>
        </select>
        {err && <p className="mono danger" style={{ fontSize: ".8rem", marginTop: ".5rem" }}>{err}</p>}
      </ResponsiveDialog>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => { void confirm?.run(); }} title={confirm?.title ?? ""} message={confirm?.message} confirmLabel="Ya" />
    </section>
  );
}
