"use node";
// WhatsApp Cloud (Meta) adapter. GET handshake: hub.mode==='subscribe' && hub.verify_token===stored
// → echo hub.challenge (handled by `verify`, the route passes the query through). POST auth =
// X-Hub-Signature-256 'sha256='+HMAC_SHA256(appSecret, rawBody). Extracts entry[].changes[].value.
// messages[] (text.body). Replies via graph.facebook.com. ACK-fast: dedupe + persist → defer dispatch.
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptSecret } from "./crypto";
import { hmacSha256Hex, timingSafeEqual } from "./channelsCrypto";
import { computeReply, notAuthorizedText } from "./channelsDispatch";

const GRAPH = "https://graph.facebook.com/v21.0";
const CHUNK = 4000;

export async function verifyWhatsapp(appSecret: string, signature: string | undefined, rawBody: string): Promise<boolean> {
  if (!signature) return false;
  const expected = "sha256=" + (await hmacSha256Hex(appSecret, rawBody));
  return timingSafeEqual(expected, signature);
}

// first text message across all entries/changes → normalized. Skips statuses + non-text messages.
export function extractWhatsapp(body: any): { externalUserId: string; from: string; text: string; senderName?: string; messageId: string } | null {
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const senderName = value?.contacts?.[0]?.profile?.name;
      for (const m of value?.messages ?? []) {
        const text = m?.type === "text" ? m?.text?.body : undefined;
        if (m?.from && typeof text === "string" && text.trim()) {
          return { externalUserId: String(m.from), from: String(m.from), text, senderName, messageId: String(m.id ?? m.from) };
        }
      }
    }
  }
  return null;
}

// POST to the Cloud API messages endpoint (Bearer access token), chunked to 4000.
export async function sendMessage(phoneNumberId: string, accessToken: string, to: string, text: string): Promise<void> {
  const body = text.trim() || "(empty reply)";
  for (let i = 0; i < body.length; i += CHUNK) {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(i, i + CHUNK) } }),
    });
    if (!res.ok) throw new Error(`WhatsApp send ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// GET handshake — the route passes hub.* query params through. Echo the challenge on a token match.
export const verify = action({
  args: { slug: v.string(), mode: v.optional(v.string()), token: v.optional(v.string()), challenge: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ ok: boolean; challenge?: string }> => {
    const ch = await ctx.runQuery(internal.channelsCore._resolveChannelBySlug, { slug: a.slug });
    if (!ch || ch.kind !== "whatsapp") return { ok: false };
    const { verifyToken } = JSON.parse(await decryptSecret(ch.secretCiphertext));
    if (a.mode === "subscribe" && a.token && verifyToken && timingSafeEqual(a.token, verifyToken)) return { ok: true, challenge: a.challenge };
    return { ok: false };
  },
});

// POST webhook entrypoint (Next route passes the raw body + the X-Hub-Signature-256 header).
export const ingest = action({
  args: { slug: v.string(), rawBody: v.string(), signature: v.optional(v.string()), ip: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ ok: boolean }> => {
    const ch = await ctx.runQuery(internal.channelsCore._resolveChannelBySlug, { slug: a.slug });
    if (!ch || ch.enabled === false || ch.kind !== "whatsapp") return { ok: true }; // ACK; don't leak existence
    const { appSecret, phoneNumberId, accessToken } = JSON.parse(await decryptSecret(ch.secretCiphertext));
    if (!(await verifyWhatsapp(appSecret, a.signature, a.rawBody))) return { ok: true }; // bad sig → drop
    let body: any;
    try { body = JSON.parse(a.rawBody); } catch { return { ok: true }; }
    const msg = extractWhatsapp(body);
    if (!msg) return { ok: true }; // delivery status / non-text — nothing to do
    // spend guard (non-negotiable): cap per-sender + per-channel so a stranger can't drain owner tokens.
    const rlSender = await ctx.runMutation(internal.rateLimit.hit, { key: `chansender:${ch._id}:${msg.externalUserId}`, max: 20, windowMs: 60_000 });
    const rlChan = await ctx.runMutation(internal.rateLimit.hit, { key: `chan:${ch._id}`, max: 120, windowMs: 60_000 });
    if (!rlSender.ok || !rlChan.ok) return { ok: true };
    const dedupeKey = `whatsapp:${ch._id}:${msg.messageId}`;
    const res = await ctx.runMutation(internal.channelsIngest._ingest, { channelId: ch._id, dedupeKey, externalUserId: msg.externalUserId, chatId: msg.from, text: msg.text, senderName: msg.senderName });
    if (!("threadId" in res) || !res.threadId) return { ok: true }; // duplicate or skipped
    // access gate: allowlist bot only spends for approved senders. Denied → no dispatch; hint once.
    const access = await ctx.runMutation(internal.channelsAccess._checkAccess, { channelId: ch._id, externalUserId: msg.externalUserId });
    if (!access.allowed) {
      if (access.firstDeny) await sendMessage(phoneNumberId, accessToken, msg.from, notAuthorizedText(msg.externalUserId)).catch(() => {});
      return { ok: true };
    }
    await ctx.scheduler.runAfter(0, internal.channelWhatsapp.dispatch, { channelId: ch._id, threadId: res.threadId, to: msg.from });
    return { ok: true };
  },
});

// deferred model turn: resolve agent → callForUser → reply to the sender's number → log the outbound.
export const dispatch = internalAction({
  args: { channelId: v.id("channels"), threadId: v.id("threads"), to: v.string() },
  handler: async (ctx, a): Promise<void> => {
    const cx = await ctx.runQuery(internal.channelsIngest._getDispatchContext, { channelId: a.channelId, threadId: a.threadId });
    if (!cx) return;
    const { phoneNumberId, accessToken } = JSON.parse(await decryptSecret(cx.secretCiphertext));
    const { configured, reply } = await computeReply(ctx, cx, a.channelId);
    if (!configured) { await sendMessage(phoneNumberId, accessToken, a.to, reply).catch(() => {}); return; }
    try { await sendMessage(phoneNumberId, accessToken, a.to, reply); } catch (e: any) {
      await ctx.runMutation(internal.channelsIngest._setChannelError, { channelId: a.channelId, error: String(e?.message ?? e) });
      return;
    }
    await ctx.runMutation(internal.channelsIngest._logOut, { channelId: a.channelId, threadId: a.threadId, text: reply });
  },
});
