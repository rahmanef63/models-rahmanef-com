"use node";
// BYOK chat + agent actions. The model call with the authed user's OWN credential lives in
// callForUser.ts (shared with the MCP path); provider resolution, gateway tools, and error
// classification live in chatProviders / chatTools / chatErrors. This file is just the three
// public actions: chat (interactive), runAgent (a traced task run), testCredential (health check).
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./_shared/auth";
import { generateText, stepCountIs } from "ai";
import { decryptSecret } from "./crypto";
import { SKILLS_REGISTRY } from "./skillsRegistry";
import { callForUser } from "./callForUser";
import { gatewayTools } from "./chatTools";
import { modelFor } from "./chatProviders";
import { classifyError, traceOf, type ChatErrorInfo } from "./chatErrors";

// `agentId` routes the message through a saved agent's instructions/skills/tools/maxSteps
// (same resolution runAgent uses for one-shot task runs) instead of plain chat — this is what
// lets a thread be "bound" to an agent. Either `agentId` or `model` must be given.
export const chat = action({
  args: {
    model: v.optional(v.string()),
    agentId: v.optional(v.id("agentDefs")),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const userId = await requireUser(ctx);
    if (a.agentId) {
      const def = await ctx.runQuery(internal.agentDefs.getOwned, { userId, id: a.agentId });
      if (!def) throw new ConvexError({ code: "not_found", detail: "Agent not found" } satisfies ChatErrorInfo);
      const i = def.model.indexOf("/");
      const provider = def.model.slice(0, i);
      const model = def.model.slice(i + 1);
      if (provider === "openai-codex" || provider === "anthropic-oauth") {
        throw new ConvexError({ code: "invalid_request", detail: "This agent's model doesn't support tools (OAuth subscription providers can't run tool-using agents) — pick an API-key model for it in the Agents tab.", provider, model } satisfies ChatErrorInfo & { provider: string; model: string });
      }
      // skill instructions are reusable snippets selected on the agent — concatenated after the
      // agent's own free-form instructions so a skill can't silently override the agent's intent.
      const skillText = (def.skills ?? [])
        .map((id: string) => SKILLS_REGISTRY.find((s) => s.id === id)?.instructions)
        .filter(Boolean)
        .join("\n\n");
      const system = [def.instructions, skillText].filter(Boolean).join("\n\n") || undefined;
      return callForUser(ctx, userId, def.model, a.messages, { system, tools: gatewayTools(ctx, userId, def.tools), maxSteps: def.maxSteps, temperature: def.temperature });
    }
    if (!a.model) throw new ConvexError({ code: "invalid_request", detail: "model or agentId required" } satisfies ChatErrorInfo);
    return callForUser(ctx, userId, a.model, a.messages);
  },
});

// AI Agents: run a single task with tools + a multi-step loop, persisting a trace. Needs a
// tool-capable API-key model (codex's ChatGPT-backend path has no tool support here). Either
// `agentId` (a saved agentDefs config — model/instructions/tools/maxSteps/temperature all come
// from there) or `model` (ad-hoc: all gateway tools, maxSteps 8, no instructions — the original
// pre-agentDefs behavior, unchanged) must be given.
export const runAgent = action({
  args: { task: v.string(), model: v.optional(v.string()), agentId: v.optional(v.id("agentDefs")) },
  handler: async (ctx, a): Promise<{ runId: string; text: string }> => {
    const userId = await requireUser(ctx);

    let modelRef: string, instructions: string | undefined, toolIds: string[] | undefined, maxSteps: number, temperature: number | undefined, agentName: string | undefined;
    if (a.agentId) {
      const def = await ctx.runQuery(internal.agentDefs.getOwned, { userId, id: a.agentId });
      if (!def) throw new ConvexError({ code: "not_found", detail: "Agent not found" } satisfies ChatErrorInfo);
      modelRef = def.model;
      // skill instructions are reusable snippets selected on the agent — concatenated after the
      // agent's own free-form instructions so a skill can't silently override the agent's intent.
      const skillText = (def.skills ?? [])
        .map((id) => SKILLS_REGISTRY.find((s) => s.id === id)?.instructions)
        .filter(Boolean)
        .join("\n\n");
      instructions = [def.instructions, skillText].filter(Boolean).join("\n\n") || undefined;
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
        tools: gatewayTools(ctx, userId, toolIds),
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
    const userId = await requireUser(ctx);
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
