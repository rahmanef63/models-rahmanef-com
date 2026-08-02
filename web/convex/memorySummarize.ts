"use node";
// Auto-summarize a thread into a ≤1500-char scope='summary' memory row, using the user's OWN BYOK
// (callForUser logs the usage). Scheduled off-turn by memoryAutoSummary.maybeSummarize — NEVER
// inline (the model call must not block a chat turn). No-ops when there's nothing to summarize.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callForUser } from "./callForUser";

const SYSTEM =
  "You compress a conversation into a durable memory note. Output ONLY the summary (no preamble). " +
  "Capture stable facts, decisions, user preferences/corrections, and open threads in third person. " +
  "Omit small talk and transient task chatter. Hard limit 1500 characters.";

export const summarizeThread = internalAction({
  args: { userId: v.id("users"), threadId: v.id("threads"), workspaceId: v.optional(v.id("workspaces")), model: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const data = await ctx.runQuery(internal.memoryAutoSummary._threadForSummary, { userId: a.userId, threadId: a.threadId, model: a.model });
    if (!data) return; // no messages / no usable model
    const transcript = data.messages.map((m) => `${m.role}: ${m.content}`).join("\n").slice(0, 24_000);
    let text = "";
    try {
      const res = await callForUser(ctx, a.userId, a.workspaceId, data.model, [{ role: "user", content: `Conversation to summarize:\n\n${transcript}` }], { system: SYSTEM, temperature: 0 });
      text = res.text;
    } catch {
      return; // provider error / no creds — silently skip; the trigger will retry on the next turn
    }
    if (text && text !== "(no text)") {
      await ctx.runMutation(internal.memoryAutoSummary._upsertSummary, { userId: a.userId, workspaceId: a.workspaceId, threadId: a.threadId, text, count: data.count, chars: data.chars });
    }
  },
});
