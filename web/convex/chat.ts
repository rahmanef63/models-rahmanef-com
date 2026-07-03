"use node";
// Call a model with the authed user's OWN credential (BYOK) via the Vercel AI SDK, and log
// usage for the stats dashboard. Per-user key — NOT a server-held key. OpenAI-Codex keeps its
// bespoke ChatGPT-backend path (codexLib); everyone else goes through the AI SDK.
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText, tool, jsonSchema, stepCountIs, APICallError, RetryError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { encryptSecret, decryptSecret } from "./crypto";
import { ensureFreshCodex, codexChat, type CodexBundle } from "./codexLib";
import { ensureFreshClaude, claudeChat, type ClaudeBundle } from "./claudeLib";
import { TOOL_REGISTRY } from "./toolRegistry";

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
      // .chat() = /chat/completions. The shorthand `(model)` defaults to OpenAI's /responses
      // API, which third-party OpenAI-compatible hosts (Mistral, Groq, …) don't implement → 404.
      if (OPENAI_COMPAT[provider]) return createOpenAI({ apiKey, baseURL: OPENAI_COMPAT[provider] }).chat(model);
      return null;
  }
}

const TOOL_DESC = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.id, t.description]));

// tools that let a model inspect the caller's OWN gateway (agent mode + AI Agents). auth flows
// through ctx.runQuery, so a tool only ever sees the authed user's data. `ids` (from a saved
// agentDef's `tools` field) filters which of these are actually exposed; omitted = all of them,
// matching the pre-agentDefs "agent mode" behavior (Chat's on/off toggle) exactly.
function gatewayTools(ctx: any, ids?: string[]) {
  const noArgs = jsonSchema({ type: "object", properties: {}, additionalProperties: false });
  const all: Record<string, any> = {
    list_my_providers: tool({ description: TOOL_DESC.list_my_providers, inputSchema: noArgs, execute: async () => ctx.runQuery(api.credentials.listConfiguredProviders, {}) }),
    get_my_usage: tool({ description: TOOL_DESC.get_my_usage, inputSchema: noArgs, execute: async () => ctx.runQuery(api.usage.myUsage, {}) }),
  };
  if (!ids) return all;
  const out: Record<string, any> = {};
  for (const id of ids) if (all[id]) out[id] = all[id];
  return out;
}

// Classify a call failure into a structured code the CLIENT decides how much detail to render for
// (see errData()/FRIENDLY/ErrorLine in app/app/page.tsx — that's a UX choice, NOT an access-control
// boundary: the full object still goes to whichever user made the call, same as any other action
// result). Prefer APICallError.statusCode (reliable, from the AI SDK) over string-sniffing; the AI
// SDK's own retry wrapper (generateText retries 429/5xx by default) wraps an exhausted retry chain
// in a RetryError, NOT an APICallError, so unwrap that first via its .lastError. codex/claude's
// bespoke fetch paths (no retry wrapper) embed a status in the message text instead
// ("codex responses 401: …", "Claude messages 403: …") — regex fallback for those.
export type ChatErrorInfo = { code: string; status?: number; detail: string };
function classifyError(e: unknown, provider?: string): ChatErrorInfo {
  if (RetryError.isInstance(e) && e.lastError) e = e.lastError; // reclassify off the real underlying failure
  const detail = (e instanceof Error ? e.message : String(e)).slice(0, 400);
  let status: number | undefined;
  if (APICallError.isInstance(e)) status = e.statusCode;
  else if (e instanceof Error) { const m = e.message.match(/\b(4\d{2}|5\d{2})\b/); if (m) status = Number(m[1]); }
  // Google's Generative Language API returns HTTP 400 (not 401/403) for a bad/revoked key.
  const googleBadKey = provider === "google" && status === 400 && /api key not valid|INVALID_ARGUMENT/i.test(detail);
  const code =
    status === 401 || status === 403 || googleBadKey ? "invalid_api_key" :
    status === 429 ? "rate_limited" :
    status === 402 ? "quota_exceeded" :
    status === 404 ? "not_found" :
    status === 400 ? "invalid_request" :
    status ? "provider_error" : "internal";
  return { code, status, detail };
}

// compact a Vercel AI SDK multi-step result into a serializable trace + token totals
function traceOf(result: any): { steps: { text: string; tools: string[] }[]; promptTokens: number; completionTokens: number } {
  const steps = (result.steps ?? []).map((s: any) => ({
    text: (s.text ?? "").slice(0, 4000),
    tools: (s.toolCalls ?? []).map((tc: any) => tc.toolName ?? "tool"),
  }));
  const u: any = result.usage ?? {};
  return { steps, promptTokens: u.inputTokens ?? u.promptTokens ?? 0, completionTokens: u.outputTokens ?? u.completionTokens ?? 0 };
}

export const chat = action({
  args: {
    model: v.string(),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    return callForUser(ctx, userId, a.model, a.messages);
  },
});

