// Single source of truth for the gateway tools an agent (or Chat's "agent mode") can call.
// Plain metadata only — no `ai`/`@ai-sdk` imports — so both the "use node" chat.ts (which builds
// the actual `tool()` instances) and the plain agentDefs.ts (which just needs to validate/list
// ids for the UI) can import this without pulling Node-only deps into the wrong runtime.
export const TOOL_REGISTRY = [
  { id: "list_my_providers", label: "List my providers", description: "List the AI providers you've connected (BYOK)." },
  { id: "get_my_usage", label: "Get my usage", description: "Get your model usage stats (requests, tokens, per-model, per-day)." },
  { id: "get_model_catalog", label: "Search model catalog", description: "Search the models.dev catalog for a provider's available models (context size, cost, tool support)." },
  { id: "list_my_agents", label: "List my agents", description: "List your other saved agent configs (name, model, tool count)." },
] as const;

export type ToolId = (typeof TOOL_REGISTRY)[number]["id"];
export const TOOL_IDS: readonly string[] = TOOL_REGISTRY.map((t) => t.id);
