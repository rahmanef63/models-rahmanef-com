"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

// Unauthenticated surface — email/password sign-in + sign-up flip. Lives on the marketing-style
// centered card (not the workspace shell), so it stays on the `.app-main` container.
export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);
        try { await signIn("password", { email, password, flow }); }
        catch { setErr(flow === "signUp" ? "sign-up failed — weak password or email taken" : "sign-in failed"); }
        finally { setBusy(false); }
      }}
    >
      <h2>{flow === "signIn" ? "Sign in" : "Create account"}</h2>
      <p className="sub">Your credentials are scoped to you alone.</p>
      <input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="btn accent" type="submit" disabled={busy}>{busy ? "…" : flow === "signIn" ? "Sign in" : "Sign up"}</button>
      <button type="button" className="link" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}