// Core BYOK model call for an EXPLICIT userId. Shared by the authed chat action and the MCP path.
// Callers must have already authorized the user (getAuthUserId, or a validated MCP token).
export async function callForUser(
  ctx: any,
  userId: any,
  modelRef: string,
  inputMessages: { role: string; content: string }[],
): Promise<{ text: string }> {
    const i = modelRef.indexOf("/");
    if (i < 1 || i === modelRef.length - 1) throw new ConvexError({ code: "invalid_request", detail: 'model must be "provider/model"' } satisfies ChatErrorInfo);
    const provider = modelRef.slice(0, i);
    const model = modelRef.slice(i + 1);

    const logUsage = (status: string, promptTokens: number, completionTokens: number) =>
      ctx.runMutation(internal.usage.log, { userId, provider, model: modelRef, promptTokens, completionTokens, status });

    // Everything below — including the credential/settings lookups — is inside ONE try so every
    // failure (not just the model call itself) gets classified into a structured ConvexError
    // instead of escaping as a plain Error (which Convex redacts to a bare "Server Error").
    let text = "", promptTokens = 0, completionTokens = 0;
    try {
      const row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
      if (!row) throw new ConvexError({ code: "not_connected", detail: `No credentials for "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });

      // token-savers: a Caveman/Ponytail system prompt when the user has them on
      const settings = await ctx.runQuery(internal.settings._getForChat, { userId });
      const sys: string[] = [];
      if (settings.cavemanEnabled) sys.push(CAVEMAN_PROMPT);
      if (settings.ponytailEnabled) sys.push(PONYTAIL_PROMPT);
      const systemPrompt = sys.length ? sys.join("\n\n") : undefined;
      // codex/claude custom paths take the system prompt inline as a message; the AI SDK (ai@7)
      // REJECTS a {role:"system"} message inside `messages` — it must be passed via the `system` param.
      const messages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...inputMessages] : inputMessages;

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
      } else if (provider === "anthropic-oauth") {
        let bundle: ClaudeBundle = JSON.parse(await decryptSecret(row.ciphertext));
        const marginMs = 60_000;
        if (Date.now() >= bundle.expires - marginMs) {
          const claim = await ctx.runMutation(internal.credentials.claimRefresh, { userId, provider, marginMs });
          if (claim.win) {
            bundle = (await ensureFreshClaude(bundle)).bundle;
            await ctx.runMutation(internal.credentials.store, { userId, provider, kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(bundle)), expires: bundle.expires });
          } else {
            await new Promise((r) => setTimeout(r, 1500));
            const r2 = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
            if (r2) bundle = JSON.parse(await decryptSecret(r2.ciphertext));
          }
        }
        const res = await claudeChat(bundle, model, messages);
        text = res.text;
        promptTokens = res.promptTokens;
        completionTokens = res.completionTokens;
      } else {
        const apiKey = await decryptSecret(row.ciphertext);
        const m = modelFor(provider, model, apiKey);
        if (!m) throw new ConvexError({ code: "internal", detail: `Unknown provider "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });
        // agent mode: give the model tools to inspect the user's own gateway (needs a tool-capable model)
        const tools = settings.agentMode ? gatewayTools(ctx) : undefined;
        // system via the `system` param (NOT a message) — ai@7 rejects system-in-messages; use inputMessages (no system role)
        const result = await generateText({ model: m, ...(systemPrompt ? { system: systemPrompt } : {}), messages: inputMessages as any, ...(tools ? { tools, stopWhen: stepCountIs(5) } : {}) });
        text = result.text || "(no text)";
        const u: any = result.usage ?? {};
        promptTokens = u.inputTokens ?? u.promptTokens ?? 0;
        completionTokens = u.outputTokens ?? u.completionTokens ?? 0;
      }
    } catch (e) {
      await logUsage("error", 0, 0);
      // surface the real provider error — Convex masks plain thrown errors as "Server Error" in prod.
      // already-structured ConvexErrors thrown above (not_connected, unknown provider) pass through
      // untouched — classifyError is for RAW provider/SDK failures, not our own typed throws.
      if (e instanceof ConvexError && e.data && typeof e.data === "object") throw e;
      throw new ConvexError({ ...classifyError(e, provider), provider, model });
    }

    await logUsage("ok", promptTokens, completionTokens);
    return { text };
}

// AI Agents: run a single task with tools + a multi-step loop, persisting a trace. Needs a
// tool-capable API-key model (codex's ChatGPT-backend path has no tool support here). Either
// `agentId` (a saved agentDefs config — model/instructions/tools/maxSteps/temperature all come
// from there) or `model` (ad-hoc: all gateway tools, maxSteps 8, no instructions — the original
// pre-agentDefs behavior, unchanged) must be given.
export const runAgent = action({
  args: { task: v.string(), model: v.optional(v.string()), agentId: v.optional(v.id("agentDefs")) },
  handler: async (ctx, a): Promise<{ runId: string; text: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");

    let modelRef: string, instructions: string | undefined, toolIds: string[] | undefined, maxSteps: number, temperature: number | undefined, agentName: string | undefined;
    if (a.agentId) {
      const def = await ctx.runQuery(internal.agentDefs.getOwned, { userId, id: a.agentId });
      if (!def) throw new ConvexError({ code: "not_found", detail: "Agent not found" } satisfies ChatErrorInfo);
      modelRef = def.model;
      instructions = def.instructions;
      toolIds = def.tools;
      maxSteps = def.maxSteps;
      temperature = def.temperature;
      agentName = def.name;
    } else {
      if (!a.model) throw new ConvexError({ code: "invalid_request", detail: "model required" } satisfies ChatErrorInfo);
      modelRef = a.model;
      maxSteps = 8;
    }

    const i = modelRef.indexOf("/");
    if (i < 1 || i === modelRef.length - 1) throw new ConvexError({ code: "invalid_request", detail: 'model must be "provider/model"' } satisfies ChatErrorInfo);
    const provider = modelRef.slice(0, i);
    const model = modelRef.slice(i + 1);
    if (provider === "openai-codex" || provider === "anthropic-oauth") throw new ConvexError({ code: "invalid_request", detail: "Agents need a tool-capable API-key model (not an OAuth subscription provider).", provider, model } satisfies ChatErrorInfo & { provider: string; model: string });

    let row: any, m: any;
    try {
      row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider });
      if (!row) throw new ConvexError({ code: "not_connected", detail: `No credentials for "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });
      m = modelFor(provider, model, await decryptSecret(row.ciphertext));
      if (!m) throw new ConvexError({ code: "internal", detail: `Unknown provider "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });
    } catch (e) {
      // no run exists yet at this point — nothing to mark failed, just classify + rethrow
      if (e instanceof ConvexError && e.data && typeof e.data === "object") throw e;
      throw new ConvexError({ ...classifyError(e, provider), provider, model });
    }

    const runId = await ctx.runMutation(internal.agents.create, { userId, task: a.task, model: modelRef, agentId: a.agentId, agentName, at: Date.now() });
    try {
      const result = await generateText({
        model: m,
        ...(instructions ? { system: instructions } : {}),
        messages: [{ role: "user", content: a.task }],
        tools: gatewayTools(ctx, toolIds),
        stopWhen: stepCountIs(maxSteps),
        ...(temperature != null ? { temperature } : {}),
      });
      const { steps, promptTokens, completionTokens } = traceOf(result);
      const text = result.text || "(no text)";
      await ctx.runMutation(internal.agents.finish, { runId, status: "done", steps, result: text, promptTokens, completionTokens });
      await ctx.runMutation(internal.usage.log, { userId, provider, model: modelRef, promptTokens, completionTokens, status: "ok" });
      return { runId, text };
    } catch (e: any) {
      const info = classifyError(e, provider);
      await ctx.runMutation(internal.agents.finish, { runId, status: "error", error: info.detail, errorCode: info.code });
      await ctx.runMutation(internal.usage.log, { userId, provider, model: modelRef, promptTokens: 0, completionTokens: 0, status: "error" });
      throw new ConvexError({ ...info, provider, model }); // unmask the real provider error (Convex hides plain throws)
    }
  },
});

// Connectivity check for a stored API-key credential — a real 1-token call through the EXACT
// same path (callForUser) real chat uses, so it can never diverge from what chat actually does.
// Never throws on a bad key (that's an EXPECTED outcome, not exceptional) — records the result on
// the credential row so the Providers list can show a health badge instead of only surfacing at
// chat time. Client picks `model` from the models.dev catalog (cheapest available for `provider`).
export const testCredential = action({
  args: { provider: v.string(), model: v.string() },
  handler: async (ctx, a): Promise<{ ok: boolean; code?: string; status?: number; detail?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    if (!a.model) throw new ConvexError({ code: "invalid_request", detail: "model required" } satisfies ChatErrorInfo);
    try {
      await callForUser(ctx, userId, `${a.provider}/${a.model}`, [{ role: "user", content: "ping" }]);
      // never let the bookkeeping write itself throw — a hiccup here must not surface as a false
      // "key is bad" (or an uncaught rejection) when the actual connectivity check succeeded
      try { await ctx.runMutation(internal.credentials._recordCheck, { userId, provider: a.provider, ok: true }); } catch { /* best-effort */ }
      return { ok: true };
    } catch (e: any) {
      // callForUser already classifies its own failures into ConvexError({code,status,detail,...}) — reuse it
      const d = e?.data && typeof e.data === "object" ? e.data : classifyError(e, a.provider);
      try { await ctx.runMutation(internal.credentials._recordCheck, { userId, provider: a.provider, ok: false, code: d.code, detail: d.detail }); } catch { /* best-effort */ }
      return { ok: false, code: d.code, status: d.status, detail: d.detail };
    }
  },
});
