// The error-rendering path every mutation-heavy card (providers, agents, chat) funnels failures
// through. A ConvexError from an action arrives with its real payload in `.data` — either a plain
// string (e.g. "Please sign in.") or the structured {code,status,detail,provider,model} a model-call
// failure throws. Plain (non-Convex) errors fall back to `.message`.
//
// Provider-agnostic on purpose: display names are INJECTED via `labels` (byok owns PROVIDER_LABEL),
// so `core` never depends on the provider catalog and stays portable.

export type ChatErrData = { code: string; status?: number; detail: string; provider?: string; model?: string };

export function errData(e: unknown): ChatErrData | string {
  const d = (e as { data?: unknown })?.data;
  if (d && typeof d === "object") return d as ChatErrData;
  if (typeof d === "string" && d) return d;
  return e instanceof Error ? e.message : String(e);
}

// non-admin message per error code — no raw provider text, just what the user can act on.
export const FRIENDLY: Record<string, (provider: string) => string> = {
  not_connected: (p) => `${p} isn't connected — add it in the Providers tab.`,
  invalid_api_key: (p) => `Your ${p} API key was rejected — check it in the Providers tab.`,
  rate_limited: (p) => `${p} is rate-limiting requests right now — try again shortly.`,
  quota_exceeded: (p) => `${p} says this key is out of credit or quota.`,
  not_found: (p) => `This model isn't available from ${p} — try a different one.`,
  unreachable: (p) => `Couldn't reach ${p} — check the endpoint URL and that the host is online.`,
  invalid_request: (p) => `${p} couldn't process this request — try a different model.`,
  provider_error: (p) => `${p} had a problem handling this request. Try again.`,
  internal: () => `Something went wrong on our side. Try again, or ask an admin.`,
};

export function ErrorLine({ e, isAdmin, labels }: { e: unknown; isAdmin: boolean; labels?: Record<string, string> }) {
  const d = errData(e);
  const label = (p: string) => labels?.[p] ?? p;
  // the friendly headline: a plain-string error / our own validation error (no `provider`) is shown
  // verbatim; a real provider/model-call failure runs through the FRIENDLY table so non-admins get
  // something actionable instead of raw provider text.
  const headline = typeof d === "string" ? d : !d.provider ? d.detail : (FRIENDLY[d.code] ?? FRIENDLY.internal)(label(d.provider));
  // the FULL error, always available to copy — the isAdmin gate is UX-only, not access control
  // (the whole payload is already in the client's own response regardless).
  const full = typeof d === "string" ? d : JSON.stringify(d, null, 2);
  const adminLine = typeof d !== "string" && d.provider ? `${d.code}${d.status != null ? ` · ${d.status}` : ""}${d.model ? ` · ${d.model}` : ""} · ${d.detail}` : null;
  return (
    <div className="err">
      <span>{headline}</span>
      {isAdmin && adminLine && <span className="mono muted" style={{ display: "block", fontSize: ".72rem", marginTop: ".3rem" }}>{adminLine}</span>}
      <ErrCopy full={full} />
    </div>
  );
}

// copyable full-error panel — a collapsed <details> so it never shouts, with the raw payload
// selectable inside and a one-click copy. No hooks (stays safe in any import graph); the button
// swaps its own label on click.
function ErrCopy({ full }: { full: string }) {
  return (
    <details style={{ marginTop: ".3rem" }}>
      <summary className="link" style={{ fontSize: ".72rem", padding: 0, minHeight: 0, listStyle: "revert" }}>details / copy</summary>
      <pre className="mono muted" style={{ whiteSpace: "pre-wrap", overflowX: "auto", fontSize: ".7rem", margin: ".3rem 0 0", maxHeight: "12rem" }}>{full}</pre>
      <button
        type="button"
        className="link"
        style={{ fontSize: ".72rem", padding: 0, minHeight: 0 }}
        onClick={(ev) => { void navigator.clipboard?.writeText(full); const b = ev.currentTarget; const t = b.textContent; b.textContent = "copied ✓"; setTimeout(() => { b.textContent = t; }, 1500); }}
      >copy error</button>
    </details>
  );
}
