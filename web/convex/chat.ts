"use node";
// Call a model with the authed user's OWN credential (BYOK) via the Vercel AI SDK, and log
// usage for the stats dashboard. Per-user key — NOT a server-held key. OpenAI-Codex keeps its
// bespoke ChatGPT-backend path (codexLib); everyone else goes through the AI SDK.
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText, tool, jsonSchema, stepCountIs } from "ai";
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
  // expanded provider set (all OpenAI-compatible chat/completions endpoints)
  togetherai: "https://api.together.xyz/v1",
  "fireworks-ai": "https://api.fireworks.ai/inference/v1",
  cerebras: "https://api.cerebras.ai/v1",
  perplexity: "https://api.perplexity.ai",
  deepinfra: "https://api.deepinfra.com/v1/openai",
  nebius: "https://api.studio.nebius.com/v1",
  hyperbolic: "https://api.hyperbolic.xyz/v1",
  sambanova: "https://api.sambanova.ai/v1",
  novita: "https://api.novita.ai/v3/openai",
  cohere: "https://api.cohere.ai/compatibility/v1",
  glm: "https://api.z.ai/api/paas/v4",
  "github-models": "https://models.github.ai/inference",
  "vercel-gateway": "https://ai-gateway.vercel.sh/v1",
};

// token-saver system prompts (ported concept from 9router) — cut output tokens.
const CAVEMAN_PROMPT =
  "Respond in terse 'smart caveman' style to save tokens. Keep ALL technical substance, code blocks, and exact error text unchanged. Drop articles (a/an/the), filler, pleasantries, and hedging. Fragments are fine. Short synonyms. Be correct and complete — just compressed.";
const PONYTAIL_PROMPT =
  "Answer like a lazy senior engineer: the simplest solution that actually works. Prefer stdlib > native platform feature > an existing dependency > one line > minimal code. Apply YAGNI (skip speculative abstractions). Never trade away input validation, security, error handling, or accessibility. Shortest working answer, no filler.";

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

    // token-savers: prepend a Caveman/Ponytail system prompt when the user has them on
    const settings = await ctx.runQuery(internal.settings._getForChat, { userId });
    const sys: string[] = [];
    if (settings.cavemanEnabled) sys.push(CAVEMAN_PROMPT);
    if (settings.ponytailEnabled) sys.push(PONYTAIL_PROMPT);
    const messages = sys.length ? [{ role: "system", content: sys.join("\n\n") }, ...a.messages] : a.messages;

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
        const res = await codexChat(bundle, model, messages);
        text = res.text;
        promptTokens = res.promptTokens;
        completionTokens = res.completionTokens;
      } else {
        const apiKey = await decryptSecret(row.ciphertext);
        const m = modelFor(provider, model, apiKey);
        if (!m) throw new Error(`unknown provider "${provider}"`);
        // agent mode: give the model tools to inspect the user's own gateway (needs a tool-capable model)
        const noArgs = jsonSchema({ type: "object", properties: {}, additionalProperties: false });
        const tools = settings.agentMode
          ? {
              list_my_providers: tool({ description: "List the AI providers the user has connected (BYOK).", inputSchema: noArgs, execute: async () => ctx.runQuery(api.credentials.listConfiguredProviders, {}) }),
              get_my_usage: tool({ description: "Get the user's model usage stats (requests, tokens in/out, per-model, per-day).", inputSchema: noArgs, execute: async () => ctx.runQuery(api.usage.myUsage, {}) }),
            }
          : undefined;
        const result = await generateText({ model: m, messages: messages as any, ...(tools ? { tools, stopWhen: stepCountIs(5) } : {}) });
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
