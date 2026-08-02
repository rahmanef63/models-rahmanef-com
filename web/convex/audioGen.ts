"use node";
// Audio for the gateway — TTS (POST /v1/audio/speech) and STT (POST /v1/audio/transcriptions), the
// last OpenAI modality. Same cred pipeline as callForUser, OpenAI-only for now (tts-1 / whisper-1).
// ponytail: transcription takes base64 audio in a JSON body (not multipart) — the /v1 route parses
// JSON only; add multipart if a real OpenAI SDK client needs the file field.
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { createOpenAI } from "@ai-sdk/openai";
import { generateSpeech, transcribe } from "ai";
import { decryptSecret } from "./crypto";

async function openaiFor(ctx: any, userId: string, workspaceId: any) {
  const cred = await ctx.runQuery(internal.credentials.resolveCred, { userId, workspaceId, provider: "openai" });
  if (!cred) throw new ConvexError({ code: "not_connected", detail: "Audio needs an OpenAI API key — connect one in Providers." });
  return createOpenAI({ apiKey: await decryptSecret(cred.ciphertext) });
}

const logCall = (ctx: any, userId: string, workspaceId: any, model: string) =>
  ctx.runMutation(internal.usage.log, { userId, workspaceId, provider: "openai", model: `openai/${model}`, promptTokens: 0, completionTokens: 0, status: "ok" });

// text → base64 audio (mp3 by default).
export const speech = internalAction({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), input: v.string(), model: v.optional(v.string()), voice: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ audio: string; contentType: string }> => {
    const p = await openaiFor(ctx, a.userId, a.workspaceId);
    const modelId = (a.model || "tts-1").replace(/^openai\//, "") || "tts-1";
    const { audio } = await generateSpeech({ model: p.speech(modelId), text: a.input, ...(a.voice ? { voice: a.voice } : { voice: "alloy" }) });
    await logCall(ctx, a.userId, a.workspaceId, modelId);
    return { audio: audio.base64, contentType: audio.mediaType || "audio/mpeg" };
  },
});

// base64 audio → text.
export const transcription = internalAction({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), audioBase64: v.string(), model: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ text: string }> => {
    const p = await openaiFor(ctx, a.userId, a.workspaceId);
    const modelId = (a.model || "whisper-1").replace(/^openai\//, "") || "whisper-1";
    const { text } = await transcribe({ model: p.transcription(modelId), audio: a.audioBase64 });
    await logCall(ctx, a.userId, a.workspaceId, modelId);
    return { text };
  },
});
