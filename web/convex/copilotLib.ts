// Pure helpers for the GitHub Copilot (subscription) path — device-code OAuth yields a DURABLE
// GitHub token, which is exchanged for a SHORT-LIVED Copilot API token (~25 min) on demand. The
// endpoints/headers are the public ones embedded in the official editor plugins (copilot.vim /
// vscode-copilot). No Convex ctx here; callers persist a refreshed bundle.
//
// ToS NOTE: routing a paid Copilot seat through a third-party gateway is restricted by GitHub's
// terms. This provider exists only because the user explicitly opted in.
export const COPILOT = {
  clientId: "Iv1.b507a08c87ecfe98", // public GitHub Copilot OAuth app id (shipped inside editor plugins)
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  verificationUrl: "https://github.com/login/device",
  copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
  apiBase: "https://api.githubcopilot.com",
  scope: "read:user",
  userAgent: "GithubCopilot/1.155.0",
};

// ghToken = durable GitHub OAuth token; copilotToken = short-lived API bearer; expires = its epoch-ms.
export type CopilotBundle = { ghToken: string; copilotToken?: string; expires: number };

function chatHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Copilot-Integration-Id": "vscode-chat",
    "Editor-Version": "vscode/1.85.0",
    "Editor-Plugin-Version": "copilot-chat/0.11.1",
    "User-Agent": COPILOT.userAgent,
    "Openai-Intent": "conversation-panel",
  };
}

// Exchange the durable GitHub token for a fresh Copilot API token when the cached one is missing or
// within 3 min of expiry. Returns the (maybe new) bundle + refreshed flag.
export async function ensureFreshCopilot(bundle: CopilotBundle): Promise<{ bundle: CopilotBundle; refreshed: boolean }> {
  if (bundle.copilotToken && Date.now() < bundle.expires - 180_000) return { bundle, refreshed: false };
  const res = await fetch(COPILOT.copilotTokenUrl, {
    headers: { Authorization: `token ${bundle.ghToken}`, Accept: "application/json", "User-Agent": COPILOT.userAgent },
  });
  if (!res.ok) throw new Error(`copilot token exchange failed (${res.status}) — reconnect GitHub Copilot`);
  const j = await res.json();
  if (!j.token) throw new Error("copilot token exchange returned no token — is Copilot active on this account?");
  const expires = j.expires_at ? j.expires_at * 1000 : Date.now() + 25 * 60_000;
  return { bundle: { ...bundle, copilotToken: j.token, expires }, refreshed: true };
}

export async function copilotModels(bundle: CopilotBundle): Promise<string[]> {
  if (!bundle.copilotToken) return [];
  const res = await fetch(`${COPILOT.apiBase}/models`, { headers: chatHeaders(bundle.copilotToken) });
  if (!res.ok) return [];
  const j = await res.json();
  const arr = Array.isArray(j) ? j : j.data || j.models || [];
  return arr.map((m: any) => (typeof m === "string" ? m : m.id)).filter(Boolean);
}

// OpenAI-compatible chat completion, non-streaming (callForUser needs the full text anyway). The
// message content is already flattened to strings by callForUser before this is called.
export async function copilotChat(
  bundle: CopilotBundle,
  model: string,
  messages: { role: string; content: string }[],
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  if (!bundle.copilotToken) throw new Error("no copilot token — reconnect GitHub Copilot");
  const res = await fetch(`${COPILOT.apiBase}/chat/completions`, {
    method: "POST",
    headers: chatHeaders(bundle.copilotToken),
    body: JSON.stringify({ model, messages, stream: false }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`copilot chat ${res.status}: ${body.slice(0, 200)}`);
  let j: any;
  try { j = JSON.parse(body); } catch { throw new Error("copilot chat: non-JSON response"); }
  const text = j.choices?.[0]?.message?.content ?? "";
  const u = j.usage ?? {};
  return { text: text || "(no text in response)", promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0 };
}
