"use node";
// Gateway tools: let a model inspect the caller's OWN gateway (agent mode + AI Agents). Auth flows
// through ctx.runQuery, so a tool only ever sees the authed user's data. Definitions here so both
// the chat action and runAgent share one source; `ids` (from a saved agentDef's `tools` field)
// filters which are exposed; omitted = all (matching the pre-agentDefs "agent mode" toggle exactly).
import { tool, jsonSchema } from "ai";
import { api } from "./_generated/api";
import { TOOL_REGISTRY } from "./toolRegistry";
import { fetchModelsCatalog } from "./chatProviders";

const TOOL_DESC = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.id, t.description]));

export function gatewayTools(ctx: any, ids?: string[]) {
  const noArgs = jsonSchema({ type: "object", properties: {}, additionalProperties: false });
  const catalogArgs = jsonSchema<{ provider: string }>({ type: "object", properties: { provider: { type: "string", description: 'e.g. "anthropic", "openrouter"' } }, required: ["provider"], additionalProperties: false });
  const all: Record<string, any> = {
    list_my_providers: tool({ description: TOOL_DESC.list_my_providers, inputSchema: noArgs, execute: async () => ctx.runQuery(api.credentials.listConfiguredProviders, {}) }),
    get_my_usage: tool({ description: TOOL_DESC.get_my_usage, inputSchema: noArgs, execute: async () => ctx.runQuery(api.usage.myUsage, {}) }),
    get_model_catalog: tool({
      description: TOOL_DESC.get_model_catalog,
      inputSchema: catalogArgs,
      execute: async ({ provider }: { provider: string }) => {
        const catalog = await fetchModelsCatalog();
        const models = (catalog[provider]?.models ?? {}) as Record<string, any>;
        // capped — the full catalog can be hundreds of entries per provider, unbounded would
        // dump way too much into the model's own context for what's meant to be a quick lookup
        return Object.entries(models).slice(0, 30).map(([id, m]) => ({
          id, contextTokens: m?.limit?.context, costInPerM: m?.cost?.input, toolCapable: !!m?.tool_call,
        }));
      },
    }),
    list_my_agents: tool({
      description: TOOL_DESC.list_my_agents,
      inputSchema: noArgs,
      execute: async () => {
        const defs = await ctx.runQuery(api.agentDefs.list, {});
        return defs.map((d: any) => ({ name: d.name, model: d.model, tools: d.tools.length, skills: d.skills?.length ?? 0 }));
      },
    }),
  };
  if (!ids) return all;
  const out: Record<string, any> = {};
  for (const id of ids) if (all[id]) out[id] = all[id];
  return out;
}
