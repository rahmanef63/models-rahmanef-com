// Single source of truth for gateway-tool METADATA (id, description, JSON-Schema args, which
// surfaces expose it). NO `ai`/`@ai-sdk`/node imports — plain-runtime callers (agentDefs.ts arg
// validation, the Agents UI registry query) import this. The (ctx,userId,args) HANDLERS live in
// toolHandlers.ts ("use node"); the agent surface (chatTools.gatewayTools) and the MCP surface
// (mcpNode.rpc) both DERIVE from this one registry so they can never diverge again.
export type ToolSurface = "agent" | "mcp";
export type ToolMeta = {
  id: string; // canonical id = agent-surface tool name = agentDefs.tools value
  label: string; // Agents UI tool-picker label
  description: string;
  inputSchema: Record<string, unknown>; // plain JSON Schema (draft-07 object)
  surfaces: readonly ToolSurface[];
  mcpName?: string; // MCP wire name, when it differs from `id`
};

const NO_ARGS = { type: "object", properties: {}, additionalProperties: false } as const;

export const TOOL_REGISTRY: readonly ToolMeta[] = [
  { id: "list_my_providers", mcpName: "list_providers", label: "List my providers",
    description: "List the AI providers you've connected (BYOK).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "get_my_usage", mcpName: "get_usage", label: "Get my usage",
    description: "Get your model usage stats (requests, tokens, per-model, per-day).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "get_model_catalog", label: "Search model catalog",
    description: "Search the models.dev catalog for a provider's available models (context size, cost, tool support).",
    inputSchema: { type: "object", properties: { provider: { type: "string", description: 'e.g. "anthropic", "openrouter"' } }, required: ["provider"], additionalProperties: false },
    surfaces: ["agent"] },
  { id: "list_my_agents", label: "List my agents",
    description: "List your other saved agent configs (name, model, tool count).",
    inputSchema: NO_ARGS, surfaces: ["agent"] },
  { id: "chat", label: "Chat with a model",
    description: "Send a prompt to one of your connected models. 'model' is a 'provider/model' ref.",
    inputSchema: { type: "object", properties: { model: { type: "string" }, prompt: { type: "string" } }, required: ["model", "prompt"], additionalProperties: false },
    surfaces: ["mcp"] },
];

export type ToolId = string;
export const TOOL_IDS: readonly string[] = TOOL_REGISTRY.map((t) => t.id);
// agentDefs may only reference AGENT-surface tools (the Agents UI never offers `chat`). Preserves
// the pre-change 4-tool set exactly.
export const AGENT_TOOLS = TOOL_REGISTRY.filter((t) => t.surfaces.includes("agent"));
export const AGENT_TOOL_IDS: readonly string[] = AGENT_TOOLS.map((t) => t.id);
