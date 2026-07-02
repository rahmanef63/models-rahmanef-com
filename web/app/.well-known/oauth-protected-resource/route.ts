// RFC 9728 — tells an MCP client which authorization server protects /mcp.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  });
}
