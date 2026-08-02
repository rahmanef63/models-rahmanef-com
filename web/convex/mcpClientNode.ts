"use node";
// OUTBOUND MCP client (we are the client). Uses the official @modelcontextprotocol/sdk — ai@7.0.11
// has no experimental_createMCPClient. probeServer enumerates+caches an external server's tools;
// mcpClientTools() turns each cached tool into an AI-SDK tool() named mcp__<server>__<toolname>
// whose execute() does a fresh connect→callTool→close per invocation (no persistent process;
// ~100-400ms is acceptable). Header/credential values are STRIPPED from any error text before it
// reaches the model. LOOP GUARD: these tools are surfaced ONLY to agents (gatewayTools) — they are
// NEVER re-exported on our own /mcp server, or an A→B→A cycle could form.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { tool, jsonSchema } from "ai";
import { requireUser } from "./_shared/auth";
import { decryptSecret } from "./crypto";
import { assertSafeUrl } from "./_shared/ssrf";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

type Srv = { name: string; url: string; transport: string; headersCiphertext?: string };

async function connect(srv: Srv, headers?: Record<string, string>): Promise<Client> {
  const client = new Client({ name: "models-gateway", version: "1.0.0" }, { capabilities: {} });
  const url = assertSafeUrl(srv.url); // re-check at connect time (defense vs a row that predates the guard)
  const opts = headers ? { requestInit: { headers } } : undefined;
  const transport = srv.transport === "sse" ? new SSEClientTransport(url, opts) : new StreamableHTTPClientTransport(url, opts);
  await client.connect(transport);
  return client;
}

// remove any secret header value from a string before it can be surfaced to the model
function redact(msg: unknown, secrets: string[]): string {
  let s = String(msg ?? "");
  for (const val of secrets) if (val) s = s.split(val).join("[redacted]");
  return s;
}

const decodeHeaders = async (ct?: string): Promise<Record<string, string> | undefined> =>
  ct ? (JSON.parse(await decryptSecret(ct)) as Record<string, string>) : undefined;

// Connect, list tools, cache name/description/inputSchema; record probe result. Owner-scoped.
export const probeServer = action({
  args: { serverId: v.id("mcpServers") },
  handler: async (ctx, a): Promise<{ ok: boolean; toolCount?: number; error?: string }> => {
    const userId = await requireUser(ctx);
    const srv = await ctx.runQuery(internal.mcpServers._getForProbe, { serverId: a.serverId, userId });
    if (!srv) throw new ConvexError({ code: "not_found", detail: "server not found" });
    const headers = await decodeHeaders(srv.headersCiphertext);
    const secrets = Object.values(headers ?? {});
    try {
      const client = await connect(srv, headers);
      const res = await client.listTools();
      await client.close();
      const tools = (res.tools ?? []).map((t: any) => ({ name: t.name, description: t.description ?? "", inputSchema: t.inputSchema ?? { type: "object", properties: {} } }));
      await ctx.runMutation(internal.mcpServers._recordProbe, { serverId: a.serverId, ok: true, tools });
      return { ok: true, toolCount: tools.length };
    } catch (e) {
      const err = redact(e instanceof Error ? e.message : e, secrets).slice(0, 500);
      await ctx.runMutation(internal.mcpServers._recordProbe, { serverId: a.serverId, ok: false, error: err });
      return { ok: false, error: err };
    }
  },
});

// one remote call: fresh connect → callTool → close. Errors are redacted of credential material.
async function callRemote(srv: Srv, headers: Record<string, string> | undefined, toolName: string, args: any): Promise<string> {
  const secrets = Object.values(headers ?? {});
  let client: Client | undefined;
  try {
    client = await connect(srv, headers);
    const res: any = await client.callTool({ name: toolName, arguments: args ?? {} });
    const parts = Array.isArray(res?.content) ? res.content : [];
    const text = parts.map((p: any) => (p?.type === "text" ? p.text : JSON.stringify(p))).join("\n").trim();
    if (res?.isError) return `Tool error: ${redact(text || "(no detail)", secrets)}`;
    return text || "(no content)";
  } catch (e) {
    return `MCP call failed: ${redact(e instanceof Error ? e.message : e, secrets).slice(0, 400)}`;
  } finally {
    try { await client?.close(); } catch { /* ignore close errors */ }
  }
}

// Build AI-SDK tools from every enabled server's cached tool list. `ids` filters by tool id the
// same way the registry tools are filtered (a saved agentDef's `tools`). AGENT SURFACE ONLY.
export async function mcpClientTools(ctx: any, userId: any, ids?: string[], workspaceId?: any): Promise<Record<string, any>> {
  const servers = await ctx.runQuery(internal.mcpServers._enabledServers, { userId, workspaceId });
  const out: Record<string, any> = {};
  for (const s of servers as (Srv & { toolCache: any[] })[]) {
    const headers = await decodeHeaders(s.headersCiphertext);
    for (const t of s.toolCache ?? []) {
      const id = `mcp__${s.name}__${t.name}`;
      if (ids && !ids.includes(id)) continue;
      out[id] = tool({
        description: t.description || `(${s.name}) ${t.name}`,
        inputSchema: jsonSchema((t.inputSchema ?? { type: "object", properties: {} }) as any),
        execute: async (args: any) => callRemote(s, headers, t.name, args),
      });
    }
  }
  return out;
}
