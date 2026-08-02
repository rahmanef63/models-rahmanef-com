// provider-pool (2.3) — pure, config-driven error → fallback verdict. Given a provider failure
// (a chatErrors `code`, an HTTP `status`, or a raw error/string) decide whether the credential is
// worth retrying with, how long to cool it, and whether it is terminally dead until re-auth.
// No side effects, no `ai`/node imports → unit-testable in isolation (see _selfCheck below).
//
// Rules (ordered, first match wins), ported from 9router ERROR_RULES + hermes credential_pool:
//   terminal auth (401/403, invalid_api_key/invalid_grant/token_revoked/invalid_token) → dead
//   429 / rate_limited        → retryable, exponential cooldown 1s·2^n cap 240s
//   5xx / provider_error      → retryable, short 5s cooldown
//   402 / quota_exceeded      → retryable (fail over to the NEXT cred), long 240s cooldown (exhausted, not dead)
//   anything else (400/404…)  → NOT fallback-worthy, no cooldown (caller should surface it)

export type FallbackVerdict = {
  retryable: boolean; // worth immediately trying the NEXT credential
  dead: boolean; // exclude from the pool until the key/token is re-authed
  cooldownMs: number; // how long to skip THIS credential (0 = no cooldown)
  nextBackoffLevel: number; // persist onto the row so repeated 429s back off further
};

const RATE_CAP_MS = 240_000; // 4 min
const TERMINAL = new Set(["invalid_api_key", "invalid_grant", "token_revoked", "invalid_token", "invalid_client", "unauthorized"]);
const TERMINAL_RE = /invalid[_ ]?grant|token[_ ]?revoked|invalid[_ ]?api[_ ]?key|invalid[_ ]?token|unauthorized/i;

// Normalize any accepted input into { code?, status? } without importing the SDK.
function normalize(input: unknown): { code?: string; status?: number } {
  if (typeof input === "number") return { status: input };
  if (typeof input === "string") return { code: input };
  if (input && typeof input === "object") {
    const o = input as { code?: unknown; status?: unknown; statusCode?: unknown; message?: unknown };
    const code = typeof o.code === "string" ? o.code : undefined;
    const status = typeof o.status === "number" ? o.status : typeof o.statusCode === "number" ? o.statusCode : undefined;
    if (code || status != null) return { code, status };
    if (typeof o.message === "string") { const m = o.message.match(/\b(4\d{2}|5\d{2})\b/); return { code: o.message, status: m ? Number(m[1]) : undefined }; }
  }
  return {};
}

export function classifyProviderError(input: unknown, backoffLevel = 0): FallbackVerdict {
  const { code, status } = normalize(input);
  const c = code ?? "";
  // terminal auth → dead until re-auth
  if (status === 401 || status === 403 || TERMINAL.has(c) || TERMINAL_RE.test(c)) {
    return { retryable: false, dead: true, cooldownMs: 0, nextBackoffLevel: backoffLevel };
  }
  // rate limited → exponential backoff
  if (status === 429 || c === "rate_limited") {
    const cooldownMs = Math.min(1000 * 2 ** Math.max(0, backoffLevel), RATE_CAP_MS);
    return { retryable: true, dead: false, cooldownMs, nextBackoffLevel: backoffLevel + 1 };
  }
  // server error → short cooldown, retry next cred
  if ((status != null && status >= 500 && status < 600) || c === "provider_error") {
    return { retryable: true, dead: false, cooldownMs: 5_000, nextBackoffLevel: backoffLevel + 1 };
  }
  // quota/billing exhausted → fail over to the NEXT cred, cool THIS one 240s, but recoverable (not dead).
  // retryable:true so a multi-cred pool tries the next key instead of aborting the whole request.
  if (status === 402 || c === "quota_exceeded") {
    return { retryable: true, dead: false, cooldownMs: RATE_CAP_MS, nextBackoffLevel: backoffLevel };
  }
  // 400/404/unknown → not fallback-worthy; caller surfaces the error verbatim
  return { retryable: false, dead: false, cooldownMs: 0, nextBackoffLevel: backoffLevel };
}

// tiny assert-based self-check — call from a test or a scratch script (NOT auto-run at import,
// so it never adds latency to a Convex cold start). Throws on the first broken rule.
export function _selfCheck(): true {
  const eq = (got: unknown, want: unknown, msg: string) => { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`fallbackRules ${msg}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`); };
  eq(classifyProviderError("invalid_api_key"), { retryable: false, dead: true, cooldownMs: 0, nextBackoffLevel: 0 }, "invalid_api_key dead");
  eq(classifyProviderError(401), { retryable: false, dead: true, cooldownMs: 0, nextBackoffLevel: 0 }, "401 dead");
  eq(classifyProviderError("invalid_grant"), { retryable: false, dead: true, cooldownMs: 0, nextBackoffLevel: 0 }, "invalid_grant dead");
  eq(classifyProviderError("rate_limited", 0).cooldownMs, 1000, "429 backoff n=0 → 1s");
  eq(classifyProviderError(429, 3).cooldownMs, 8000, "429 backoff n=3 → 8s");
  eq(classifyProviderError(429, 20).cooldownMs, RATE_CAP_MS, "429 backoff caps at 240s");
  eq(classifyProviderError(503).retryable, true, "5xx retryable");
  eq(classifyProviderError(503).cooldownMs, 5000, "5xx short cooldown");
  eq(classifyProviderError("quota_exceeded"), { retryable: true, dead: false, cooldownMs: RATE_CAP_MS, nextBackoffLevel: 0 }, "quota exhausted fails over, not dead");
  eq(classifyProviderError("invalid_request"), { retryable: false, dead: false, cooldownMs: 0, nextBackoffLevel: 0 }, "400 not fallback-worthy");
  return true;
}
