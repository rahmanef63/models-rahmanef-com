// Anthropic "Sign in with Claude" (Claude Pro/Max) path — reverse-engineered from the Claude Code
// OAuth flow (same client_id + endpoints Claude Code / hermes use). OAuth tokens hit the Messages
// API with Bearer auth + Claude-Code headers, NOT x-api-key. No Convex ctx here; callers persist.
export const CLAUDE = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  refreshUrls: ["https://platform.claude.com/v1/oauth/token", "https://console.anthropic.com/v1/oauth/token"],
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scope: "org:create_api_key user:profile user:inference",
  apiBase: "https://api.anthropic.com",
  // Claude Code version we present. Anthropic 400s tokens that spoof a too-OLD version; bump if needed.
  version: "2.1.74",
};

export type ClaudeBundle = { access: string; refresh: string; expires: number };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// PKCE — verifier is ALSO round-tripped as the OAuth `state` (Claude Code convention).
export async function claudePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: b64url(digest) };
}

export function claudeAuthUrl(verifier: string, challenge: string): string {
  const p = new URLSearchParams({
    code: "true",
    client_id: CLAUDE.clientId,
    response_type: "code",
    redirect_uri: CLAUDE.redirectUri,
    scope: CLAUDE.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });
  return `${CLAUDE.authorizeUrl}?${p.toString()}`;
}

// Exchange the pasted "code#state" for a token bundle. verifier is the stored PKCE verifier.
export async function claudeExchange(code: string, state: string, verifier: string): Promise<ClaudeBundle> {
  const res = await fetch(CLAUDE.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": `claude-cli/${CLAUDE.version} (external, cli)` },
    body: JSON.stringify({ grant_type: "authorization_code", client_id: CLAUDE.clientId, code, state, redirect_uri: CLAUDE.redirectUri, code_verifier: verifier }),
  });
  if (!res.ok) throw new Error(`Claude token exchange failed (${res.status}) — re-copy the code`);
  const j = await res.json();
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
}

// Refresh 60s before expiry. Tries platform.claude.com then console.anthropic.com.
export async function ensureFreshClaude(bundle: ClaudeBundle): Promise<{ bundle: ClaudeBundle; refreshed: boolean }> {
  if (Date.now() < bundle.expires - 60_000) return { bundle, refreshed: false };
  let lastErr = "";
  for (const url of CLAUDE.refreshUrls) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": `claude-cli/${CLAUDE.version} (external, cli)` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: bundle.refresh, client_id: CLAUDE.clientId }),
    });
    if (res.ok) {
      const j = await res.json();
      return { bundle: { access: j.access_token, refresh: j.refresh_token || bundle.refresh, expires: Date.now() + (j.expires_in ?? 3600) * 1000 }, refreshed: true };
    }
    lastErr = `${res.status}`;
  }
  throw new Error(`Claude token refresh failed (${lastErr}) — reconnect Claude`);
}

function claudeHeaders(bundle: ClaudeBundle): Record<string, string> {
  return {
    Authorization: `Bearer ${bundle.access}`,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,claude-code-20250219,oauth-2025-04-20",
    "User-Agent": `claude-cli/${CLAUDE.version} (external, cli)`,
    "x-app": "cli",
  };
}

// Best-effort model list for the picker. Falls back to a static set if /v1/models rejects OAuth.
const FALLBACK_MODELS = ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"];
export async function claudeModels(bundle: ClaudeBundle): Promise<string[]> {
  try {
    const res = await fetch(`${CLAUDE.apiBase}/v1/models?limit=100`, { headers: { ...claudeHeaders(bundle), accept: "application/json" } });
    if (!res.ok) return FALLBACK_MODELS;
    const j = await res.json();
    const arr = (j.data ?? j.models ?? []).map((m: any) => m.id || m.name).filter(Boolean);
    return arr.length ? arr : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

// Call the Messages API with the OAuth token. The FIRST system block MUST be the Claude Code
// identity string or OAuth traffic is rejected — prepend it ahead of any real system prompt.
export async function claudeChat(
  bundle: ClaudeBundle,
  model: string,
  messages: { role: string; content: string }[],
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const system = [
    { type: "text", text: "You are Claude Code, Anthropic's official CLI for Claude." },
    ...messages.filter((m) => m.role === "system").map((m) => ({ type: "text", text: m.content })),
  ];
  const msgs = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(`${CLAUDE.apiBase}/v1/messages`, {
    method: "POST",
    headers: { ...claudeHeaders(bundle), "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8192, system, messages: msgs }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Claude messages ${res.status}: ${body.slice(0, 200)}`);
  const j = JSON.parse(body);
  const text = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("") || "(no text in response)";
  return { text, promptTokens: j.usage?.input_tokens ?? 0, completionTokens: j.usage?.output_tokens ?? 0 };
}
