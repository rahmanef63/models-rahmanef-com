// OAuth token endpoint. authorization_code grant only, PKCE required. Accepts form or JSON.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  const p: Record<string, string> = {};
  if (ct.includes("application/json")) {
    Object.assign(p, await req.json().catch(() => ({})));
  } else {
    const f = await req.formData().catch(() => null);
    if (f) for (const [k, v] of f.entries()) p[k] = String(v);
  }
  if (p.grant_type !== "authorization_code") return json({ error: "unsupported_grant_type" }, 400);
  if (!p.code || !p.code_verifier || !p.client_id || !p.redirect_uri) return json({ error: "invalid_request" }, 400);
  try {
    const client = new ConvexHttpClient(CONVEX_URL);
    const r = await client.action(api.mcpOauthNode.exchangeCode, { code: p.code, clientId: p.client_id, redirectUri: p.redirect_uri, codeVerifier: p.code_verifier });
    return json({ access_token: r.access_token, token_type: "Bearer", scope: r.scope }, 200);
  } catch {
    // never echo internals — every failure is an opaque invalid_grant
    return json({ error: "invalid_grant" }, 400);
  }
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
