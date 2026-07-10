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
  memory: (ctx, userId, args) => ctx.runMutation(internal.memory._toolWrite, { userId, op: String(args?.op ?? "add"), text: args?.text, match: args?.match }),
  recall_memory: (ctx, userId, args) => ctx.runQuery(internal.memory._toolSearch, { userId, query: String(args?.query ?? "") }),
  vault_list: (ctx, userId) => ctx.runQuery(internal.memoryNotes._notesForUser, { userId }),
  vault_read: (ctx, userId, args) => ctx.runQuery(internal.memoryNotes._noteRead, { userId, title: String(args?.title ?? "") }),
  vault_write: (ctx, userId, args) => ctx.runMutation(internal.memoryNotes._noteUpsert, { userId, title: String(args?.title ?? ""), text: String(args?.content ?? ""), format: args?.format ? String(args.format) : undefined }),
  doctor: async (ctx, userId) => {
    const [providers, agents, notes] = await Promise.all([
      ctx.runQuery(internal.credentials.providersForUser, { userId }),
      ctx.runQuery(internal.agentDefs.listForUser, { userId }),
      ctx.runQuery(internal.memoryNotes._notesForUser, { userId }),
    ]);
    const issues: string[] = [];
    if (!providers.length) issues.push("No AI providers connected — connect one to run any model.");
    for (const p of providers as any[]) if (p.lastCheckedOk === false) issues.push(`Provider "${p.provider}" failed its last health check (${p.lastCheckedCode ?? "error"}) — re-test or rotate the key.`);
    return {
      providers: (providers as any[]).map((p) => ({ provider: p.provider, kind: p.kind, healthy: p.lastCheckedOk !== false, lastError: p.lastCheckedOk === false ? (p.lastCheckedCode ?? "error") : undefined })),
      counts: { providers: providers.length, agents: agents.length, vaultNotes: notes.length },
      issues: issues.length ? issues : ["All good — providers healthy, nothing to fix."],
    };
  },
  agent_write: (ctx, userId, args) => ctx.runMutation(internal.agentDefs._upsertForUser, { userId, name: String(args?.name ?? ""), model: String(args?.model ?? ""), instructions: args?.instructions != null ? String(args.instructions) : undefined, tools: Array.isArray(args?.tools) ? args.tools.map(String) : undefined, skills: Array.isArray(args?.skills) ? args.skills.map(String) : undefined, maxSteps: typeof args?.maxSteps === "number" ? args.maxSteps : undefined, temperature: typeof args?.temperature === "number" ? args.temperature : undefined }),
  combo_list: (ctx, userId, _args, workspaceId) => workspaceId ? ctx.runQuery(internal.combos._forUser, { userId, workspaceId }) : "No workspace context for combos.",
  combo_write: (ctx, userId, args, workspaceId) => workspaceId ? ctx.runMutation(internal.combos._upsertForUser, { userId, workspaceId, name: String(args?.name ?? ""), refs: Array.isArray(args?.refs) ? args.refs.map(String) : [], strategy: String(args?.strategy ?? "fallback") }) : "No workspace context for combos.",
  schedule_list: (ctx, userId, _args, workspaceId) => workspaceId ? ctx.runQuery(internal.scheduledAgents._forUser, { userId, workspaceId }) : "No workspace context for schedules.",
  schedule_write: (ctx, userId, args, workspaceId) => workspaceId ? ctx.runMutation(internal.scheduledAgents._createForUser, { userId, workspaceId, agentName: String(args?.agentName ?? ""), prompt: String(args?.prompt ?? ""), everyMinutes: Number(args?.everyMinutes ?? 15) }) : "No workspace context for schedules.",
  get_budget_status: async (ctx, _userId, _args, workspaceId) => {
    if (!workspaceId) return "No workspace context.";
    const s: any = await ctx.runQuery(internal.spendCaps.checkSpendCap, { workspaceId });
    return { spentUsd: Math.round(s.spentUsd * 100) / 100, capUsd: s.capUsd, over: s.over, pctLeft: s.capUsd ? Math.max(0, Math.round((1 - s.spentUsd / s.capUsd) * 100)) : null };
  },
  chat: async (ctx, userId, args, workspaceId) => {
    const r = await callForUser(ctx, userId, workspaceId, String(args.model), [{ role: "user", content: String(args.prompt) }]); // token-bound workspace creds
    return r.text; // string → MCP asText(); chat is MCP-only, so no agent path hits this
  },
};
