// RFC 7591 Dynamic Client Registration. Records redirect_uris; a client is inert until a user
// approves it on the consent page + completes PKCE.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { clientIp } from "@/lib/origin";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  const redirectUris = body?.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris required" }, { status: 400 });
  }
  try {
    const client = new ConvexHttpClient(CONVEX_URL);
    const r = await client.action(api.mcpOauthNode.registerClient, { name: typeof body.client_name === "string" ? body.client_name : undefined, redirectUris: redirectUris.map(String), ip: clientIp(req) });
    return Response.json(
      { client_id: r.client_id, redirect_uris: r.redirect_uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: any) {
    if (e?.data?.code === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(e.data.retryAfter ?? 60) } });
    return Response.json({ error: "invalid_client_metadata", error_description: String(e?.message ?? e).slice(0, 160) }, { status: 400 });
  }
}
