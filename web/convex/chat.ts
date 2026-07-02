// Call a model with the authed user's own credential. Host-gated: a provider's key/token is
// only ever paired with that provider's endpoint. OpenAI Codex uses the ChatGPT Responses
// backend (OAuth token); everyone else is a normal API key.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { encryptSecret, decryptSecret } from "./crypto";
import { ensureFreshCodex, codexChat, type CodexBundle } from "./codexLib";

// snapshot of ../../src/registry.js — keep in sync (openai-codex handled separately below)
const PROVIDERS: Record<string, { baseUrl: string; protocol: "openai" | "anthropic" }> = {
  openai: { baseUrl: "https://api.openai.com/v1", protocol: "openai" },
  anthropic: { baseUrl: "https://api.anthropic.com", protocol: "anthropic" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", protocol: "openai" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", protocol: "openai" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", protocol: "openai" },
  deepseek: { baseUrl: "https://api.deepseek.com", protocol: "openai" },
  xai: { baseUrl: "https://api.x.ai/v1", protocol: "openai" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", protocol: "openai" },
  moonshotai: { baseUrl: "https://api.moonshot.ai/v1", protocol: "openai" },
};

export const chat = action({
  args: {
    model: v.string(),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");

    const i = a.model.indexOf("/");
    if (i < 1 || i === a.model.length - 1) throw new Error('model must be "provider/model"');
    const provider = a.model.slice(0, i);
    const model = a.model.slice(i + 1);

    const row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
    if (!row) throw new Error(`no credentials for "${provider}" — connect or add a key first`);

    // OpenAI Codex (ChatGPT-account OAuth) → Responses backend
    if (provider === "openai-codex") {
      let bundle: CodexBundle = JSON.parse(await decryptSecret(row.ciphertext));
      const marginMs = 120_000;
      if (Date.now() >= bundle.expires - marginMs) {
        // single-flight: only the lease winner spends the single-use refresh token
        const claim = await ctx.runMutation(internal.credentials.claimRefresh, { userId, provider, marginMs });
        if (claim.win) {
          bundle = (await ensureFreshCodex(bundle)).bundle;
          await ctx.runMutation(internal.credentials.store, { userId, provider, kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(bundle)), expires: bundle.expires });
        } else {
          // someone else is refreshing (or it's already fresh) — wait briefly, re-read
          await new Promise((r) => setTimeout(r, 1500));
          const r2 = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
          if (r2) bundle = JSON.parse(await decryptSecret(r2.ciphertext));
        }
      }
      return { text: await codexChat(bundle, model, a.messages) };
    }

    const conn = PROVIDERS[provider];
    if (!conn) throw new Error(`unknown provider "${provider}"`);
    const apiKey = await decryptSecret(row.ciphertext);

    if (conn.protocol === "anthropic") {
      const r = await fetch(`${conn.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1024, messages: a.messages }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : j?.error?.message || JSON.stringify(j));
      return { text: (j.content || []).map((b: any) => b.text).filter(Boolean).join("") || "(no text)" };
    }

    const r = await fetch(`${conn.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: a.messages }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || (typeof j?.error === "string" ? j.error : JSON.stringify(j)));
    return { text: j.choices?.[0]?.message?.content ?? "(no text)" };
  },
});
