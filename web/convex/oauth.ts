// OAuth provider auth: OpenAI Codex device-code + OpenRouter PKCE (issues a normal key).
// Every action derives userId from getAuthUserId — never from the client.
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { encryptSecret, decryptSecret } from "./crypto";
import { CODEX, decodeAccountId, codexModels, type CodexBundle } from "./codexLib";
import { claudePkce, claudeAuthUrl, claudeExchange, claudeModels, type ClaudeBundle } from "./claudeLib";

// ---- flow state (short-lived PKCE verifier / device ids) ----
export const _setFlow = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), verifier: v.optional(v.string()), deviceAuthId: v.optional(v.string()), userCode: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const existing = await ctx.db.query("oauthFlows").withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider)).unique();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("oauthFlows", { ...a, createdAt: Date.now() });
  },
});
export const _getFlow = internalQuery({
  args: { userId: v.id("users"), provider: v.string() },
  handler: (ctx, a) => ctx.db.query("oauthFlows").withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider)).unique(),
});
export const _clearFlow = internalMutation({
  args: { userId: v.id("users"), provider: v.string() },
  handler: async (ctx, a) => {
    const f = await ctx.db.query("oauthFlows").withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider)).unique();
    if (f) await ctx.db.delete(f._id);
  },
});

async function requireUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("unauthenticated");
  return userId;
}

// ---------- OpenAI Codex (device-code) ----------
export const startCodexLogin = action({
  args: {},
  handler: async (ctx): Promise<{ verificationUrl: string; userCode: string; intervalMs: number }> => {
    const userId = await requireUser(ctx);
    const res = await fetch(CODEX.usercodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: CODEX.clientId }),
    });
    if (!res.ok) throw new Error(`could not start OpenAI login (${res.status})`);
    const j = await res.json();
    const userCode = j.user_code ?? j.usercode;
    await ctx.runMutation(internal.oauth._setFlow, { userId, provider: "openai-codex", deviceAuthId: j.device_auth_id, userCode });
    return { verificationUrl: CODEX.verificationUrl, userCode, intervalMs: Math.max(3, parseInt(j.interval ?? "5", 10)) * 1000 };
  },
});

// Browser calls this on an interval until status !== "pending".
export const pollCodexLogin = action({
  args: {},
  handler: async (ctx): Promise<{ status: "pending" | "done" | "expired" }> => {
    const userId = await requireUser(ctx);
    const flow = await ctx.runQuery(internal.oauth._getFlow, { userId, provider: "openai-codex" });
    if (!flow?.deviceAuthId) return { status: "expired" };

    const poll = await fetch(CODEX.pollUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_auth_id: flow.deviceAuthId, user_code: flow.userCode }),
    });
    if (poll.status === 403 || poll.status === 404) return { status: "pending" };
    if (!poll.ok) throw new Error(`login poll failed (${poll.status})`);
    const { authorization_code, code_verifier } = await poll.json();

    const ex = await fetch(CODEX.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: authorization_code, redirect_uri: CODEX.deviceRedirect, client_id: CODEX.clientId, code_verifier }),
    });
    if (!ex.ok) throw new Error(`token exchange failed (${ex.status})`);
    const tok = await ex.json();
    const bundle: CodexBundle = {
      access: tok.access_token,
      refresh: tok.refresh_token,
      expires: Date.now() + (tok.expires_in ?? 3600) * 1000,
      accountId: decodeAccountId(tok.access_token),
    };
    await ctx.runMutation(internal.credentials.store, { userId, provider: "openai-codex", kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(bundle)), expires: bundle.expires });
    await ctx.runMutation(internal.oauth._clearFlow, { userId, provider: "openai-codex" });
    return { status: "done" };
  },
});

// Model refs the connected ChatGPT account can use, e.g. "openai-codex/gpt-5.5".
// READ-ONLY / best-effort: never refreshes or writes (avoids racing chat's single-use
// refresh token). If the token is stale it returns []; the next chat refreshes it.
export const codexModelList = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await requireUser(ctx);
    const row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider: "openai-codex" });
    if (!row || row.kind !== "oauth") return [];
    try {
      const bundle: CodexBundle = JSON.parse(await decryptSecret(row.ciphertext));
      return (await codexModels(bundle)).map((id) => `openai-codex/${id}`);
    } catch {
      return [];
    }
  },
});

// ---------- OpenRouter (PKCE -> normal API key) ----------
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: b64url(digest) };
}

export const startOpenRouterConnect = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await requireUser(ctx);
    const { verifier, challenge } = await pkce();
    await ctx.runMutation(internal.oauth._setFlow, { userId, provider: "openrouter", verifier });
    const callback = `${process.env.SITE_URL}/oauth/openrouter/callback`;
    const url = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callback)}&code_challenge=${challenge}&code_challenge_method=S256`;
    return { url };
  },
});

export const finishOpenRouterConnect = action({
  args: { code: v.string() },
  handler: async (ctx, a): Promise<{ ok: boolean }> => {
    const userId = await requireUser(ctx);
    const flow = await ctx.runQuery(internal.oauth._getFlow, { userId, provider: "openrouter" });
    if (!flow?.verifier) throw new Error("no pending OpenRouter connect");
    const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: a.code, code_verifier: flow.verifier, code_challenge_method: "S256" }),
    });
    if (!res.ok) throw new Error(`OpenRouter key exchange failed (${res.status})`);
    const { key } = await res.json();
    if (!key) throw new Error("OpenRouter returned no key");
    await ctx.runMutation(internal.credentials.store, { userId, provider: "openrouter", kind: "api_key", ciphertext: await encryptSecret(key) });
    await ctx.runMutation(internal.oauth._clearFlow, { userId, provider: "openrouter" });
    return { ok: true };
  },
});

// ---------- Anthropic / Claude (Pro/Max PKCE, manual paste) ----------
// User opens the authorize URL, approves, and pastes the "code#state" the callback page shows.
export const startClaudeConnect = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await requireUser(ctx);
    const { verifier, challenge } = await claudePkce();
    await ctx.runMutation(internal.oauth._setFlow, { userId, provider: "anthropic-oauth", verifier });
    return { url: claudeAuthUrl(verifier, challenge) };
  },
});

export const finishClaudeConnect = action({
  args: { pasted: v.string() },
  handler: async (ctx, a): Promise<{ ok: boolean }> => {
    const userId = await requireUser(ctx);
    const flow = await ctx.runQuery(internal.oauth._getFlow, { userId, provider: "anthropic-oauth" });
    if (!flow?.verifier) throw new Error("no pending Claude connect");
    const [code, state = flow.verifier] = a.pasted.trim().split("#");
    if (!code) throw new Error("paste the full code#state from the Claude page");
    const bundle: ClaudeBundle = await claudeExchange(code, state, flow.verifier);
    await ctx.runMutation(internal.credentials.store, { userId, provider: "anthropic-oauth", kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(bundle)), expires: bundle.expires });
    await ctx.runMutation(internal.oauth._clearFlow, { userId, provider: "anthropic-oauth" });
    return { ok: true };
  },
});

// Best-effort model refs for the picker, e.g. "anthropic-oauth/claude-sonnet-4-5". Read-only.
export const claudeModelList = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await requireUser(ctx);
    const row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider: "anthropic-oauth" });
    if (!row || row.kind !== "oauth") return [];
    try {
      const bundle: ClaudeBundle = JSON.parse(await decryptSecret(row.ciphertext));
      return (await claudeModels(bundle)).map((id) => `anthropic-oauth/${id}`);
    } catch {
      return [];
    }
  },
});
