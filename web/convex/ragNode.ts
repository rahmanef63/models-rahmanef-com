"use node";
// RAG embedding + retrieval (Node runtime — needs the AI SDK). createDoc embeds a document's chunks;
// retrieve embeds a query and vector-searches the caller's chunks. Both use ONE fixed embedding model
// (OpenAI text-embedding-3-small → 1536 dims) so the fixed-dimension vectorIndex works — the BYOK
// variable-dim problem is sidestepped by standardizing on this model (needs the user's OpenAI key).
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { requireUser, resolveWorkspaceAction } from "./_shared/auth";
import { decryptSecret } from "./crypto";
import { chunkText, EMBED_MODEL } from "./ragChunk";

const MAX_DOC_CHARS = 200_000;

// resolve the caller's OpenAI key (embeddings only run on OpenAI's fixed-dim model here).
async function embedder(ctx: any, userId: string, workspaceId: any) {
  const cred = await ctx.runQuery(internal.credentials.resolveCred, { userId, workspaceId, provider: "openai" });
  if (!cred) throw new ConvexError({ code: "not_connected", detail: "RAG needs an OpenAI API key (for embeddings) — connect one in Providers." });
  const apiKey = await decryptSecret(cred.ciphertext);
  return createOpenAI({ apiKey }).embedding(EMBED_MODEL);
}

export const createDoc = action({
  args: { title: v.string(), text: v.string(), workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, a): Promise<{ docId: string; chunkCount: number }> => {
    const userId = await requireUser(ctx);
    const workspaceId = await resolveWorkspaceAction(ctx, userId, a.workspaceId, "member");
    const chunks = chunkText(a.text.slice(0, MAX_DOC_CHARS));
    if (chunks.length === 0) throw new ConvexError({ code: "invalid_request", detail: "Nothing to index." });
    const model = await embedder(ctx, userId, workspaceId);
    let embeddings: number[][];
    try { ({ embeddings } = await embedMany({ model, values: chunks })); }
    catch (e: any) { throw new ConvexError({ code: "internal", detail: `Embedding failed: ${String(e?.message ?? e).slice(0, 200)}` }); }
    const docId = await ctx.runMutation(internal.rag._insertDoc, {
      userId, workspaceId,
      title: a.title.trim().slice(0, 120) || "Untitled",
      charCount: Math.min(a.text.length, MAX_DOC_CHARS),
      chunks: chunks.map((text, i) => ({ text, embedding: embeddings[i] })),
    });
    return { docId, chunkCount: chunks.length };
  },
});

// internal: embed the query → vector-search the caller's chunks → return the top matching texts.
// Best-effort: returns [] on any failure (no OpenAI key, embed error) so chat still works without RAG.
export const retrieve = internalAction({
  args: { userId: v.id("users"), query: v.string(), workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, a): Promise<string[]> => {
    let vector: number[];
    try {
      const model = await embedder(ctx, a.userId, a.workspaceId);
      ({ embedding: vector } = await embed({ model, value: a.query.slice(0, 8000) }));
    } catch { return []; }
    const results = await ctx.vectorSearch("ragChunks", "by_embedding", { vector, limit: 6, filter: (q) => q.eq("userId", a.userId) });
    const ids = results.filter((r) => r._score > 0.2).map((r) => r._id); // drop weak matches
    if (ids.length === 0) return [];
    return ctx.runQuery(internal.rag._chunksByIds, { userId: a.userId, ids });
  },
});
