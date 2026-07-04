// AI Chat workbench — persisted threads + messages. sendMessage reuses the existing chat action
// (api.chat.chat) so token-savers, agent mode, and usage logging all apply for free.
// ponytail: no streaming — request/response, persist both sides. Reactive queries update the UI.
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";

// agentDefs.ts's validateModel only checks the "provider/model" string SHAPE — it doesn't reject
// OAuth-subscription providers (codex/claude), since a plain (non-agent) credential of theirs is
// perfectly usable for ordinary chat. Only an AGENT binding needs this stricter check (agents need
// tool support, which those providers don't have here) — chat.ts's `chat` action enforces the same
// rule at send time; checking it here too means binding fails fast with a clear reason instead of
// silently succeeding and then erroring on every subsequent message.
function assertToolCapable(def: { model: string; name: string }) {
  const i = def.model.indexOf("/");
  const provider = i > 0 ? def.model.slice(0, i) : "";
  if (provider === "openai-codex" || provider === "anthropic-oauth") {
    throw new ConvexError({ code: "invalid_request", detail: `"${def.name}" is set to an OAuth subscription model (${def.model}), which doesn't support tools — edit the agent to use an API-key model first.` });
  }
}

// model is required UNLESS agentId is given, in which case it's denormalized from the agent's
// own configured model — same pattern agentRuns already uses for agentName.
export const createThread = mutation({
  args: { model: v.optional(v.string()), title: v.string(), agentId: v.optional(v.id("agentDefs")) },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    let model = a.model;
    let agentName: string | undefined;
    if (a.agentId) {
      const def = await ctx.db.get(a.agentId);
      if (!def || def.userId !== userId) throw new ConvexError({ code: "not_found", detail: "Agent not found" });
      assertToolCapable(def);
      model = def.model;
      agentName = def.name;
    }
    if (!model) throw new ConvexError({ code: "invalid_request", detail: "model or agentId required" });
    return ctx.db.insert("threads", { userId, title: a.title.slice(0, 80) || "New chat", model, agentId: a.agentId, agentName, at: Date.now() });
  },
});

// Switches which saved agent (if any) drives future replies in an EXISTING thread — e.g. via
// @mention in the composer. Also swaps the thread's model to the agent's own configured model
// (an agent always runs on its own validated model, never overlaid onto whatever the thread
// happened to be using before — sidesteps the "agents need a tool-capable model" constraint
// entirely, since the agent's model was already validated when the agent itself was saved).
// agentId: null unbinds — future replies go back to plain (no-tools) chat on the current model.
export const rebindThreadAgent = mutation({
  args: { threadId: v.id("threads"), agentId: v.union(v.id("agentDefs"), v.null()) },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== userId) throw new ConvexError({ code: "not_found", detail: "Thread not found" });
    if (a.agentId === null) {
      await ctx.db.patch(a.threadId, { agentId: undefined, agentName: undefined });
      return;
    }
    const def = await ctx.db.get(a.agentId);
    if (!def || def.userId !== userId) throw new ConvexError({ code: "not_found", detail: "Agent not found" });
    assertToolCapable(def);
    await ctx.db.patch(a.threadId, { agentId: a.agentId, agentName: def.name, model: def.model });
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

// most recent MESSAGE_WINDOW messages, restored to chronological order — a bare .collect() here
// would grow unbounded with a thread's length; this caps both the UI render and (via _history
// below) what gets forwarded to the model on every turn.
const MESSAGE_WINDOW = 100;

export const threadMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== userId) return []; // not the caller's thread
    const recent = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("desc").take(MESSAGE_WINDOW);
    return recent.reverse();
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== userId) return;
    await ctx.db.delete(a.threadId);
    // messages deleted in a scheduled batch loop — a long thread could exceed the per-mutation
    // write limit if deleted inline. The thread is gone immediately; orphaned messages clean async.
    await ctx.scheduler.runAfter(0, internal.threads._deleteMessages, { threadId: a.threadId });
  },
});

// batched cleanup for a deleted thread's messages — reschedules until the thread is drained.
const DELETE_BATCH = 200;
export const _deleteMessages = internalMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const batch = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).take(DELETE_BATCH);
    for (const m of batch) await ctx.db.delete(m._id);
    if (batch.length === DELETE_BATCH) await ctx.scheduler.runAfter(0, internal.threads._deleteMessages, { threadId: a.threadId });
  },
});

// internal: append a message, returning the thread's model + agent binding (if any). verifies
// ownership against the userId the (authed) action passes in — internal fns are only reachable
// from our own code.
export const _append = internalMutation({
  args: { userId: v.id("users"), threadId: v.id("threads"), role: v.string(), content: v.string() },
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) throw new Error("thread not found");
    await ctx.db.insert("messages", { threadId: a.threadId, role: a.role, content: a.content, at: Date.now() });
    return { model: t.model, agentId: t.agentId };
  },
});

export const _history = internalQuery({
  args: { userId: v.id("users"), threadId: v.id("threads") },
  handler: async (ctx, a) => {
    const t = await ctx.db.get(a.threadId);
    if (!t || t.userId !== a.userId) throw new Error("thread not found");
    const recent = await ctx.db.query("messages").withIndex("by_thread", (q) => q.eq("threadId", a.threadId)).order("desc").take(MESSAGE_WINDOW);
    return recent.reverse().map((m) => ({ role: m.role, content: m.content }));
  },
});

export const sendMessage = action({
  args: { threadId: v.id("threads"), content: v.string() },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const userId = await requireUser(ctx);
    const { model, agentId } = await ctx.runMutation(internal.threads._append, { userId, threadId: a.threadId, role: "user", content: a.content });
    const history = await ctx.runQuery(internal.threads._history, { userId, threadId: a.threadId });
    let text: string;
    try {
      ({ text } = await ctx.runAction(api.chat.chat, agentId ? { agentId, messages: history } : { model, messages: history }));
    } catch (e) {
      // re-throw as a fresh ConvexError HERE (V8 runtime) so the real reason reaches the client — a
      // ConvexError thrown inside the "use node" chat action loses its data across the runAction boundary.
      // chat.ts already classifies failures into a structured {code,status,detail,provider,model} — pass
      // that through as-is; the client's isAdmin gate on how MUCH of it to render is a UX choice, not
      // access control — the full object is always in this action's own response either way.
      const data = (e as { data?: unknown })?.data;
      throw new ConvexError((data && typeof data === "object" ? data : String(data ?? (e instanceof Error ? e.message : String(e))).slice(0, 400)) as any);
    }
    await ctx.runMutation(internal.threads._append, { userId, threadId: a.threadId, role: "assistant", content: text });
    return { text };
  },
});
