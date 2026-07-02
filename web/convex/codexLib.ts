// Pure helpers for the OpenAI Codex (ChatGPT-account) path — reverse-engineered from the
// codex CLI (same as hermes/openclaw). Token calls the CONSUMER ChatGPT backend, NOT
// api.openai.com. No Convex ctx here; callers persist a refreshed bundle.
export const CODEX = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  usercodeUrl: "https://auth.openai.com/api/accounts/deviceauth/usercode",
  pollUrl: "https://auth.openai.com/api/accounts/deviceauth/token",
  tokenUrl: "https://auth.openai.com/oauth/token",
  deviceRedirect: "https://auth.openai.com/deviceauth/callback",
  verificationUrl: "https://auth.openai.com/codex/device",
  apiBase: "https://chatgpt.com/backend-api/codex",
};

export type CodexBundle = { access: string; refresh: string; expires: number; accountId?: string };

// Cloudflare in front of the codex backend only serves an allow-listed originator.
function codexHeaders(bundle: CodexBundle): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${bundle.access}`,
    originator: "codex_cli_rs",
    "User-Agent": "codex_cli_rs/0.0.0 (models-rahmanef)",
  };
  const accountId = bundle.accountId || decodeAccountId(bundle.access);
  if (accountId) h["ChatGPT-Account-ID"] = accountId;
  return h;
}

export function decodeAccountId(access: string): string | undefined {
  try {
    const payload = JSON.parse(atob(access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload["https://api.openai.com/auth"]?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

// Refresh the access token if within 2 min of expiry. Returns the (maybe new) bundle + refreshed flag.
export async function ensureFreshCodex(bundle: CodexBundle): Promise<{ bundle: CodexBundle; refreshed: boolean }> {
  if (Date.now() < bundle.expires - 120_000) return { bundle, refreshed: false };
  const res = await fetch(CODEX.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: bundle.refresh, client_id: CODEX.clientId }),
  });
  if (!res.ok) throw new Error(`codex token refresh failed (${res.status}) — reconnect OpenAI`);
  const j = await res.json();
  const next: CodexBundle = {
    access: j.access_token,
    refresh: j.refresh_token || bundle.refresh,
    expires: Date.now() + (j.expires_in ?? 3600) * 1000,
    accountId: decodeAccountId(j.access_token) || bundle.accountId,
  };
  return { bundle: next, refreshed: true };
}

export async function codexModels(bundle: CodexBundle): Promise<string[]> {
  const res = await fetch(`${CODEX.apiBase}/models?client_version=1.0.0`, {
    headers: { ...codexHeaders(bundle), accept: "application/json" },
  });
  if (!res.ok) return [];
  const j = await res.json();
  const arr = Array.isArray(j) ? j : j.models || j.data || [];
  return arr.map((m: any) => (typeof m === "string" ? m : m.id || m.slug)).filter(Boolean);
}

// Call the Codex Responses API (SSE) and return the concatenated assistant text.
export async function codexChat(
  bundle: CodexBundle,
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const instructions = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      type: "message",
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    }));
  const res = await fetch(`${CODEX.apiBase}/responses`, {
    method: "POST",
    headers: {
      ...codexHeaders(bundle),
      "OpenAI-Beta": "responses=experimental",
      accept: "text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, store: false, stream: true, instructions, input }),
  });
  const sse = await res.text();
  if (!res.ok) throw new Error(`codex responses ${res.status}: ${sse.slice(0, 200)}`);
  let out = "";
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const ev = JSON.parse(data);
      if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
    } catch {
      /* ignore keep-alives / partial frames */
    }
  }
  return out || "(no text in response)";
}
