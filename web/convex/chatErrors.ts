"use node";
// Classify a raw provider/SDK failure into a structured code the CLIENT decides how much detail to
// render for (see errData()/FRIENDLY/ErrorLine in app/app/page.tsx — a UX choice, NOT an
// access-control boundary: the full object still goes to whichever user made the call). Prefer
// APICallError.statusCode (reliable, from the AI SDK) over string-sniffing; the AI SDK's own retry
// wrapper (generateText retries 429/5xx by default) wraps an exhausted retry chain in a RetryError,
// NOT an APICallError, so unwrap that first via .lastError. codex/claude's bespoke fetch paths (no
// retry wrapper) embed a status in the message text instead — regex fallback for those.
import { APICallError, RetryError } from "ai";

export type ChatErrorInfo = { code: string; status?: number; detail: string };

export function classifyError(e: unknown, provider?: string): ChatErrorInfo {
  if (RetryError.isInstance(e) && e.lastError) e = e.lastError; // reclassify off the real underlying failure
  const detail = (e instanceof Error ? e.message : String(e)).slice(0, 400);
  let status: number | undefined;
  if (APICallError.isInstance(e)) status = e.statusCode;
  else if (e instanceof Error) { const m = e.message.match(/\b(4\d{2}|5\d{2})\b/); if (m) status = Number(m[1]); }
  // Google's Generative Language API returns HTTP 400 (not 401/403) for a bad/revoked key.
  const googleBadKey = provider === "google" && status === 400 && /api key not valid|INVALID_ARGUMENT/i.test(detail);
  // a connection/DNS failure (no HTTP status) — usually a bad custom-provider base URL or a down host.
  // Distinguish it from a true server-side "internal" so the user is told to check the endpoint.
  const unreachable = !status && /getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network|socket hang|Cannot connect|ECONNRESET/i.test(detail);
  const code =
    status === 401 || status === 403 || googleBadKey ? "invalid_api_key" :
    status === 429 ? "rate_limited" :
    status === 402 ? "quota_exceeded" :
    status === 404 ? "not_found" :
    status === 400 ? "invalid_request" :
    status ? "provider_error" : unreachable ? "unreachable" : "internal";
  return { code, status, detail };
}

// compact a Vercel AI SDK multi-step result into a serializable trace + token totals
export function traceOf(result: any): { steps: { text: string; tools: string[] }[]; promptTokens: number; completionTokens: number } {
  const steps = (result.steps ?? []).map((s: any) => ({
    text: (s.text ?? "").slice(0, 4000),
    tools: (s.toolCalls ?? []).map((tc: any) => tc.toolName ?? "tool"),
  }));
  const u: any = result.usage ?? {};
  return { steps, promptTokens: u.inputTokens ?? u.promptTokens ?? 0, completionTokens: u.outputTokens ?? u.completionTokens ?? 0 };
}
