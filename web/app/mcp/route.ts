// MCP endpoint on the app host (https://models.rahmanef.com/mcp). Thin proxy: pull the bearer
// token + JSON-RPC body, hand both to Convex (which validates the token and dispatches). Keeping
// it here (not on convex.site) means the OAuth .well-known metadata can live on the same host later.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="models.rahmanef.com"' } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  }
  const client = new ConvexHttpClient(CONVEX_URL);
  const result: any = await client.action(api.mcpNode.rpc, { token, request: body });
  const status = result?.error?.code === -32001 ? 401 : 200;
  return Response.json(result, { status });
}

export async function GET() {
  return Response.json({ name: "models.rahmanef.com MCP", transport: "streamable-http (JSON-RPC over POST)", auth: "Bearer <mcp token>" });
}
