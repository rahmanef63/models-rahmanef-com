// Auto-summarize support (opt-in). maybeSummarize is scheduled off-turn by a caller (see the
// threads.sendMessage hook) and, when the thread has grown past a watermark, schedules the node
// action memorySummarize.summarizeThread. The read/upsert helpers here run in the default runtime;
// the model call itself lives in memorySummarize.ts (node). NEVER inline — always scheduled.
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MSG_WATERMARK = 30; // msgs since last summary
const CHAR_WATERMARK = 12_000; // transcript chars since last summary
const SCAN = 200; // bounded thread read
const stripFence = (s: string) => s.replace(/<\/?\s*memory-context\s*>/gi, "").trim();

// cheap default model per provider for the summarize call (API-key providers only — no OAuth tool
// loops). First connected match wins. Extend as new providers are added to chatProviders.
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  deepseek: "deepseek-chat",
  xai: "grok-2-latest",
  mistral: "mistral-small-latest",
  togetherai: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "fireworks-ai": "accounts/fireworks/models/llama-v3p1-8b-instruct",
  cerebras: "llama3.1-8b",
};

async function firstConnectedModel(ctx: any, userId: any): Promise<string | null> {
  const creds = await ctx.db.query("modelCreds").withIndex("by_user", (q: any) => q.eq("userId", userId)).take(20);
  for (const c of creds) if (DEFAULT_MODELS[c.provider]) return `${c.provider}/${DEFAULT_MODELS[c.provider]}`;
  return null;
}

// read the thread transcript + resolve a model — returns null when nothing to summarize.
export const _threadForSummary = internalQuery({
  args: { userId: v.id("users"), threadId: v.id("threads"), model: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) return null;
    const msgs = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("asc").take(SCAN);
    if (!msgs.length) return null;
    const model = a.model ?? (await firstConnectedModel(ctx, a.userId));
    if (!model) return null;
    const chars = msgs.reduce((n, m) => n + m.content.length, 0);
    return { model, count: msgs.length, chars, messages: msgs.map((m) => ({ role: m.role, content: m.content })) };
  },
});

// upsert the single scope='summary' row for this thread (by_user_thread key).
export const _upsertSummary = internalMutation({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), threadId: v.id("threads"), text: v.string(), count: v.number(), chars: v.number() },
  handler: async (ctx, a) => {
    const text = stripFence(a.text).slice(0, 1500);
    if (!text) return;
    const now = Date.now();
    const existing = await ctx.db.query("memories").withIndex("by_user_thread", (q) => q.eq("userId", a.userId).eq("sourceThreadId", a.threadId)).take(4);
    const summary = existing.find((r) => r.scope === "summary" && !r.archived);
    if (summary) {
      await ctx.db.patch(summary._id, { text, summarizedMsgCount: a.count, summarizedChars: a.chars, updatedAt: now });
    } else {
      await ctx.db.insert("memories", {
        userId: a.userId, workspaceId: a.workspaceId, scope: "summary", kind: "summary", text,
        source: "auto-summary", sourceThreadId: a.threadId, summarizedMsgCount: a.count, summarizedChars: a.chars,
        createdAt: now, updatedAt: now,
      });
    }
  },
});

// opt-in gate + watermark check → schedule the node summarize action. Cheap; safe to call per turn.
export const maybeSummarize = internalMutation({
  args: { userId: v.id("users"), threadId: v.id("threads"), workspaceId: v.optional(v.id("workspaces")), model: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const s = await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", a.userId)).unique();
    if (!s?.memoryAutoSummarize) return; // default OFF — spends the user's own BYOK
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) return;
    const msgs = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("asc").take(SCAN);
    if (!msgs.length) return;
    const chars = msgs.reduce((n, m) => n + m.content.length, 0);
    const existing = await ctx.db.query("memories").withIndex("by_user_thread", (q) => q.eq("userId", a.userId).eq("sourceThreadId", a.threadId)).take(4);
    const summary = existing.find((r) => r.scope === "summary" && !r.archived);
    const lastCount = summary?.summarizedMsgCount ?? 0;
    const lastChars = summary?.summarizedChars ?? 0;
    if (msgs.length - lastCount < MSG_WATERMARK && chars - lastChars < CHAR_WATERMARK) return;
    await ctx.scheduler.runAfter(0, internal.memorySummarize.summarizeThread, { userId: a.userId, threadId: a.threadId, workspaceId: a.workspaceId, model: a.model });
  },
});
