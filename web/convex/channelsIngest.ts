// channels ingest — the deterministic DB half of the inbound loop (default runtime, no fetch/model).
// _ingest: OCC-safe dedupe + identity/thread upsert + persist the user message. _getDispatchContext:
// everything the "use node" dispatch action needs (channel secret, resolved agent, recent history).
// _logOut: persist the assistant reply + an 'out' audit row. The channel convo reuses threads/messages
// so it shows up in the web workbench for the channel owner for free.
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MODEL_FALLBACK = "openai/gpt-4o-mini"; // used only for thread.model display when nothing else set

// dedupe (same transaction as the message insert — at-least-once webhooks never double-answer) →
// identity upsert → thread upsert (keyed on the identity) → persist the user message.
export const _ingest = internalMutation({
  args: { channelId: v.id("channels"), dedupeKey: v.string(), externalUserId: v.string(), chatId: v.string(), text: v.string(), senderName: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const ch = await ctx.db.get(a.channelId);
    if (!ch || ch.enabled === false) return { skip: true as const };

    const seen = await ctx.db.query("channelEvents").withIndex("by_dedupe", (q) => q.eq("dedupeKey", a.dedupeKey)).first();
    if (seen) return { duplicate: true as const };
    await ctx.db.insert("channelEvents", { channelId: a.channelId, dedupeKey: a.dedupeKey, direction: "in", payload: a.text.slice(0, 200), at: Date.now() });
    await ctx.db.patch(a.channelId, { lastInboundAt: Date.now(), lastError: undefined });

    let identity = await ctx.db.query("channelIdentities").withIndex("by_channel_external", (q) => q.eq("channelId", a.channelId).eq("externalUserId", a.externalUserId)).unique();
    if (!identity) {
      const idId = await ctx.db.insert("channelIdentities", { channelId: a.channelId, externalUserId: a.externalUserId, displayName: a.senderName, createdAt: Date.now() });
      identity = await ctx.db.get(idId);
    }
    let threadId = identity?.threadId;
    if (!threadId) {
      const agent = ch.agentId ? await ctx.db.get(ch.agentId) : null;
      const model = agent?.model ?? (ch.config as any)?.model ?? MODEL_FALLBACK;
      threadId = await ctx.db.insert("threads", {
        userId: ch.userId, workspaceId: ch.workspaceId, title: `${ch.kind}: ${a.senderName ?? a.externalUserId}`.slice(0, 80),
        model, agentId: ch.agentId, agentName: agent?.name, at: Date.now(),
      });
      if (identity) await ctx.db.patch(identity._id, { threadId });
    }
    await ctx.db.insert("messages", { threadId, role: "user", content: a.text, at: Date.now() });
    return { ok: true as const, threadId };
  },
});

// everything the dispatch action needs. Returns the ciphertext (decrypted in the "use node" action),
// the resolved agent config (if bound), the fallback model, and the recent thread history.
export const _getDispatchContext = internalQuery({
  args: { channelId: v.id("channels"), threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const ch = await ctx.db.get(a.channelId);
    if (!ch) return null;
    const agent = ch.agentId ? await ctx.db.get(ch.agentId) : null;
    const msgs = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("desc").take(20);
    const history = msgs.reverse().map((m) => ({ role: m.role, content: m.content }));
    return {
      userId: ch.userId, workspaceId: ch.workspaceId ?? undefined, secretCiphertext: ch.secretCiphertext,
      model: (ch.config as any)?.model ?? undefined,
      agent: agent ? { model: agent.model, instructions: agent.instructions, skills: agent.skills, tools: agent.tools, maxSteps: agent.maxSteps, temperature: agent.temperature } : null,
      history,
    };
  },
});

// persist the assistant reply + an 'out' audit row. lastError set separately on failure.
export const _logOut = internalMutation({
  args: { channelId: v.id("channels"), threadId: v.id("threads"), text: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.insert("messages", { threadId: a.threadId, role: "assistant", content: a.text, at: Date.now() });
    await ctx.db.insert("channelEvents", { channelId: a.channelId, dedupeKey: `out:${a.threadId}:${Date.now()}`, direction: "out", payload: a.text.slice(0, 200), at: Date.now() });
  },
});

export const _setChannelError = internalMutation({
  args: { channelId: v.id("channels"), error: v.string() },
  handler: (ctx, a) => ctx.db.patch(a.channelId, { lastError: a.error.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot***").slice(0, 300) }),
});

// prune channelEvents older than 48h (cron). Indexed .take batches — no bare .collect().
export const pruneEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const old = await ctx.db.query("channelEvents").withIndex("by_at", (q) => q.lt("at", cutoff)).take(200);
    for (const r of old) await ctx.db.delete(r._id);
    return old.length;
  },
});
