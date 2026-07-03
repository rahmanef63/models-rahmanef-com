// AI Chat workbench — persisted threads + messages. sendMessage reuses the existing chat action
// (api.chat.chat) so token-savers, agent mode, and usage logging all apply for free.
// ponytail: no streaming — request/response, persist both sides. Reactive queries update the UI.
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createThread = mutation({
  args: { model: v.string(), title: v.string() },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    return ctx.db.insert("threads", { userId, title: a.title.slice(0, 80) || "New chat", model: a.model, at: Date.now() });
  },
});

export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("threads").withIndex("by_user_at", (q) => q.eq("userId", userId)).order("desc").take(50);
  },
});

export const threadMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== userId) return []; // not the caller's thread
    return ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("asc").collect();
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== userId) return;
    for (const m of await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).collect()) await ctx.db.delete(m._id);
    await ctx.db.delete(a.threadId);
  },
});

// internal: append a message, returning the thread's model. verifies ownership against the
// userId the (authed) action passes in — internal fns are only reachable from our own code.
export const _append = internalMutation({
  args: { userId: v.id("users"), threadId: v.id("threads"), role: v.string(), content: v.string() },
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) throw new Error("thread not found");
    await ctx.db.insert("messages", { threadId: a.threadId, role: a.role, content: a.content, at: Date.now() });
    return t.model;
  },
});

export const _history = internalQuery({
  args: { userId: v.id("users"), threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) throw new Error("thread not found");
    const msgs = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("asc").collect();
    return msgs.map((m) => ({ role: m.role, content: m.content }));
  },
});

export const sendMessage = action({
  args: { threadId: v.id("threads"), content: v.string() },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    const model = await ctx.runMutation(internal.threads._append, { userId, threadId: a.threadId, role: "user", content: a.content });
    const history = await ctx.runQuery(internal.threads._history, { userId, threadId: a.threadId });
    let text: string;
    try {
      ({ text } = await ctx.runAction(api.chat.chat, { model, messages: history }));
    } catch (e) {
      // re-throw as a fresh ConvexError HERE (V8 runtime) so the real reason reaches the client — a
      // ConvexError thrown inside the "use node" chat action loses its data across the runAction boundary.
      const msg = (e as { data?: unknown })?.data ?? (e instanceof Error ? e.message : String(e));
      throw new ConvexError(String(msg).slice(0, 400));
    }
    await ctx.runMutation(internal.threads._append, { userId, threadId: a.threadId, role: "assistant", content: text });
    return { text };
  },
});
