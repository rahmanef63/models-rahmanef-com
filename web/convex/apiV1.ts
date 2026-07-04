"use node";
// /v1 OpenAI-compatible gateway. The Next /v1/[...path] route proxies here (same pattern as /mcp).
// API-KEY auth ONLY (sk-rr-…) — never session auth. Every path lands in callForUser (the one pipeline
// that touches provider creds), scoped to the key's workspace. Non-streaming + pseudo-stream (2.2);
// real streaming/tool-passthrough is 2.6.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callForUser } from "./callForUser";
import { fetchModelsCatalog } from "./chatProviders";

async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const handle = action({
  args: { method: v.string(), path: v.string(), key: v.optional(v.string()), ip: v.optional(v.string()), body: v.any() },
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
      const messages = Array.isArray(body.messages)
        ? body.messages.map((m: any) => ({ role: String(m.role), content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "") }))
        : [];
      if (!model || !messages.length) return err(400, "invalid_request", "'model' and non-empty 'messages' are required.");
      try {
        const r = await callForUser(ctx, userId, workspaceId, model, messages);
        return { kind: "chat", model, text: r.text, promptTokens: r.promptTokens ?? 0, completionTokens: r.completionTokens ?? 0, stream: !!body.stream };
      } catch (e: any) {
        const d = e?.data && typeof e.data === "object" ? e.data : { code: "internal", detail: String(e?.message ?? e) };
        const status = d.code === "invalid_api_key" || d.code === "not_connected" ? 401 : d.code === "rate_limited" ? 429 : d.code === "quota_exceeded" ? 402 : d.code === "not_found" ? 404 : 400;
        return err(status, d.code ?? "error", d.detail ?? "provider error");
      }
    }

    return err(404, "not_found", `No route for ${a.method} /${p}. Supported: POST /v1/chat/completions, GET /v1/models.`);
  },
});
