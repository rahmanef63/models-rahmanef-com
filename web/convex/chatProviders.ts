"use node";
// Provider→model resolution for BYOK chat: maps a provider slug + the caller's key to a Vercel AI
// SDK model, and fetches/caches the models.dev catalog (used by the get_model_catalog tool).
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// provider slug -> a Vercel AI SDK model bound to the caller's key. openai-compatible providers
// reuse the OpenAI provider with a baseURL. Keep in sync with ../../src/registry.js.
export const OPENAI_COMPAT: Record<string, string> = {
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

export function modelFor(provider: string, model: string, apiKey: string, endpoint?: string) {
  switch (provider) {
    case "openai": return createOpenAI({ apiKey })(model);
    case "anthropic": return createAnthropic({ apiKey })(model);
    case "google": return createGoogleGenerativeAI({ apiKey })(model);
    case "openrouter": return createOpenRouter({ apiKey })(model);
    default: {
      // .chat() = /chat/completions. The shorthand `(model)` defaults to OpenAI's /responses API,
      // which third-party OpenAI-compatible hosts (Mistral, Groq, …) don't implement → 404. A built-in
      // OPENAI_COMPAT host wins; otherwise a stored custom `endpoint` (BYOK custom provider) is used.
      const baseURL = OPENAI_COMPAT[provider] ?? endpoint;
      if (baseURL) return createOpenAI({ apiKey, baseURL }).chat(model);
      return null;
    }
  }
}

// module-level cache — this Node action instance can stay warm across several tool calls within
// (and across) agent runs; the catalog changes rarely, so a short TTL avoids re-fetching +
// re-parsing the whole models.dev catalog on every single tool call in a multi-step agent loop.
let modelsCatalogCache: { at: number; data: Record<string, any> } | null = null;
const MODELS_CATALOG_TTL_MS = 5 * 60_000;

export async function fetchModelsCatalog(): Promise<Record<string, any>> {
  if (modelsCatalogCache && Date.now() - modelsCatalogCache.at < MODELS_CATALOG_TTL_MS) return modelsCatalogCache.data;
  const res = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`models.dev catalog fetch failed (${res.status})`);
  const data = await res.json();
  modelsCatalogCache = { at: Date.now(), data };
  return data;
}
