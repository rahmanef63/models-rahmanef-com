"use node";
// Core BYOK model call for an EXPLICIT userId — shared by the chat action and the MCP path (so the
// two can't diverge). Callers must have already authorized the user (getAuthUserId, or a validated
// MCP token). Kept in its own module so MCP doesn't have to reach into the chat action file.
import { generateText, stepCountIs } from "ai";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { encryptSecret, decryptSecret } from "./crypto";
import { ensureFreshCodex, codexChat, type CodexBundle } from "./codexLib";
import { ensureFreshClaude, claudeChat, type ClaudeBundle } from "./claudeLib";
import { modelFor } from "./chatProviders";
import { gatewayTools } from "./chatTools";
import { classifyError, type ChatErrorInfo } from "./chatErrors";

// token-saver system prompts (ported concept from 9router) — cut output tokens.
const CAVEMAN_PROMPT =
  "Respond in terse 'smart caveman' style to save tokens. Keep ALL technical substance, code blocks, and exact error text unchanged. Drop articles (a/an/the), filler, pleasantries, and hedging. Fragments are fine. Short synonyms. Be correct and complete — just compressed.";
const PONYTAIL_PROMPT =
  "Answer like a lazy senior engineer: the simplest solution that actually works. Prefer stdlib > native platform feature > an existing dependency > one line > minimal code. Apply YAGNI (skip speculative abstractions). Never trade away input validation, security, error handling, or accessibility. Shortest working answer, no filler.";

// `agentOpts` (only ever passed by the `chat` action's agentId branch) overrides/augments the
// settings-driven system prompt + tools — explicit tools/maxSteps win over the "agent mode" user
// setting, but caveman/ponytail (if enabled) still apply on top of the agent's own instructions.
export async function callForUser(
  ctx: any,
  userId: any,
  modelRef: string,
  inputMessages: { role: string; content: string }[],
  agentOpts?: { system?: string; tools?: Record<string, any>; maxSteps?: number; temperature?: number },
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

      // token-savers: a Caveman/Ponytail system prompt when the user has them on — still applied
      // even when agentOpts.system is set, so a global "keep it terse" preference isn't silently
      // dropped just because this message happens to be routed through a saved agent.
      const settings = await ctx.runQuery(internal.settings._getForChat, { userId });
      const sys: string[] = [];
      if (settings.cavemanEnabled) sys.push(CAVEMAN_PROMPT);
      if (settings.ponytailEnabled) sys.push(PONYTAIL_PROMPT);
      if (agentOpts?.system) sys.push(agentOpts.system);
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
        // explicit agentOpts.tools (from a saved agent) wins over the "agent mode" user setting;
        // agent mode: give the model tools to inspect the user's own gateway (needs a tool-capable model)
        const tools = agentOpts?.tools ?? (settings.agentMode ? gatewayTools(ctx) : undefined);
        // system via the `system` param (NOT a message) — ai@7 rejects system-in-messages; use inputMessages (no system role)
        const result = await generateText({
          model: m,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: inputMessages as any,
          ...(tools ? { tools, stopWhen: stepCountIs(agentOpts?.maxSteps ?? 5) } : {}),
          ...(agentOpts?.temperature != null ? { temperature: agentOpts.temperature } : {}),
        });
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
