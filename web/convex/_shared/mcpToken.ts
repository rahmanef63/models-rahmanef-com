// Lifetime of an issued MCP bearer. Lives here (not in mcp.ts) so the "use node" minting path in
// mcpOauthNode.ts can read it without importing a module that defines Convex functions.
// Revocation is the real deauth mechanism — workspace membership is re-checked on EVERY rpc, so
// removing a member kills their live bearer immediately. This TTL is the backstop for the token
// nobody remembers issuing.
export const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
