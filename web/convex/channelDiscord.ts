"use node";
// Discord adapter — INTERACTIONS webhook (slash commands), not free-form messages. Auth = Ed25519:
// X-Signature-Ed25519 over (X-Signature-Timestamp + rawBody) with the app public key. PING (type 1)
// → PONG {type:1}. APPLICATION_COMMAND (type 2) → run callForUser INLINE and reply {type:4,data:
// {content}} (Discord wants the answer in the HTTP response). The per-sender + per-channel spend
// guard runs BEFORE callForUser, same as the other adapters. See notes on the 3s window limitation.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptSecret } from "./crypto";
import { verifyEd25519Hex } from "./channelsCrypto";
import { computeReply } from "./channelsDispatch";

const MAX = 2000; // Discord message content cap
const say = (content: string) => ({ type: 4, data: { content: content.slice(0, MAX) } });

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
    // Discord wants the answer in this response, so run the model INLINE (no scheduler defer here).
    const cx = await ctx.runQuery(internal.channelsIngest._getDispatchContext, { channelId: ch._id, threadId: res.threadId });
    if (!cx) return { json: say("(no context)") };
    const { configured, reply } = await computeReply(ctx, cx, ch._id);
    if (configured) await ctx.runMutation(internal.channelsIngest._logOut, { channelId: ch._id, threadId: res.threadId, text: reply });
    return { json: say(reply) };
  },
});
