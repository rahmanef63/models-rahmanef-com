"use node";
// MCP server core: mint bearer tokens + dispatch JSON-RPC (initialize / tools/list / tools/call).
// Every tool runs as the token's owner (BYOK). Token is validated by hash before any dispatch.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireUser } from "./_shared/auth";
import { TOOL_REGISTRY } from "./toolRegistry";
import { TOOL_HANDLERS } from "./toolHandlers";

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

// MCP-surface tools derived from the shared registry (wire name = mcpName ?? id).
const MCP_TOOLS = TOOL_REGISTRY.filter((t) => t.surfaces.includes("mcp"));
const MCP_TOOL_LIST = MCP_TOOLS.map((t) => ({ name: t.mcpName ?? t.id, description: t.description, inputSchema: t.inputSchema }));
const MCP_BY_NAME = new Map(MCP_TOOLS.map((t) => [t.mcpName ?? t.id, t]));

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
        return ok({ tools: MCP_TOOL_LIST });
      case "tools/call": {
        const params = req.params ?? {};
        const name = params.name;
        const args = params.arguments ?? {};
        await ctx.runMutation(internal.mcp._touchToken, { id: row._id });
        try {
          const entry = MCP_BY_NAME.get(name);
          if (!entry) return fail(-32602, `unknown tool: ${name}`);
          const required = ((entry.inputSchema as any)?.required ?? []) as string[];
          for (const k of required) if (args[k] == null) return fail(-32602, `${name} needs { ${required.join(", ")} }`);
          const result = await TOOL_HANDLERS[entry.id](ctx, userId, args);
          return ok(asText(typeof result === "string" ? result : JSON.stringify(result)));
        } catch (e: any) {
          return ok({ content: [{ type: "text", text: "error: " + String(e?.message ?? e).slice(0, 400) }], isError: true });
        }
      }
      default:
        return fail(-32601, `unknown method: ${req.method}`);
    }
  },
});
