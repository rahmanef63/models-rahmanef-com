// Bounds are applied before encryption or writes; error text never includes supplied values.
export function credentialInputError(a: { provider: string; apiKey?: string; priority?: number; models?: string[]; protocol?: string }): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(a.provider)) return "Invalid provider slug.";
  if (a.apiKey !== undefined && (!a.apiKey || a.apiKey.length > 16384 || /\s|[\x00-\x1f\x7f]/.test(a.apiKey))) return "Invalid API key.";
  if (a.priority !== undefined && !Number.isFinite(a.priority)) return "Priority must be finite.";
  if (a.protocol !== undefined && a.protocol !== "openai" && a.protocol !== "anthropic") return "Unsupported protocol.";
  if (a.models && (a.models.length > 100 || a.models.some((m) => m.length > 256 || /[\x00-\x1f\x7f]/.test(m)))) return "Invalid model list.";
  return null;
}

export function canDeletePersonalCredential(row: { userId: string; workspaceId?: string } | null, userId: string): boolean {
  return !!row && row.userId === userId && row.workspaceId === undefined;
}

export function publicCredential(row: any) {
  return {
    credentialVersion: `${row._id}:${row.updatedAt}`,
    provider: row.provider, kind: row.kind ?? "api_key", models: row.models,
    lastCheckedAt: row.lastCheckedAt, lastCheckedOk: row.lastCheckedOk,
    lastCheckedCode: row.lastCheckedCode,
    lastCheckedDetail: row.lastCheckedDetail === undefined ? undefined : safeProviderErrorDetail(row.lastCheckedCode),
  };
}

export function safeProviderErrorDetail(code?: string): string {
  const details: Record<string, string> = {
    invalid_api_key: "Provider rejected the credential.", rate_limited: "Provider rate limit reached.",
    quota_exceeded: "Provider quota exceeded.", not_found: "Provider resource was not found.",
    invalid_request: "Provider rejected the request.", provider_error: "Provider request failed.",
    unreachable: "Could not reach the provider endpoint.", internal: "Provider request failed.",
  };
  return Object.hasOwn(details, code ?? "") ? details[code!] : details.internal;
}

export function classifyProviderFailure(raw: string, status?: number, provider?: string) {
  const googleBadKey = provider === "google" && status === 400 && /api key not valid|INVALID_ARGUMENT/i.test(raw);
  const unreachable = !status && /getaddrinfo|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|network|socket hang|Cannot connect|ECONNRESET/i.test(raw);
  const code = status === 401 || status === 403 || googleBadKey ? "invalid_api_key" :
    status === 429 ? "rate_limited" : status === 402 ? "quota_exceeded" :
    status === 404 ? "not_found" : status === 400 ? "invalid_request" :
    status ? "provider_error" : unreachable ? "unreachable" : "internal";
  return { code, status, detail: safeProviderErrorDetail(code) };
}

export const resetCredentialCheck = {
  lastCheckedAt: undefined, lastCheckedOk: undefined, lastCheckedCode: undefined, lastCheckedDetail: undefined,
};

function privateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function privateEndpointHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "localhost.localdomain" ||
      host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return privateIpv4(host.split(".").map(Number));
  if (!host.includes(":")) return false;
  // URL has already validated/normalized IPv6, including dotted IPv4-mapped spellings.
  const halves = host.split("::");
  const left = halves[0] ? halves[0].split(":").map((part) => parseInt(part, 16)) : [];
  const right = halves[1] ? halves[1].split(":").map((part) => parseInt(part, 16)) : [];
  const words = halves.length === 1 ? left : [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
  if ((words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 ||
      (words[0] & 0xffc0) === 0xfec0 || (words[0] & 0xff00) === 0xff00) return true;
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  const compatible = words.slice(0, 6).every((word) => word === 0);
  if (mapped || compatible) return privateIpv4([words[6] >>> 8, words[6] & 255, words[7] >>> 8, words[7] & 255]);
  return false;
}

// Hostname/literal policy only: no DNS resolution or protection against DNS rebinding.
export function credentialEndpointError(endpoint?: string): string | null {
  if (endpoint === undefined) return null;
  try {
    if (endpoint.length > 2048) return "Invalid endpoint.";
    const url = new URL(endpoint);
    if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash) {
      return privateEndpointHost(url.hostname) ? "Endpoint host must be public." : null;
    }
  } catch { /* malformed URL */ }
  return "Endpoint must be HTTPS without credentials, query, or fragment.";
}
