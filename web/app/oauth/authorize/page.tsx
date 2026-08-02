"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConvexAuth, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-main">
      <div className="app-top"><span className="brand">models<b>.</b></span></div>
      <section className="card narrow" style={{ margin: "3rem auto" }}>{children}</section>
    </main>
  );
}

export default function AuthorizePage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => { setQ(new URLSearchParams(window.location.search)); }, []);
  if (!q) return <Shell><p className="muted mono">…</p></Shell>;

  const clientId = q.get("client_id") || "";
  const redirectUri = q.get("redirect_uri") || "";
  const codeChallenge = q.get("code_challenge") || "";
  const method = q.get("code_challenge_method") || "";
  const state = q.get("state") || "";
  const scope = q.get("scope") || "mcp";
  const responseType = q.get("response_type") || "";

  // Validate the request BEFORE touching redirect_uri (no open redirect on a malformed request).
  const bad = responseType !== "code" || method !== "S256" || !codeChallenge || !clientId || !redirectUri;

  return (
    <Inner {...{ isLoading, isAuthenticated, clientId, redirectUri, codeChallenge, method, state, scope, bad }} />
  );
}

function Inner(p: {
  isLoading: boolean; isAuthenticated: boolean; clientId: string; redirectUri: string;
  codeChallenge: string; method: string; state: string; scope: string; bad: boolean;
}) {
  const client = useQuery(api.mcpOauth.clientInfo, p.bad ? "skip" : { clientId: p.clientId });
  const createAuthCode = useAction(api.mcpOauthNode.createAuthCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selfHost = typeof window !== "undefined" ? window.location.host : "";

  if (p.bad) return <Shell><h2>Invalid request</h2><p className="err">Needs response_type=code, PKCE code_challenge_method=S256, client_id, and redirect_uri.</p></Shell>;
  if (p.isLoading) return <Shell><p className="muted mono">…</p></Shell>;
  if (!p.isAuthenticated) return <Shell><h2>Sign in required</h2><p className="sub">Sign in to {selfHost || "your account"}, then reopen this authorization link.</p><Link className="btn accent" href="/app">Go to sign in</Link></Shell>;
  if (client === undefined) return <Shell><p className="muted mono">…</p></Shell>;
  if (client === null || !client.redirectUris.includes(p.redirectUri)) return <Shell><h2>Cannot authorize</h2><p className="err">Unknown client or the redirect_uri is not registered for it.</p></Shell>;

  async function approve() {
    setBusy(true); setErr("");
    try {
      const { code } = await createAuthCode({ clientId: p.clientId, redirectUri: p.redirectUri, codeChallenge: p.codeChallenge, codeChallengeMethod: p.method, scope: p.scope });
      const u = new URL(p.redirectUri);
      u.searchParams.set("code", code);
      if (p.state) u.searchParams.set("state", p.state);
      window.location.href = u.toString();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function deny() {
    const u = new URL(p.redirectUri);
    u.searchParams.set("error", "access_denied");
    if (p.state) u.searchParams.set("state", p.state);
    window.location.href = u.toString();
  }

  let destHost = "";
  try { destHost = new URL(p.redirectUri).host; } catch { /* validated as registered above */ }
  return (
    <Shell>
      <h2>Authorize an MCP connection</h2>
      <p className="sub">
        An app calling itself <b>“{client.name}”</b> <span className="muted">(self-reported, unverified)</span> wants to connect to your {selfHost || "gateway"}
        (scope <span className="mono">{p.scope}</span>).
      </p>
      <div className="mcp-endpoint mono" style={{ marginBottom: "0.6rem" }}>access code will be sent to → {destHost || p.redirectUri}</div>
      <p className="sub">
        If you approve, it can list your providers, view your usage, and chat using <b>your own BYOK keys</b> until you revoke it (Dashboard → MCP). It never sees your keys.
        <b> Only approve if you recognise the destination above.</b>
      </p>
      <div className="row">
        <button className="btn accent" disabled={busy} onClick={approve}>{busy ? "…" : "Approve"}</button>
        <button className="btn" disabled={busy} onClick={deny}>Deny</button>
      </div>
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}
