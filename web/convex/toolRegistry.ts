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
  { id: "memory", label: "Remember",
    description: "Save or remove a durable memory about the user. Save PROACTIVELY when the user corrects you, states a preference, or shares a lasting fact — SKIP transient task progress. op='add' with text; op='remove' with match (a substring of the memory to drop).",
    inputSchema: { type: "object", properties: { op: { type: "string", enum: ["add", "remove"] }, text: { type: "string" }, match: { type: "string" } }, required: ["op"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "recall_memory", label: "Recall memory",
    description: "Search your saved memories about the user for relevant facts/preferences.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "vault_list", label: "List vault notes",
    description: "List your knowledge-vault notes (title, format, size). Call before writing to see what already exists and avoid duplicates.",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "vault_read", label: "Read a vault note",
    description: "Read a vault note's full content, by its title.",
    inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "vault_write", label: "Write a vault note",
    description: "Create or update a vault note — a markdown or JSON document in your durable knowledge base. Matches an existing note by title (updates it) or creates a new one. Link related notes with [[Other Title]]. Use this for anything worth revisiting; use `memory` for short one-line facts.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, format: { type: "string", enum: ["md", "json"] } }, required: ["title", "content"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "doctor", label: "Diagnose setup",
    description: "Health-check the account: connected providers + their last test result, plus counts and any issues to fix (unconnected/failing providers, etc). Run this first when something isn't working.",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "agent_write", label: "Create/update an agent",
    description: "Create or update a saved agent config, matched by name. model is a 'provider/model' ref. tools/skills are ids from list_my_agents' registry. Use this to set up specialized agents for the user.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, model: { type: "string" }, instructions: { type: "string" }, tools: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, maxSteps: { type: "number" }, temperature: { type: "number" } }, required: ["name", "model"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "combo_list", label: "List model combos",
    description: "List this workspace's model combos (routing aliases: one name → several models, with fallback/round-robin).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "combo_write", label: "Create/update a combo",
    description: "Create or update a model combo (routing alias), matched by name. refs are 'provider/model' strings (≤5); strategy is 'fallback' or 'round_robin'. Target it later as 'combo/<name>'.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, refs: { type: "array", items: { type: "string" } }, strategy: { type: "string", enum: ["fallback", "round_robin"] } }, required: ["name", "refs", "strategy"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "schedule_list", label: "List schedules",
    description: "List this workspace's scheduled agents (which agent, prompt, interval, status).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "schedule_write", label: "Schedule an agent",
    description: "Run one of your saved agents (by name) on a recurring interval. everyMinutes is floored at 15. Re-scheduling the same agent+prompt updates the interval instead of stacking.",
    inputSchema: { type: "object", properties: { agentName: { type: "string" }, prompt: { type: "string" }, everyMinutes: { type: "number" } }, required: ["agentName", "prompt", "everyMinutes"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "get_budget_status", label: "Get budget status",
    description: "This workspace's current-month spend vs its monthly cap (spent, cap, % left, over?).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "channel_list", label: "List channels",
    description: "List this workspace's inbound messaging channels (kind, slug, bound agent/model, status).",
    inputSchema: NO_ARGS, surfaces: ["agent", "mcp"] },
  { id: "channel_create", label: "Create a channel",
    description: "Set up an inbound messaging channel (workspace ADMIN only). kind=telegram|slack|whatsapp|discord. `secrets` is the per-kind bag: telegram{botToken} · slack{signingSecret,botToken} · whatsapp{appSecret,verifyToken,phoneNumberId,accessToken} · discord{publicKey,botToken?,applicationId?}. Optionally bind an agent by name. Returns the webhook path to point the platform at.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["telegram", "slack", "whatsapp", "discord"] }, name: { type: "string" }, secrets: { type: "object", properties: { botToken: { type: "string" }, signingSecret: { type: "string" }, appSecret: { type: "string" }, verifyToken: { type: "string" }, phoneNumberId: { type: "string" }, accessToken: { type: "string" }, publicKey: { type: "string" }, applicationId: { type: "string" } }, additionalProperties: false }, agentName: { type: "string" } }, required: ["kind", "name", "secrets"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "channel_config", label: "Configure a channel",
    description: "Change a channel by name (ADMIN only): bind an agent (agentName), set its model, and/or enable/disable it.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, model: { type: "string" }, agentName: { type: "string" }, enabled: { type: "boolean" } }, required: ["name"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "connect_provider", label: "Connect a provider",
    description: "Connect one of the 22 built-in AI providers with an API key (openai, anthropic, google, groq, openrouter, mistral, …). OAuth-login providers must be connected in the UI. For a custom endpoint, use connect_custom_provider.",
    inputSchema: { type: "object", properties: { provider: { type: "string" }, apiKey: { type: "string" } }, required: ["provider", "apiKey"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
  { id: "connect_custom_provider", label: "Connect a custom provider",
    description: "Connect a custom endpoint. Pick a name (becomes the provider slug), a baseURL, an API key, and optionally protocol ('openai' default = /chat/completions, or 'anthropic' = the Messages API at {baseURL}/messages). Target models as '<name>/<model>'. Private/loopback/metadata URLs are blocked.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, baseURL: { type: "string" }, apiKey: { type: "string" }, protocol: { type: "string", enum: ["openai", "anthropic"] } }, required: ["name", "baseURL", "apiKey"], additionalProperties: false },
    surfaces: ["agent", "mcp"] },
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
