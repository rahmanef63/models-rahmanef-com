// MCP endpoint on the app host (SITE_URL + /mcp). Thin proxy: pull the bearer token + JSON-RPC
// body, hand both to Convex (which validates the token and dispatches). Keeping it here (not on
// convex.site) means the OAuth .well-known metadata can live on the same host later.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { publicOrigin, clientIp } from "@/lib/origin";

export const runtime = "nodejs";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

export async function POST(req: Request) {
  const origin = publicOrigin(req);
  const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": challenge } });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  }
  const client = new ConvexHttpClient(CONVEX_URL);
  const result: any = await client.action(api.mcpNode.rpc, { token, request: body, ip: clientIp(req) });
  if (result?.error?.code === -32001) {
    return Response.json(result, { status: 401, headers: { "WWW-Authenticate": challenge } });
  }
  if (result?.error?.code === -32029) {
    return Response.json(result, { status: 429, headers: { "Retry-After": "60" } });
  }
  return Response.json(result, { status: 200 });
}

export async function GET(req: Request) {
  // publicOrigin(req) can return a malformed value if SITE_URL is set without a scheme — don't
  // let a bad env var 500 this discovery endpoint, just fall back to a generic label.
  let host = "models-gateway";
  try { host = new URL(publicOrigin(req)).host; } catch { /* keep fallback */ }
  return Response.json({ name: `${host} MCP`, transport: "streamable-http (JSON-RPC over POST)", auth: "Bearer <mcp token>" });
}
