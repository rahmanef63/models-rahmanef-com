// RFC 9728 — tells an MCP client which authorization server protects /mcp.
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = publicOrigin(req);
  return Response.json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  });
}
