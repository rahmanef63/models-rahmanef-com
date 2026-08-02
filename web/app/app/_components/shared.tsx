// Cross-cutting types + helpers used by 3+ dashboard sections — provider labels, the shared
// Cred/Catalog shapes, number formatting, and the error-rendering path every mutation-heavy
// card (providers, agents, chat) funnels failures through.
export const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "OpenAI · ChatGPT / Codex",
  "anthropic-oauth": "Claude · Pro / Max",
  "github-copilot": "GitHub Copilot · subscription",
  openrouter: "OpenRouter",
  openai: "OpenAI API",
  anthropic: "Anthropic",
  google: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  xai: "xAI",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  togetherai: "Together AI",
  "fireworks-ai": "Fireworks",
  cerebras: "Cerebras",
  perplexity: "Perplexity",
  deepinfra: "DeepInfra",
  nebius: "Nebius",
  hyperbolic: "Hyperbolic",
  sambanova: "SambaNova",
  novita: "Novita",
  cohere: "Cohere",
  glm: "Zhipu GLM",
  "github-models": "GitHub Models",
  "vercel-gateway": "Vercel AI Gateway",
  "moonshotai-cn": "Moonshot (China)",
  nvidia: "NVIDIA NIM",
  huggingface: "Hugging Face",
  alibaba: "Alibaba Qwen",
  siliconflow: "SiliconFlow",
  "ollama-cloud": "Ollama Cloud",
  xiaomi: "Xiaomi MiMo",
  baseten: "Baseten",
  "nano-gpt": "NanoGPT",
  zenmux: "ZenMux",
};

export type Cred = { provider: string; kind: string; models?: string[]; keyCount?: number; lastCheckedAt?: number; lastCheckedOk?: boolean; lastCheckedCode?: string; lastCheckedDetail?: string };
export type Catalog = Record<string, { models?: Record<string, unknown> }>;

export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
export const SUPPORTED = 32; // key-paste providers (openai/anthropic/google/openrouter + 28 OpenAI-compatible); OAuth (codex/claude/copilot) + custom endpoints on top

// relative "3m ago" — admin lists (users, activity) show elapsed time next to the absolute instant.
export const ago = (t: number) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
// absolute local "2026-07-10 14:32" — the "detail the exact hour a user signed up" ask.
export const dt = (t: number) => {
  const d = new Date(t), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ConvexError from an action arrives with the real payload in `.data` — either a plain string
// (e.g. "Please sign in.") or the structured {code,status,detail,provider,model} chat.ts throws
// for a model-call failure. Plain (non-Convex) errors fall back to `.message`.
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
export function ErrorLine({ e, isAdmin }: { e: unknown; isAdmin: boolean }) {
  const d = errData(e);
  // the friendly headline: a plain-string error / our own validation error (no `provider`) is shown
  // verbatim; a real provider/model-call failure runs through the FRIENDLY table so non-admins get
  // something actionable instead of raw provider text.
  const headline = typeof d === "string" ? d : !d.provider ? d.detail : (FRIENDLY[d.code] ?? FRIENDLY.internal)(PROVIDER_LABEL[d.provider] ?? d.provider);
  // the FULL error, always available to copy (threads.ts confirms the isAdmin gate is UX-only, not
  // access control — the whole payload is in the client's own response regardless).
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
// swaps its own label on click. This is the "log I can copy to debug" ask.
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
