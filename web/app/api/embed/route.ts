// Public chat endpoint for the embed widget. The widget (running on the CUSTOMER'S page) POSTs here;
// origin is the customer's site. embedChat.reply validates token + origin allowlist + rate limit and
// returns allowOrigin only when the origin is approved — so we CORS-allow exactly that origin, and a
// disallowed origin gets no CORS header (browser blocks it). Non-browser abuse is bounded by the
// per-embed rate limit + the owner's spend cap, since Origin can be forged outside a browser.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

const cors = (origin: string): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  Vary: "Origin",
});

export function OPTIONS(req: Request) {
  // Preflight can't carry the body/token; reflect the origin so the browser will send the POST,
  // which does the real allowlist check. A disallowed origin just fails there.
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin") || "*") });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") || "";
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "bad request" }, { status: 400 }); }
  const token = String(body?.token ?? "");
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-16) : [];
  if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 400 });

  const client = new ConvexHttpClient(CONVEX_URL);
  const result: any = await client.action(api.embedChat.reply, { token, origin, messages });
  // allowOrigin is set only when the origin passed the allowlist — CORS-allow exactly that.
  const headers = result?.allowOrigin ? cors(result.allowOrigin) : {};
  const status = result?.allowOrigin ? 200 : 403;
  return Response.json(result?.ok ? { ok: true, reply: result.reply } : { ok: false, error: result?.error ?? "error" }, { status, headers });
}
