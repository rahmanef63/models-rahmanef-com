"use node";
// Surface-agnostic handlers for the tools declared in toolRegistry.ts. Each takes (ctx, userId,
// args) and returns a plain JSON-serialisable value: the agent surface (chatTools) wraps it as an
// AI-SDK tool() result; the MCP surface (mcpNode) JSON-stringifies it into a text block. Using an
// EXPLICIT userId (not getAuthUserId) is what lets ONE handler serve both the authed agent path and
// the token-authed MCP path — the MCP action ctx has no auth session to derive a user from.
import { internal } from "./_generated/api";
import { fetchModelsCatalog } from "./chatProviders";
import { callForUser } from "./callForUser";

// workspaceId (4th arg) is only used by the MCP `chat` tool (the sole spend tool); read-only tools ignore it.
export type ToolHandler = (ctx: any, userId: any, args: any, workspaceId?: any) => Promise<unknown>;

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_my_providers: (ctx, userId) => ctx.runQuery(internal.credentials.providersForUser, { userId }),
  get_my_usage: (ctx, userId) => ctx.runQuery(internal.usage.usageForUser, { userId }),
  get_model_catalog: async (_ctx, _userId, args) => {
    const catalog = await fetchModelsCatalog();
    const models = (catalog[String(args?.provider ?? "")]?.models ?? {}) as Record<string, any>;
    // capped at 30 — full per-provider catalogs run to hundreds; unbounded floods the model context
    return Object.entries(models).slice(0, 30).map(([id, m]) => ({
      id, contextTokens: m?.limit?.context, costInPerM: m?.cost?.input, toolCapable: !!m?.tool_call,
    }));
  },
  list_my_agents: async (ctx, userId) => {
    const defs = await ctx.runQuery(internal.agentDefs.listForUser, { userId });
    return defs.map((d: any) => ({ name: d.name, model: d.model, tools: d.tools.length, skills: d.skills?.length ?? 0 }));
  },
  chat: async (ctx, userId, args, workspaceId) => {
    const r = await callForUser(ctx, userId, workspaceId, String(args.model), [{ role: "user", content: String(args.prompt) }]); // token-bound workspace creds
    return r.text; // string → MCP asText(); chat is MCP-only, so no agent path hits this
  },
};
