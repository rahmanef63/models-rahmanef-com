"use node";
// Telegram adapter + the ingest→callForUser→reply loop. Telegram auth = the X-Telegram-Bot-Api-
// Secret-Token header (a value WE choose at setWebhook time), compared against the stored secretToken
// — NOT an HMAC. `ingest` ACKs fast: it verifies, dedupes, persists the inbound message, then defers
// the model call to the scheduler (dispatch) so the webhook returns within Telegram's budget.
// dispatch resolves the bound agent (or fallback model), calls callForUser (the ONE cred pipeline),
// and sends the reply back to the SAME chat (deterministic routing — the model never picks a channel).
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptSecret } from "./crypto";
import { requireWorkspaceRoleAction } from "./_shared/auth";
import { computeReply, notAuthorizedText } from "./channelsDispatch";

const API = "https://api.telegram.org/bot";
const CHUNK = 4096;

// constant-time secret check (length gate, then XOR-accumulate — no early-out on first mismatch).
export function verifyAndParse(headerToken: string | undefined, storedToken: string): boolean {
  if (!headerToken || headerToken.length !== storedToken.length) return false;
  let diff = 0;
  for (let i = 0; i < headerToken.length; i++) diff |= headerToken.charCodeAt(i) ^ storedToken.charCodeAt(i);
  return diff === 0;
}

// pull the sendable message out of an Update (message | edited_message | channel_post) → normalized.
export function extractMessage(update: any): { externalUserId: string; chatId: string; text: string; senderName?: string } | null {
  const m = update?.message ?? update?.edited_message ?? update?.channel_post;
  const text = typeof m?.text === "string" ? m.text : "";
  if (!m?.chat?.id || !text.trim()) return null;
  return { externalUserId: String(m.from?.id ?? m.chat.id), chatId: String(m.chat.id), text, senderName: m.from?.first_name ?? m.chat?.title };
}

// POST to Telegram sendMessage, chunked to 4096. Best-effort — errors bubble to the caller.
export async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const body = text.trim() || "(empty reply)";
  for (let i = 0; i < body.length; i += CHUNK) {
    const chunk = body.slice(i, i + CHUNK);
    const res = await fetch(`${API}${botToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// setWebhook register action — admin binds the channel to Telegram (URL + secret_token). Called from
// the connect card once the channel exists. Returns Telegram's ok/description for the health badge.
export const setWebhook = action({
  args: { channelId: v.id("channels"), webhookUrl: v.string() },
  handler: async (ctx, a): Promise<{ ok: boolean; detail?: string }> => {
    const row = await ctx.runQuery(internal.channelsCore._secretFor, { channelId: a.channelId });
    if (!row) return { ok: false, detail: "channel not found" };
    await requireWorkspaceRoleAction(ctx, row.workspaceId, "admin"); // only a ws admin can (re)point the bot
    const { botToken, secretToken } = JSON.parse(await decryptSecret(row.secretCiphertext));
    const res = await fetch(`${API}${botToken}/setWebhook`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: a.webhookUrl, secret_token: secretToken, allowed_updates: ["message", "edited_message", "channel_post"] }),
    });
    const j: any = await res.json().catch(() => ({}));
    return { ok: !!j.ok, detail: j.description ?? (res.ok ? "ok" : `HTTP ${res.status}`) };
  },
});

// the webhook entrypoint (called by the Next route). ACK-fast: verify → dedupe/persist → schedule.
export const ingest = action({
  args: { slug: v.string(), secretToken: v.optional(v.string()), update: v.any(), ip: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ ok: boolean }> => {
    const ch = await ctx.runQuery(internal.channelsCore._resolveChannelBySlug, { slug: a.slug });
    if (!ch || ch.enabled === false || ch.kind !== "telegram") return { ok: true }; // ACK; don't leak existence
    const { secretToken, botToken } = JSON.parse(await decryptSecret(ch.secretCiphertext));
    if (!verifyAndParse(a.secretToken, secretToken)) return { ok: true }; // bad secret → drop, still ACK
    const msg = extractMessage(a.update);
    if (!msg) return { ok: true }; // non-text / non-message update — nothing to do
    // spend guard: an open bot is publicly reachable — cap per-sender + per-channel so a stranger
    // can't drain the owner's provider tokens. Over budget → ACK (Telegram won't retry) but no spend.
    const rlSender = await ctx.runMutation(internal.rateLimit.hit, { key: `chansender:${ch._id}:${msg.externalUserId}`, max: 20, windowMs: 60_000 });
    const rlChan = await ctx.runMutation(internal.rateLimit.hit, { key: `chan:${ch._id}`, max: 120, windowMs: 60_000 });
    if (!rlSender.ok || !rlChan.ok) return { ok: true };
    const dedupeKey = `telegram:${ch._id}:${a.update?.update_id ?? msg.chatId}:${a.update?.message?.message_id ?? ""}`;
    const res = await ctx.runMutation(internal.channelsIngest._ingest, {
      channelId: ch._id, dedupeKey, externalUserId: msg.externalUserId, chatId: msg.chatId, text: msg.text, senderName: msg.senderName,
    });
    if (!("threadId" in res) || !res.threadId) return { ok: true }; // duplicate or skipped
    // access gate: an allowlist bot only spends for approved senders. Denied → no dispatch (no spend);
    // hint them once so they know how to get added, then stay silent.
    const access = await ctx.runMutation(internal.channelsAccess._checkAccess, { channelId: ch._id, externalUserId: msg.externalUserId });
    if (!access.allowed) {
      if (access.firstDeny) await sendMessage(botToken, msg.chatId, notAuthorizedText(msg.externalUserId)).catch(() => {});
      return { ok: true };
    }
    await ctx.scheduler.runAfter(0, internal.channelTelegram.dispatch, { channelId: ch._id, threadId: res.threadId, chatId: msg.chatId });
    return { ok: true };
  },
});

// deferred model turn: resolve agent → callForUser → reply to the origin chat → log the outbound.
export const dispatch = internalAction({
  args: { channelId: v.id("channels"), threadId: v.id("threads"), chatId: v.string() },
  handler: async (ctx, a): Promise<void> => {
    const cx = await ctx.runQuery(internal.channelsIngest._getDispatchContext, { channelId: a.channelId, threadId: a.threadId });
    if (!cx) return;
    const { botToken } = JSON.parse(await decryptSecret(cx.secretCiphertext));
    const { configured, reply } = await computeReply(ctx, cx, a.channelId);
    if (!configured) { await sendMessage(botToken, a.chatId, reply).catch(() => {}); return; }
    try { await sendMessage(botToken, a.chatId, reply); } catch (e: any) {
      await ctx.runMutation(internal.channelsIngest._setChannelError, { channelId: a.channelId, error: String(e?.message ?? e) });
      return; // couldn't deliver — don't log an out row that never arrived
    }
    await ctx.runMutation(internal.channelsIngest._logOut, { channelId: a.channelId, threadId: a.threadId, text: reply });
  },
});
