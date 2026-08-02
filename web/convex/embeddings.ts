"use node";
// Shared OpenAI embedder (fixed model text-embedding-3-small → 1536 dims by default) + the
// /v1/embeddings gateway action. RAG and the OpenAI-compatible API both embed through here so they
// can't diverge on cred-resolution. RAG pins the default model (its vectorIndex is fixed-dim); the
// gateway may pass a different OpenAI embedding model since it only returns vectors, never stores them.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { decryptSecret } from "./crypto";
import { EMBED_MODEL } from "./ragChunk";

// resolve the caller's OpenAI key → an embedding model (embeddings only run on OpenAI here).
export async function resolveEmbedder(ctx: any, userId: string, workspaceId: any, model: string = EMBED_MODEL) {
  const cred = await ctx.runQuery(internal.credentials.resolveCred, { userId, workspaceId, provider: "openai" });
  if (!cred) throw new ConvexError({ code: "not_connected", detail: "Embeddings need an OpenAI API key — connect one in Providers." });
  const apiKey = await decryptSecret(cred.ciphertext);
  return createOpenAI({ apiKey }).embedding(model);
}

// internal: embed a batch of strings for POST /v1/embeddings. Returns one vector per input.
export const embedBatch = internalAction({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), input: v.array(v.string()), model: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ embeddings: number[][]; model: string; tokens: number }> => {
    const model = (a.model || EMBED_MODEL).replace(/^openai\//, "") || EMBED_MODEL;
    const embedder = await resolveEmbedder(ctx, a.userId, a.workspaceId, model);
    const { embeddings, usage } = await embedMany({ model: embedder, values: a.input.map((s) => s.slice(0, 8000)) });
    return { embeddings, model, tokens: (usage as any)?.tokens ?? 0 };
  },
});
