"use node";
// Agent-surface derivation: turns each toolRegistry entry with surface "agent" into an AI-SDK
// tool() bound to (ctx, userId). `ids` (a saved agentDef's `tools`) filters which are exposed;
// omitted = all agent tools (matches the pre-agentDefs "agent mode" toggle exactly). Handlers are
// surface-agnostic (toolHandlers.ts) and shared with the MCP surface so the two can't diverge.
import { tool, jsonSchema } from "ai";
import { TOOL_REGISTRY } from "./toolRegistry";
import { TOOL_HANDLERS } from "./toolHandlers";
import { mcpClientTools } from "./mcpClientNode";

export async function gatewayTools(ctx: any, userId: any, ids?: string[]): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (const t of TOOL_REGISTRY) {
    if (!t.surfaces.includes("agent")) continue;
    if (ids && !ids.includes(t.id)) continue;
    const handler = TOOL_HANDLERS[t.id];
    if (!handler) continue;
    out[t.id] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.inputSchema as any),
      execute: async (args: any) => handler(ctx, userId, args ?? {}),
    });
  }
  // external MCP servers → mcp__<server>__<tool> tools. AGENT SURFACE ONLY (never re-exported on
  // our own /mcp server — loop guard). `ids` filters them exactly like the registry tools above.
  Object.assign(out, await mcpClientTools(ctx, userId, ids));
  return out;
}
