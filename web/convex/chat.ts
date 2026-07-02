"use node";
// Call a model with the authed user's OWN credential (BYOK) via the Vercel AI SDK, and log
// usage for the stats dashboard. Per-user key — NOT a server-held key. OpenAI-Codex keeps its
// bespoke ChatGPT-backend path (codexLib); everyone else goes through the AI SDK.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { encryptSecret, decryptSecret } from "./crypto";
import { ensureFreshCodex, codexChat, type CodexBundle } from "./codexLib";

// provider slug -> a Vercel AI SDK model bound to the caller's key. openai-compatible providers
// reuse the OpenAI provider with a baseURL. Keep in sync with ../../src/registry.js.
const OPENAI_COMPAT: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com",
  xai: "https://api.x.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  moonshotai: "https://api.moonshot.ai/v1",
};

function modelFor(provider: string, model: string, apiKey: string) {
  switch (provider) {
    case "openai": return createOpenAI({ apiKey })(model);
    case "anthropic": return createAnthropic({ apiKey })(model);
    case "google": return createGoogleGenerativeAI({ apiKey })(model);
    case "openrouter": return createOpenRouter({ apiKey })(model);
    default:
      if (OPENAI_COMPAT[provider]) return createOpenAI({ apiKey, baseURL: OPENAI_COMPAT[provider] })(model);
      return null;
  }
}

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

    const logUsage = (status: string, promptTokens: number, completionTokens: number) =>
      ctx.runMutation(internal.usage.log, { userId, provider, model: a.model, promptTokens, completionTokens, status });

    let text = "", promptTokens = 0, completionTokens = 0;
    try {
      if (provider === "openai-codex") {
        let bundle: CodexBundle = JSON.parse(await decryptSecret(row.ciphertext));
        const marginMs = 120_000;
        if (Date.now() >= bundle.expires - marginMs) {
          const claim = await ctx.runMutation(internal.credentials.claimRefresh, { userId, provider, marginMs });
          if (claim.win) {
            bundle = (await ensureFreshCodex(bundle)).bundle;
            await ctx.runMutation(internal.credentials.store, { userId, provider, kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(bundle)), expires: bundle.expires });
          } else {
            await new Promise((r) => setTimeout(r, 1500));
            const r2 = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
            if (r2) bundle = JSON.parse(await decryptSecret(r2.ciphertext));
          }
        }
        const res = await codexChat(bundle, model, a.messages);
        text = res.text;
        promptTokens = res.promptTokens;
        completionTokens = res.completionTokens;
      } else {
        const apiKey = await decryptSecret(row.ciphertext);
        const m = modelFor(provider, model, apiKey);
        if (!m) throw new Error(`unknown provider "${provider}"`);
        const result = await generateText({ model: m, messages: a.messages as any });
        text = result.text || "(no text)";
        const u: any = result.usage ?? {};
        promptTokens = u.inputTokens ?? u.promptTokens ?? 0;
        completionTokens = u.outputTokens ?? u.completionTokens ?? 0;
      }
    } catch (e) {
      await logUsage("error", 0, 0);
      throw e;
    }

    await logUsage("ok", promptTokens, completionTokens);
    return { text };
  },
});
