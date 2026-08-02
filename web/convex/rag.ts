// RAG document CRUD (V8 runtime — queries/mutations only; the embedding action lives in ragNode.ts
// because it needs Node + the AI SDK). Docs are personal (retrieval filters by userId).
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUser } from "./_shared/auth";

export const listDocs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("ragDocs").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(100);
  },
});

// internal: insert a doc + all its embedded chunks in one shot (called by the embed action).
export const _insertDoc = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    charCount: v.number(),
    chunks: v.array(v.object({ text: v.string(), embedding: v.array(v.float64()) })),
  },
  handler: async (ctx, a): Promise<string> => {
    const docId = await ctx.db.insert("ragDocs", { userId: a.userId, workspaceId: a.workspaceId, title: a.title, charCount: a.charCount, chunkCount: a.chunks.length, status: "ready", createdAt: Date.now() });
    for (const c of a.chunks) await ctx.db.insert("ragChunks", { docId, userId: a.userId, workspaceId: a.workspaceId, text: c.text, embedding: c.embedding });
    return docId;
  },
});

export const deleteDoc = mutation({
  args: { docId: v.id("ragDocs") },
  handler: async (ctx, a) => {
    const userId = await requireUser(ctx);
    const doc = await ctx.db.get(a.docId);
    if (!doc || doc.userId !== userId) return; // ownership gate + idempotent
    await ctx.db.delete(a.docId);
    await ctx.scheduler.runAfter(0, internal.rag._deleteChunks, { docId: a.docId }); // chunks cleaned async (a doc can have many)
  },
});

const DEL_BATCH = 200;
export const _deleteChunks = internalMutation({
  args: { docId: v.id("ragDocs") },
  handler: async (ctx, a) => {
    const batch = await ctx.db.query("ragChunks").withIndex("by_doc", (q) => q.eq("docId", a.docId)).take(DEL_BATCH);
    for (const c of batch) await ctx.db.delete(c._id);
    if (batch.length === DEL_BATCH) await ctx.scheduler.runAfter(0, internal.rag._deleteChunks, { docId: a.docId });
  },
});

// internal: fetch chunk texts by id — used after a vector search (which returns ids + scores only).
export const _chunksByIds = internalQuery({
  args: { userId: v.id("users"), ids: v.array(v.id("ragChunks")) },
  handler: async (ctx, a): Promise<string[]> => {
    const out: string[] = [];
    for (const id of a.ids) {
      const c = await ctx.db.get(id);
      if (c && c.userId === a.userId) out.push(c.text); // re-check ownership on read
    }
    return out;
  },
});
