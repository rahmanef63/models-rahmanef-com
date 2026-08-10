/**
 * Slice contract for `mcp-server` — v0.1.0. Serve this gateway's tools over MCP. Convex functions
 * (mcp.ts + mcpNode.ts + mcpOauth.ts + mcpOauthNode.ts) declared in-place via slice.json rootPaths
 * — they must NOT move under convex/features/, because Convex derives api paths from file paths and
 * the move would rename api.mcp.* repo-wide (see convex/features/byok/index.ts). The Next routes are
 * declared under provides.routes (the api-compat precedent), not in convex.rootPaths.
 * defineSliceContract inlined until the rr CLI is vendored (mirrors the mcp-client slice).
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[]; tools?: string[]; routes?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "mcp-server",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["McpCard"],
    convex: [
      "mcp.listMcpTokens", "mcp.revokeMcpToken", "mcp.revokeAllMcpTokens",
      "mcpNode.issueMcpToken", "mcpNode.rpc",
      "mcpOauth.clientInfo",
      "mcpOauthNode.registerClient", "mcpOauthNode.createAuthCode", "mcpOauthNode.exchangeCode",
    ],
    tables: ["mcpTokens", "mcpClients", "mcpAuthCodes"],
    tools: ["<every TOOL_REGISTRY entry whose surfaces include 'mcp'>"],
    routes: [
      "/mcp",
      "/oauth/authorize",
      "/oauth/token",
      "/oauth/register",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
    ],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
