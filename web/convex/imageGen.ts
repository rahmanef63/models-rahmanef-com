"use node";
// Image OUTPUT for POST /v1/images/generations — the multimodal-OUT gap. Resolves the caller's OpenAI
// key (same cred pipeline as callForUser) and calls the AI SDK's generateImage. OpenAI-only for now
// (gpt-image-1 default; dall-e-3 also works) — other providers are a later increment.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { createOpenAI } from "@ai-sdk/openai";
import { generateImage } from "ai";
import { decryptSecret } from "./crypto";

export const generate = internalAction({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), prompt: v.string(), model: v.optional(v.string()), n: v.optional(v.number()), size: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ images: string[]; model: string }> => {
    const cred = await ctx.runQuery(internal.credentials.resolveCred, { userId: a.userId, workspaceId: a.workspaceId, provider: "openai" });
    if (!cred) throw new ConvexError({ code: "not_connected", detail: "Image generation needs an OpenAI API key — connect one in Providers." });
    const apiKey = await decryptSecret(cred.ciphertext);
    const modelId = (a.model || "gpt-image-1").replace(/^openai\//, "") || "gpt-image-1";
    const { images } = await generateImage({
      model: createOpenAI({ apiKey }).image(modelId),
      prompt: a.prompt,
      n: Math.min(Math.max(a.n ?? 1, 1), 4),
      ...(a.size && /^\d+x\d+$/.test(a.size) ? { size: a.size as `${number}x${number}` } : {}),
    });
    // ponytail: images aren't token-priced; log a 0/0 'ok' call so it shows in usage. Add $/image later.
    await ctx.runMutation(internal.usage.log, { userId: a.userId, workspaceId: a.workspaceId, provider: "openai", model: `openai/${modelId}`, promptTokens: 0, completionTokens: 0, status: "ok" });
    return { images: images.map((img) => img.base64), model: modelId };
  },
});
