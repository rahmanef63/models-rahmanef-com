/**
 * Slice contract for `mcp-client` — v0.1.0. Consume external MCP servers as agent tools. Convex
 * functions (mcpServers.ts + mcpClientNode.ts) declared in-place via slice.json rootPaths; the
 * derived mcp__<server>__<tool> tools join gatewayTools (agent surface only). defineSliceContract
 * inlined until the rr CLI is vendored (mirrors the memory slice).
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[]; tools?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "mcp-client",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth", "@modelcontextprotocol/sdk"] },
  provides: {
    components: ["McpServersCard"],
    convex: ["mcpServers.listServers", "mcpServers.addServer", "mcpServers.removeServer", "mcpServers.toggleServer", "mcpClientNode.probeServer"],
    tables: ["mcpServers"],
    tools: ["mcp__<server>__<tool>"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
