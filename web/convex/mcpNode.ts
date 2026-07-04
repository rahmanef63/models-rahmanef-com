"use node";
// MCP server core: mint bearer tokens + dispatch JSON-RPC (initialize / tools/list / tools/call).
// Every tool runs as the token's owner (BYOK). Token is validated by hash before any dispatch.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./_shared/auth";
import { callForUser } from "./callForUser";

async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function selfHost(): string {
  try { return new URL(process.env.SITE_URL || "").host || "models-gateway"; } catch { return "models-gateway"; }
}
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const issueMcpToken = action({
  args: { label: v.string() },
  handler: async (ctx, a): Promise<{ token: string }> => {
    const userId = await requireUser(ctx);
    const raw = "mcp_" + b64url(crypto.getRandomValues(new Uint8Array(32)));
    await ctx.runMutation(internal.mcp._storeToken, { userId, tokenHash: await sha256hex(raw), label: a.label || "token" });
    return { token: raw }; // shown to the user exactly once
  },
});

const TOOLS = [
  { name: "list_providers", description: "List the AI providers you have connected (BYOK).", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_usage", description: "Your model usage stats: requests, tokens in/out, per model.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "chat", description: "Send a prompt to one of your connected models. 'model' is a 'provider/model' ref.", inputSchema: { type: "object", properties: { model: { type: "string" }, prompt: { type: "string" } }, required: ["model", "prompt"], additionalProperties: false } },
];

const asText = (text: string) => ({ content: [{ type: "text", text }] });

// Public action (the Next /mcp route proxies here); auth is the MCP bearer token, validated inside.
export const rpc = action({
  args: { token: v.string(), request: v.any(), ip: v.optional(v.string()) },
  handler: async (ctx, a): Promise<any> => {
    const req = a.request ?? {};
    const id = req.id ?? null;
    const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

    // Pre-auth flood guard by IP (invalid-token spam still costs a sha256 + query per hit).
    const ipRl = await ctx.runMutation(internal.rateLimit.hit, { key: `mcpip:${a.ip ?? "?"}`, max: 240, windowMs: 60_000 });
    if (!ipRl.ok) return fail(-32029, `rate limited — retry in ${ipRl.retryAfter}s`);

    const row = await ctx.runQuery(internal.mcp._validateToken, { tokenHash: await sha256hex(a.token || "") });
    if (!row) return fail(-32001, "unauthorized — invalid or revoked MCP token");
    const userId = row.userId;

    const rl = await ctx.runMutation(internal.rateLimit.hit, { key: `mcp:${row._id}`, max: 120, windowMs: 60_000 }); // 120 calls / min / token
    if (!rl.ok) return fail(-32029, `rate limited — retry in ${rl.retryAfter}s`);

    switch (req.method) {
      case "initialize":
        return ok({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: selfHost(), version: "1.0.0" } });
      case "notifications/initialized":
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS });
      case "tools/call": {
        const params = req.params ?? {};
        const name = params.name;
        const args = params.arguments ?? {};
        await ctx.runMutation(internal.mcp._touchToken, { id: row._id });
        try {
          if (name === "list_providers") return ok(asText(JSON.stringify(await ctx.runQuery(internal.mcp._providersForUser, { userId }))));
          if (name === "get_usage") return ok(asText(JSON.stringify(await ctx.runQuery(internal.mcp._usageForUser, { userId }))));
          if (name === "chat") {
            if (!args.model || !args.prompt) return fail(-32602, "chat needs { model, prompt }");
            const r = await callForUser(ctx, userId, String(args.model), [{ role: "user", content: String(args.prompt) }]);
            return ok(asText(r.text));
          }
          return fail(-32602, `unknown tool: ${name}`);
        } catch (e: any) {
          return ok({ content: [{ type: "text", text: "error: " + String(e?.message ?? e).slice(0, 400) }], isError: true });
        }
      }
      default:
        return fail(-32601, `unknown method: ${req.method}`);
    }
  },
});
