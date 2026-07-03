// Cross-cutting types + helpers used by 3+ dashboard sections — provider labels, the shared
// Cred/Catalog shapes, number formatting, and the error-rendering path every mutation-heavy
// card (providers, agents, chat) funnels failures through.
export const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "OpenAI · ChatGPT / Codex",
  "anthropic-oauth": "Claude · Pro / Max",
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
};

export type Cred = { provider: string; kind: string; lastCheckedAt?: number; lastCheckedOk?: boolean; lastCheckedCode?: string; lastCheckedDetail?: string };
export type Catalog = Record<string, { models?: Record<string, unknown> }>;

export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
export const SUPPORTED = 23; // openai, anthropic, google, openrouter + 18 openai-compatible + openai-codex (oauth)

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
  invalid_request: (p) => `${p} couldn't process this request — try a different model.`,
  provider_error: (p) => `${p} had a problem handling this request. Try again.`,
  internal: () => `Something went wrong on our side. Try again, or ask an admin.`,
};
export function ErrorLine({ e, isAdmin }: { e: unknown; isAdmin: boolean }) {
  const d = errData(e);
  if (typeof d === "string") return <p className="err">{d}</p>;
  // no `provider` means this ISN'T a provider/model-call failure — it's a validation error we
  // wrote ourselves (e.g. agentDefs CRUD: "name required", "Agent not found") — that text is
  // already safe + actionable for every user, so show it directly instead of running it through
  // the provider-oriented FRIENDLY table (which would render something like "This provider
  // couldn't process this request" — nonsensical here, and hides the real reason from non-admins).
  if (!d.provider) return <p className="err">{d.detail}</p>;
  const label = PROVIDER_LABEL[d.provider] ?? d.provider;
  const friendly = (FRIENDLY[d.code] ?? FRIENDLY.internal)(label);
  return (
    <p className="err">
      {friendly}
      {isAdmin && (
        <span className="mono muted" style={{ display: "block", fontSize: ".72rem", marginTop: ".3rem" }}>
          {d.code}{d.status != null ? ` · ${d.status}` : ""}{d.model ? ` · ${d.model}` : ""} · {d.detail}
        </span>
      )}
    </p>
  );
}
