import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";

// OpenRouter redirects here with ?code=... after the user authorizes. We exchange it
// (as the logged-in user) for an sk-or key and store it, then bounce back to the dashboard.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;
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
