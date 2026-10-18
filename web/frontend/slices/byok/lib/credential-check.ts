import type { Catalog } from "./provider-meta";

export type TestResult = { ok: boolean; code?: string; status?: number; detail?: string; model?: string };

// A chat check must never fall back to a known embedding, guard or non-text model.
export function cheapestModel(catalog: Catalog, provider: string): string | undefined {
  const models = catalog[provider]?.models as Record<string, any> | undefined;
  const candidates = Object.keys(models ?? {}).filter((id) => {
    const m = models![id];
    if (/embed|guard|moderation/i.test(`${id} ${m?.family ?? ""}`)) return false;
    return !Array.isArray(m?.modalities?.output) || m.modalities.output.includes("text");
  });
  const paid = candidates.filter((id) => !id.endsWith(":free"));
  const pool = paid.length ? paid : candidates;
  const cost = (id: string) => {
    const value = models![id]?.cost?.input;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : Infinity;
  };
  return pool.reduce<string | undefined>((best, id) => best === undefined || cost(id) < cost(best) ? id : best, undefined);
}

// Credential actions may include submitted secrets in exception text. Only retain a known code.
const CODES = new Set(["not_connected", "invalid_api_key", "credential_changed", "check_not_saved", "rate_limited", "quota_exceeded", "not_found", "unreachable", "invalid_request", "provider_error"]);
export function credentialError(error: unknown, provider?: string) {
  const code = (error as { data?: { code?: unknown } })?.data?.code;
  return { data: { code: typeof code === "string" && CODES.has(code) ? code : "internal", provider,
    detail: "The credential request failed. Re-enter the key and try again." } };
}


export type CredentialFeedback<T> = { value: T; credentialVersion?: string; keyCount?: number };
export function feedbackForCredential<T>(feedback: CredentialFeedback<T> | undefined, credential: { credentialVersion?: string; keyCount?: number }): T | undefined {
  if (feedback?.credentialVersion === undefined || feedback.credentialVersion !== credential.credentialVersion || feedback.keyCount !== credential.keyCount) return undefined;
  return feedback.value;
}
