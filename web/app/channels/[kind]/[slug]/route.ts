// Inbound channel webhook (thin proxy → Convex, same shape as /v1 and /mcp). The per-channel
// platform secret is the auth (Telegram: X-Telegram-Bot-Api-Secret-Token) — verified inside the
// Convex action against the channel's stored secret; the slug is lookup-only. We ACK 200 fast:
// the action dedupes + persists then defers the model turn to the scheduler, so Telegram's short
// webhook budget is respected. Always 200 on a well-formed update (dedupe absorbs retries).
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { clientIp } from "@/lib/origin";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";

export async function POST(req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await ctx.params;
  if (kind !== "telegram") return new Response("unsupported channel kind", { status: 404 });

  let update: unknown;
  try { update = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  const secretToken = req.headers.get("x-telegram-bot-api-secret-token") || undefined;
  try {
    const client = new ConvexHttpClient(CONVEX_URL);
    await client.action(api.channelTelegram.ingest, { slug, secretToken, update, ip: clientIp(req) });
  } catch {
    // never surface internals to the platform; a 200 avoids a retry storm (dedupe covers real retries).
  }
  return new Response("ok", { status: 200 });
}
