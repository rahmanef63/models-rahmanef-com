"use node";
// Discord adapter — INTERACTIONS webhook (slash commands), not free-form messages. Auth = Ed25519:
// X-Signature-Ed25519 over (X-Signature-Timestamp + rawBody) with the app public key. PING (type 1)
// → PONG {type:1}. APPLICATION_COMMAND (type 2) → ack with a type-5 DEFERRED response NOW (Discord
// enforces a ~3s window a model call blows), then a scheduled turn edits the original via the
// interaction follow-up webhook. Instant replies (disabled / rate-limit / access-denied) stay inline
// type-4. The per-sender + per-channel spend guard runs BEFORE any model call, like the others.
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptSecret } from "./crypto";
import { verifyEd25519Hex } from "./channelsCrypto";
import { computeReply, notAuthorizedText } from "./channelsDispatch";

const MAX = 2000; // Discord message content cap
const say = (content: string) => ({ type: 4, data: { content: content.slice(0, MAX) } });

// edit the deferred (type-5) response — the interaction token authorizes it (no bot auth needed),
// valid ~15 min. Best-effort: errors bubble to dispatch, which logs the channel error and bails.
const API = "https://discord.com/api/v10";
async function editDeferred(applicationId: string, token: string, content: string): Promise<void> {
  const res = await fetch(`${API}/webhooks/${applicationId}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, MAX) }),
  });
  if (!res.ok) throw new Error(`Discord followup ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// first string option value in a slash command (e.g. /ask question:… → the question text).
export function extractDiscord(body: any): { externalUserId: string; text: string; senderName?: string } | null {
  if (body?.type !== 2) return null;
  const opts = body?.data?.options ?? [];
  const opt = opts.find((o: any) => typeof o?.value === "string" && o.value.trim());
  const text = opt?.value ?? opts[0]?.value;
  if (typeof text !== "string" || !text.trim()) return null;
  const user = body?.member?.user ?? body?.user;
  return { externalUserId: String(user?.id ?? "unknown"), text, senderName: user?.username };
}

// webhook entrypoint (Next route). Returns { status:401 } for a bad signature (Discord's endpoint
// validation REQUIRES a 401 reject) or { json } — the interaction response the route echoes back.
export const ingest = action({
  args: { slug: v.string(), rawBody: v.string(), signature: v.optional(v.string()), timestamp: v.optional(v.string()), ip: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ status?: number; json?: any }> => {
    const ch = await ctx.runQuery(internal.channelsCore._resolveChannelBySlug, { slug: a.slug });
    if (!ch || ch.kind !== "discord") return { status: 401 }; // don't leak existence; 401 is what Discord expects
    const { publicKey } = JSON.parse(await decryptSecret(ch.secretCiphertext));
    if (!a.signature || !a.timestamp || !(await verifyEd25519Hex(publicKey, a.signature, a.timestamp + a.rawBody))) return { status: 401 };
    let body: any;
    try { body = JSON.parse(a.rawBody); } catch { return { status: 401 }; }
    if (body.type === 1) return { json: { type: 1 } }; // PING → PONG
    if (ch.enabled === false) return { json: say("This channel is disabled.") };
    const msg = extractDiscord(body);
    if (!msg) return { json: say("Send a text prompt with the command.") };
    // spend guard (non-negotiable): cap per-sender + per-channel so a stranger can't drain owner tokens.
    const rlSender = await ctx.runMutation(internal.rateLimit.hit, { key: `chansender:${ch._id}:${msg.externalUserId}`, max: 20, windowMs: 60_000 });
    const rlChan = await ctx.runMutation(internal.rateLimit.hit, { key: `chan:${ch._id}`, max: 120, windowMs: 60_000 });
    if (!rlSender.ok || !rlChan.ok) return { json: say("You're sending commands too fast — try again in a moment.") };
    const dedupeKey = `discord:${ch._id}:${String(body.id ?? body.token)}`;
    const res = await ctx.runMutation(internal.channelsIngest._ingest, { channelId: ch._id, dedupeKey, externalUserId: msg.externalUserId, chatId: msg.externalUserId, text: msg.text, senderName: msg.senderName });
    if (!("threadId" in res) || !res.threadId) return { json: say("(already handled)") };
    // access gate: allowlist bot only spends for approved senders. Denied → reply inline (a slash
    // command always gets one response) with the how-to-get-added hint, but NO callForUser spend.
    const access = await ctx.runMutation(internal.channelsAccess._checkAccess, { channelId: ch._id, externalUserId: msg.externalUserId });
    if (!access.allowed) return { json: say(notAuthorizedText(msg.externalUserId)) };
    // model call can exceed Discord's ~3s window → ack type-5 (deferred) NOW, run the turn in a
    // scheduled action, then edit @original via the follow-up webhook. applicationId + token (from
    // the interaction, ephemeral) authorize that edit. Mirrors the telegram/slack/whatsapp defer.
    const applicationId = String(body.application_id ?? "");
    if (!applicationId || !body.token) return { json: say("(missing interaction token)") };
    await ctx.scheduler.runAfter(0, internal.channelDiscord.dispatch, { channelId: ch._id, threadId: res.threadId, applicationId, token: String(body.token) });
    return { json: { type: 5 } }; // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  },
});

// deferred model turn: resolve agent → callForUser → edit the "thinking…" reply → log the outbound.
export const dispatch = internalAction({
  args: { channelId: v.id("channels"), threadId: v.id("threads"), applicationId: v.string(), token: v.string() },
  handler: async (ctx, a): Promise<void> => {
    const cx = await ctx.runQuery(internal.channelsIngest._getDispatchContext, { channelId: a.channelId, threadId: a.threadId });
    if (!cx) { await editDeferred(a.applicationId, a.token, "(no context)").catch(() => {}); return; }
    const { configured, reply } = await computeReply(ctx, cx, a.channelId);
    try { await editDeferred(a.applicationId, a.token, reply); } catch (e: any) {
      await ctx.runMutation(internal.channelsIngest._setChannelError, { channelId: a.channelId, error: String(e?.message ?? e) });
      return; // couldn't deliver — don't log an out row that never arrived
    }
    if (configured) await ctx.runMutation(internal.channelsIngest._logOut, { channelId: a.channelId, threadId: a.threadId, text: reply });
  },
});
