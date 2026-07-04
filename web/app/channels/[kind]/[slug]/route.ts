// Inbound channel webhook (thin proxy → Convex, same shape as /v1 and /mcp). The per-channel platform
// secret is the auth — verified INSIDE the Convex action against the channel's stored secret; the slug
// is lookup-only. Signature-verified kinds (slack/whatsapp/discord) need the EXACT bytes, so we read
// req.text() (NOT req.json()) and hand the raw body + platform signature headers to the action. We ACK
// fast: the action dedupes + persists then defers the model turn (telegram/slack/whatsapp) or answers
// inline (discord interactions). Never leak internals to the platform.
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { clientIp } from "@/lib/origin";

export const runtime = "nodejs";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
const client = () => new ConvexHttpClient(CONVEX_URL);
const ok = (body = "ok") => new Response(body, { status: 200 });

export async function POST(req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await ctx.params;
  const ip = clientIp(req);

  if (kind === "telegram") {
    let update: unknown;
    try { update = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token") || undefined;
    try { await client().action(api.channelTelegram.ingest, { slug, secretToken, update, ip }); } catch {}
    return ok();
  }

  if (kind === "slack") {
    const rawBody = await req.text();
    const signature = req.headers.get("x-slack-signature") || undefined;
    const timestamp = req.headers.get("x-slack-request-timestamp") || undefined;
    try {
      const r = await client().action(api.channelSlack.ingest, { slug, rawBody, signature, timestamp, ip });
      if (r?.challenge) return new Response(r.challenge, { status: 200, headers: { "content-type": "text/plain" } });
    } catch {}
    return ok(""); // Slack only needs a 200
  }

  if (kind === "whatsapp") {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256") || undefined;
    try { await client().action(api.channelWhatsapp.ingest, { slug, rawBody, signature, ip }); } catch {}
    return ok(); // Meta retries on non-2xx — always ACK
  }

  if (kind === "discord") {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature-ed25519") || undefined;
    const timestamp = req.headers.get("x-signature-timestamp") || undefined;
    try {
      const r = await client().action(api.channelDiscord.ingest, { slug, rawBody, signature, timestamp, ip });
      if (r?.status === 401) return new Response("invalid request signature", { status: 401 }); // Discord requires 401
      if (r?.json) return Response.json(r.json);
    } catch {}
    return new Response("invalid request signature", { status: 401 }); // action unreachable → fail closed for Discord
  }

  return new Response("unsupported channel kind", { status: 404 });
}

// WhatsApp Cloud GET handshake — Meta calls with hub.mode/hub.verify_token/hub.challenge on subscribe.
// Echo the challenge (as text) on a verify-token match, else 403. Other kinds have no GET webhook.
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await ctx.params;
  if (kind !== "whatsapp") return new Response("not found", { status: 404 });
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode") || undefined;
  const token = url.searchParams.get("hub.verify_token") || undefined;
  const challenge = url.searchParams.get("hub.challenge") || undefined;
  try {
    const r = await client().action(api.channelWhatsapp.verify, { slug, mode, token, challenge });
    if (r?.ok && r.challenge) return new Response(r.challenge, { status: 200, headers: { "content-type": "text/plain" } });
  } catch {}
  return new Response("forbidden", { status: 403 });
}
