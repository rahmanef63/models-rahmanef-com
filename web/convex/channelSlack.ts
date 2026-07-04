"use node";
// Slack adapter. Auth = X-Slack-Signature 'v0='+HMAC_SHA256(signingSecret, `v0:${ts}:${rawBody}`)
// with a <=5min timestamp window. Echoes the url_verification challenge. Skips bot_id/subtype
// messages (loop guard). Replies via chat.postMessage in-thread. ACK-fast: ingest verifies +
// dedupes + persists, then defers the model turn to the scheduler (dispatch) like telegram.
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptSecret } from "./crypto";
import { hmacSha256Hex, timingSafeEqual } from "./channelsCrypto";
import { computeReply } from "./channelsDispatch";

const CHUNK = 3900;
const MAX_SKEW = 5 * 60; // seconds

export async function verifySlack(signingSecret: string, signature: string | undefined, timestamp: string | undefined, rawBody: string): Promise<boolean> {
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW) return false; // replay window
  const expected = "v0=" + (await hmacSha256Hex(signingSecret, `v0:${timestamp}:${rawBody}`));
  return timingSafeEqual(expected, signature);
}

// normalize a Slack event_callback → sendable message. Returns null for bot/subtype/non-text events
// (the loop guard: never answer our own or other bots' posts). Challenge is handled by the caller.
export function extractSlack(body: any): { externalUserId: string; channel: string; threadTs?: string; text: string; senderName?: string; eventId: string } | null {
  const e = body?.event;
  if (!e || e.type !== "message" || e.bot_id || e.subtype) return null;
  const text = typeof e.text === "string" ? e.text : "";
  if (!e.channel || !text.trim()) return null;
  return { externalUserId: String(e.user ?? e.channel), channel: String(e.channel), threadTs: e.thread_ts ?? e.ts, text, senderName: e.user, eventId: String(body.event_id ?? e.ts) };
}

// POST to chat.postMessage (Bearer bot token), chunked to 3900, threaded on thread_ts.
export async function sendMessage(botToken: string, channel: string, text: string, threadTs?: string): Promise<void> {
  const body = text.trim() || "(empty reply)";
  for (let i = 0; i < body.length; i += CHUNK) {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${botToken}` },
      body: JSON.stringify({ channel, text: body.slice(i, i + CHUNK), thread_ts: threadTs }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!j.ok) throw new Error(`Slack chat.postMessage: ${j.error ?? res.status}`);
  }
}

// webhook entrypoint (Next route). Returns { challenge } for url_verification so the route echoes it.
export const ingest = action({
  args: { slug: v.string(), rawBody: v.string(), signature: v.optional(v.string()), timestamp: v.optional(v.string()), ip: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ ok: boolean; challenge?: string }> => {
    const ch = await ctx.runQuery(internal.channelsCore._resolveChannelBySlug, { slug: a.slug });
    if (!ch || ch.enabled === false || ch.kind !== "slack") return { ok: true }; // ACK; don't leak existence
    const { signingSecret } = JSON.parse(await decryptSecret(ch.secretCiphertext));
    if (!(await verifySlack(signingSecret, a.signature, a.timestamp, a.rawBody))) return { ok: true }; // bad sig → drop
    let body: any;
    try { body = JSON.parse(a.rawBody); } catch { return { ok: true }; }
    if (body.type === "url_verification" && typeof body.challenge === "string") return { ok: true, challenge: body.challenge };
    const msg = extractSlack(body);
    if (!msg) return { ok: true }; // bot/subtype/non-text — nothing to do
    // spend guard (non-negotiable): cap per-sender + per-channel so a stranger can't drain owner tokens.
    const rlSender = await ctx.runMutation(internal.rateLimit.hit, { key: `chansender:${ch._id}:${msg.externalUserId}`, max: 20, windowMs: 60_000 });
    const rlChan = await ctx.runMutation(internal.rateLimit.hit, { key: `chan:${ch._id}`, max: 120, windowMs: 60_000 });
    if (!rlSender.ok || !rlChan.ok) return { ok: true };
    const dedupeKey = `slack:${ch._id}:${msg.eventId}`;
    const res = await ctx.runMutation(internal.channelsIngest._ingest, { channelId: ch._id, dedupeKey, externalUserId: msg.externalUserId, chatId: msg.channel, text: msg.text, senderName: msg.senderName });
    if (!("threadId" in res) || !res.threadId) return { ok: true }; // duplicate or skipped
    await ctx.scheduler.runAfter(0, internal.channelSlack.dispatch, { channelId: ch._id, threadId: res.threadId, channel: msg.channel, threadTs: msg.threadTs });
    return { ok: true };
  },
});

// deferred model turn: resolve agent → callForUser → reply in-thread → log the outbound.
export const dispatch = internalAction({
  args: { channelId: v.id("channels"), threadId: v.id("threads"), channel: v.string(), threadTs: v.optional(v.string()) },
  handler: async (ctx, a): Promise<void> => {
    const cx = await ctx.runQuery(internal.channelsIngest._getDispatchContext, { channelId: a.channelId, threadId: a.threadId });
    if (!cx) return;
    const { botToken } = JSON.parse(await decryptSecret(cx.secretCiphertext));
    const { configured, reply } = await computeReply(ctx, cx, a.channelId);
    if (!configured) { await sendMessage(botToken, a.channel, reply, a.threadTs).catch(() => {}); return; }
    try { await sendMessage(botToken, a.channel, reply, a.threadTs); } catch (e: any) {
      await ctx.runMutation(internal.channelsIngest._setChannelError, { channelId: a.channelId, error: String(e?.message ?? e) });
      return;
    }
    await ctx.runMutation(internal.channelsIngest._logOut, { channelId: a.channelId, threadId: a.threadId, text: reply });
  },
});
