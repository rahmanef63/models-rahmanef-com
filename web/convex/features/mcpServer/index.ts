// mcp-server slice — Convex-side barrel. The registered functions stay at the convex ROOT
// (mcp.ts / mcpNode.ts / mcpOauth.ts / mcpOauthNode.ts) on purpose: Convex derives api paths from
// file paths, so moving them here would rename api.mcp.* across the whole repo. The slice declares
// them in place via slice.json -> convex.rootPaths.
export { mcpServerTables } from "./tables";
