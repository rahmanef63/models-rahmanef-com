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
  workspaceId: any, // Id<"workspaces"> | undefined — undefined = personal creds only (MCP tool / cred test)
  modelRef: string,
  inputMessages: { role: string; content: string }[],
  agentOpts?: { system?: string; tools?: Record<string, any>; maxSteps?: number; temperature?: number },
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
    // resolveModelRef: reserved prefixes indirect to a concrete "provider/model" BEFORE the split.
    //   combo/<name> -> the combo's chosen ref (strategy-driven; fallback picks refs[0] for now).
    //   agent/<id>   -> that agent's fixed model. Contained prefix-resolution (no retry loop — 2.3).
    if (modelRef.startsWith("combo/")) {
      const resolved = await ctx.runQuery(internal.combos.resolveCombo, { userId, workspaceId, name: modelRef.slice(6) });
      if (!resolved) throw new ConvexError({ code: "invalid_request", detail: `Unknown combo "${modelRef.slice(6)}"` } satisfies ChatErrorInfo);
      modelRef = resolved.ref;
      // round_robin actually rotates: advance the cursor after each pick so the next call hits the next ref.
      // ponytail: resolve + bump are two txns, so two concurrent calls can pick the same ref once —
      // fine for round-robin (best-effort spread, not exactly-once). Fold into one mutation if it matters.
      if (resolved.strategy === "round_robin") await ctx.runMutation(internal.combos.bumpRotation, { comboId: resolved.comboId });
    } else if (modelRef.startsWith("agent/")) {
      const agent = await ctx.runQuery(internal.agentDefs.getOwned, { userId, id: modelRef.slice(6) as any });
      if (!agent) throw new ConvexError({ code: "invalid_request", detail: `Unknown agent "${modelRef.slice(6)}"` } satisfies ChatErrorInfo);
      modelRef = agent.model;
    }
    const i = modelRef.indexOf("/");
    if (i < 1 || i === modelRef.length - 1) throw new ConvexError({ code: "invalid_request", detail: 'model must be "provider/model"' } satisfies ChatErrorInfo);
    const provider = modelRef.slice(0, i);
    const model = modelRef.slice(i + 1);

    const logUsage = (status: string, promptTokens: number, completionTokens: number) =>
      ctx.runMutation(internal.usage.log, { userId, workspaceId, provider, model: modelRef, promptTokens, completionTokens, status });

    // spend-caps (5.3): a workspace with a monthly USD budget blocks NEW calls once it's exceeded.
    // Soft guardrail — a single in-flight call can cross the cap by its own cost. Personal (no ws) = no cap.
    if (workspaceId) {
      const cap = await ctx.runQuery(internal.spendCaps.checkSpendCap, { workspaceId });
      if (cap.over) throw new ConvexError({ code: "quota_exceeded", detail: `Workspace monthly budget reached ($${cap.spentUsd.toFixed(2)} / $${cap.capUsd})` } satisfies ChatErrorInfo);
    }

    // Everything below — including the credential/settings lookups — is inside ONE try so every
    // failure (not just the model call itself) gets classified into a structured ConvexError
    // instead of escaping as a plain Error (which Convex redacts to a bare "Server Error").
    let text = "", promptTokens = 0, completionTokens = 0;
    try {
      const row = await ctx.runQuery(internal.credentials.resolveCred, { userId, workspaceId, provider });
      if (!row) throw new ConvexError({ code: "not_connected", detail: `No credentials for "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });

      // token-savers: a Caveman/Ponytail system prompt when the user has them on — still applied
      // even when agentOpts.system is set, so a global "keep it terse" preference isn't silently
      // dropped just because this message happens to be routed through a saved agent.
      const settings = await ctx.runQuery(internal.settings._getForChat, { userId });
      const sys: string[] = [];
      if (settings.cavemanEnabled) sys.push(CAVEMAN_PROMPT);
      if (settings.ponytailEnabled) sys.push(PONYTAIL_PROMPT);
      if (agentOpts?.system) sys.push(agentOpts.system);
      // recalled memory (hermes model) — off only if the user turned it off; workspace + user scope
      if (settings.memoryEnabled !== false) {
        const mem = await ctx.runQuery(internal.memory._buildContext, { userId, workspaceId });
        if (mem) sys.push(mem);
      }
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
        // provider-pool (2.3): graceful ≤3-attempt failover over LIVE creds (personal +
        // workspace-shared), skipping any in cooldown / marked dead. On a fallback-worthy error we
        // cool the bad cred and try the next; a non-fallback error (400/404) aborts immediately.
        // If the pool is empty we fall back to the resolveCred row. codex/claude OAuth are NOT pooled.
        const tools = agentOpts?.tools ?? (settings.agentMode ? await gatewayTools(ctx, userId) : undefined);
        const genBase = {
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: inputMessages as any,
          ...(tools ? { tools, stopWhen: stepCountIs(agentOpts?.maxSteps ?? 5) } : {}),
          ...(agentOpts?.temperature != null ? { temperature: agentOpts.temperature } : {}),
        };
        const pool = await ctx.runQuery(internal.providerPool.pickCredentials, { userId, workspaceId, provider });
        const candidates = pool.length ? pool : [{ credId: row._id, ciphertext: row.ciphertext }];
        let lastErr: unknown, done = false;
        for (const cred of candidates) {
          const apiKey = await decryptSecret(cred.ciphertext);
          const m = modelFor(provider, model, apiKey);
          if (!m) throw new ConvexError({ code: "internal", detail: `Unknown provider "${provider}"`, provider, model } satisfies ChatErrorInfo & { provider: string; model: string });
          try {
            const result = await generateText({ model: m, ...genBase });
            text = result.text || "(no text)";
            const u: any = result.usage ?? {};
            promptTokens = u.inputTokens ?? u.promptTokens ?? 0;
            completionTokens = u.outputTokens ?? u.completionTokens ?? 0;
            await ctx.runMutation(internal.providerPool.markCredResult, { credId: cred.credId, ok: true });
            done = true;
            break;
          } catch (err) {
            lastErr = err;
            const info = classifyError(err, provider);
            const verdict = await ctx.runMutation(internal.providerPool.markCredResult, { credId: cred.credId, ok: false, code: info.code });
            if (!verdict.retryable && !verdict.dead) throw err; // non-fallback-worthy → surface now
          }
        }
        if (!done) throw lastErr; // every candidate exhausted → surface the last provider error
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
    return { text, promptTokens, completionTokens };
}
