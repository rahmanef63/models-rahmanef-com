"use node";
// /v1 OpenAI-compatible gateway. The Next /v1/[...path] route proxies here (same pattern as /mcp).
// API-KEY auth ONLY (sk-rr-…) — never session auth. Every path lands in callForUser (the one pipeline
// that touches provider creds), scoped to the key's workspace. Non-streaming + pseudo-stream (2.2).
// Tool passthrough is OUTBOUND-only: client tool declarations reach the model and its tool-calls are
// returned (both wire formats) — feeding tool RESULTS back in (inbound) + real SSE are still pending.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { tool, jsonSchema } from "ai";
import { callForUser } from "./callForUser";
import { fetchModelsCatalog } from "./chatProviders";
import { parseOpenAITools, parseAnthropicTools, toOpenAIToolCalls, toAnthropicToolUse, toModelMessagesOpenAI, toModelMessagesAnthropic, type ToolSpec } from "./apiV1Tools";

async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// client tool declarations → execute-less AI-SDK tools. No `execute` = the model emits the call and
// the SDK returns it (finishReason "tool-calls") instead of running it — that's the passthrough.
function passthroughTools(specs: ToolSpec[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const s of specs) out[s.name] = tool({ description: s.description, inputSchema: jsonSchema(s.parameters as any) });
  return out;
}

export const handle = action({
  args: { method: v.string(), path: v.string(), key: v.optional(v.string()), ip: v.optional(v.string()), body: v.optional(v.any()) },
  handler: async (ctx, a): Promise<any> => {
    const err = (status: number, code: string, message: string) => ({ kind: "error", status, code, message });
    if (!a.key) return err(401, "missing_key", "Provide an API key via 'Authorization: Bearer sk-rr-…' or 'x-api-key'.");

    const ipRl = await ctx.runMutation(internal.rateLimit.hit, { key: `v1ip:${a.ip ?? "?"}`, max: 240, windowMs: 60_000 });
    if (!ipRl.ok) return err(429, "rate_limited", "Too many requests from this address.");
    const auth = await ctx.runQuery(internal.apiKeys._validate, { keyHash: await sha256hex(a.key) });
    if (!auth) return err(401, "invalid_key", "Invalid or revoked API key.");
    const rl = await ctx.runMutation(internal.rateLimit.hit, { key: `v1key:${auth.apiKeyId}`, max: 120, windowMs: 60_000 });
    if (!rl.ok) return err(429, "rate_limited", "Rate limit exceeded for this key (120/min).");
    await ctx.runMutation(internal.apiKeys._touch, { id: auth.apiKeyId });
    const { userId, workspaceId } = auth;

    const p = a.path.replace(/^\/+|\/+$/g, "");

    if (a.method === "GET" && (p === "v1/models" || p === "models")) {
      const catalog = await fetchModelsCatalog().catch(() => ({} as Record<string, any>));
      const providers = await ctx.runQuery(internal.credentials.providersForUser, { userId });
      const data: any[] = [];
      for (const pr of providers as { provider: string }[]) {
        const models = (catalog[pr.provider]?.models ?? {}) as Record<string, unknown>;
        for (const id of Object.keys(models).slice(0, 25)) data.push({ id: `${pr.provider}/${id}`, object: "model", created: 0, owned_by: pr.provider });
      }
      return { kind: "models", data };
    }

    if (a.method === "POST" && (p === "v1/chat/completions" || p === "chat/completions")) {
      const body = a.body ?? {};
      const model = String(body.model ?? "");
      // toModelMessagesOpenAI maps assistant tool_calls + role:'tool' results into AI-SDK parts so a
      // multi-turn tool loop round-trips; a plain {role,content} chat maps to itself.
      const messages = Array.isArray(body.messages) ? toModelMessagesOpenAI(body.messages) : [];
      if (!model || !messages.length) return err(400, "invalid_request", "'model' and non-empty 'messages' are required.");
      const { specs, toolChoice } = parseOpenAITools(body);
      const opts = specs.length ? { tools: passthroughTools(specs), toolChoice } : undefined;
      try {
        const r = await callForUser(ctx, userId, workspaceId, model, messages, opts);
        const toolCalls = r.toolCalls?.length ? toOpenAIToolCalls(r.toolCalls) : undefined;
        return { kind: "chat", model, text: r.text, promptTokens: r.promptTokens ?? 0, completionTokens: r.completionTokens ?? 0, stream: !!body.stream, toolCalls };
      } catch (e: any) {
        const d = e?.data && typeof e.data === "object" ? e.data : { code: "internal", detail: String(e?.message ?? e) };
        const status = d.code === "invalid_api_key" || d.code === "not_connected" ? 401 : d.code === "rate_limited" ? 429 : d.code === "quota_exceeded" ? 402 : d.code === "not_found" ? 404 : 400;
        return err(status, d.code ?? "error", d.detail ?? "provider error");
      }
    }

    // Anthropic Messages API — so Claude Code (ANTHROPIC_BASE_URL=…, ANTHROPIC_AUTH_TOKEN=sk-rr-…) works.
    if (a.method === "POST" && (p === "v1/messages" || p === "messages")) {
      const body = a.body ?? {};
      let model = String(body.model ?? "");
      if (model && !model.includes("/")) model = "anthropic/" + model; // Claude Code sends bare "claude-…" names
      const system = body.system ? (typeof body.system === "string" ? body.system : Array.isArray(body.system) ? body.system.map((b: any) => b?.text ?? "").join("\n") : undefined) : undefined;
      // toModelMessagesAnthropic maps tool_use / tool_result content blocks into AI-SDK parts (a
      // tool_result user turn splits into a leading role:'tool' message) for multi-turn tool loops.
      const msgs = Array.isArray(body.messages) ? toModelMessagesAnthropic(body.messages) : [];
      if (!model || !msgs.length) return err(400, "invalid_request", "'model' and non-empty 'messages' are required.");
      const { specs, toolChoice } = parseAnthropicTools(body);
      const opts = specs.length ? { ...(system ? { system } : {}), tools: passthroughTools(specs), toolChoice } : system ? { system } : undefined;
      try {
        const r = await callForUser(ctx, userId, workspaceId, model, msgs, opts);
        const toolUse = r.toolCalls?.length ? toAnthropicToolUse(r.toolCalls) : undefined;
        return { kind: "anthropic", model: String(body.model ?? ""), text: r.text, promptTokens: r.promptTokens ?? 0, completionTokens: r.completionTokens ?? 0, stream: !!body.stream, toolUse };
      } catch (e: any) {
        const d = e?.data && typeof e.data === "object" ? e.data : { code: "internal", detail: String(e?.message ?? e) };
        const status = d.code === "invalid_api_key" || d.code === "not_connected" ? 401 : d.code === "rate_limited" ? 429 : d.code === "quota_exceeded" ? 402 : d.code === "not_found" ? 404 : 400;
        return err(status, d.code ?? "error", d.detail ?? "provider error");
      }
    }

    return err(404, "not_found", `No route for ${a.method} /${p}. Supported: POST /v1/chat/completions, POST /v1/messages, GET /v1/models.`);
  },
});
