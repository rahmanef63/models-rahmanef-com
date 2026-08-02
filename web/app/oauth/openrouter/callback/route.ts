import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { publicOrigin } from "@/lib/origin";

// OpenRouter redirects here with ?code=... after the user authorizes. We exchange it
// (as the logged-in user) for an sk-or key and store it, then bounce back to the dashboard.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  // req.nextUrl.origin is wrong under this app's `output: "standalone"` build (resolves to the
  // standalone server's own bind address, 0.0.0.0:3000, not the public host) — same bug already
  // fixed for the MCP routes (commit 5f9bccd). Reuse the shared resolver instead.
  const origin = publicOrigin(req);
  if (!code) return NextResponse.redirect(`${origin}/app?connect=error`);
  try {
    const token = await convexAuthNextjsToken();
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (token) client.setAuth(token);
    await client.action(api.oauth.finishOpenRouterConnect, { code });
    return NextResponse.redirect(`${origin}/app?connect=openrouter`);
  } catch {
    return NextResponse.redirect(`${origin}/app?connect=error`);
  }
}
