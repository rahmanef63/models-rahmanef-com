// RFC 8414 — authorization-server metadata. Public clients, PKCE S256, DCR enabled.
import { publicOrigin } from "@/lib/origin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = publicOrigin(req);
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
}
