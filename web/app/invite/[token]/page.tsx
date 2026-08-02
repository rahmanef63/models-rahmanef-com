"use client";
// Workspace invite accept page. Bearer link (the token IS the secret). Shows who/what, then once
// the visitor is signed in, accepts + switches into the workspace. Not signed in → point them at
// /app to sign in, then reopen this same link.
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const info = useQuery(api.workspaceInvites.inviteInfo, { token });
  const accept = useMutation(api.workspaceInvites.acceptInvite);
  const setActive = useMutation(api.settings.setActiveWorkspace);
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || info == null || busy) return;
    setBusy(true);
    (async () => {
      try {
        const wsId = await accept({ token });
        await setActive({ workspaceId: wsId });
        router.replace("/app");
      } catch (e) {
        setErr((e as { data?: { detail?: string } })?.data?.detail ?? "Could not accept this invite.");
        setBusy(false);
      }
    })();
  }, [isLoading, isAuthenticated, info, busy, accept, setActive, token, router]);

  return (
    <main className="app-main">
      <div className="app-top"><Link href="/" className="brand">models<b>.</b></Link></div>
      <section className="card" style={{ maxWidth: 460, margin: "3rem auto" }}>
        <h2>Workspace invite</h2>
        {info === undefined ? (
          <p className="muted mono">…</p>
        ) : info === null ? (
          <p className="sub">This invite link is invalid, expired, or already used. Ask an admin for a new one.</p>
        ) : (
          <>
            <p className="sub">You're invited to join <b>{info.workspaceName}</b> as <span className="badge">{info.role}</span>.</p>
            {err && <p className="mono" style={{ color: "var(--danger)" }}>{err}</p>}
            {isLoading ? (
              <p className="muted mono">…</p>
            ) : isAuthenticated ? (
              <p className="muted mono">{busy ? "joining…" : "accepting…"}</p>
            ) : (
              <>
                <p className="muted mono" style={{ fontSize: ".82rem" }}>This link is a bearer secret — don't share it.</p>
                <Link className="btn accent" href="/app">Sign in to accept →</Link>
                <p className="sub" style={{ marginTop: ".6rem" }}>After signing in, reopen this link to join.</p>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
