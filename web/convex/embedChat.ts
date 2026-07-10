"use node";
// Public chat endpoint behind the embeddable widget. Runs as the embed's OWNER (spending their
// creds), gated by: enabled + origin allowlist + per-embed rate limit + the workspace spend cap
// (enforced inside callForUser). The token is public — these gates, not secrecy, are the security.
// Returns { ok, reply | error, allowOrigin } so the Next route only sets CORS for an allowed origin.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callForUser } from "./callForUser";

export const reply = action({
  args: { token: v.string(), origin: v.string(), messages: v.array(v.object({ role: v.string(), content: v.string() })) },
  handler: async (ctx, a): Promise<{ ok: boolean; reply?: string; error?: string; allowOrigin?: string }> => {
    const embed = await ctx.runQuery(internal.embeds._validate, { token: a.token });
    if (!embed || !embed.enabled) return { ok: false, error: "This assistant is not available." };
    // origin gate FIRST — a disallowed origin never gets a CORS header (allowOrigin unset), so the
    // browser blocks the response even though the token is public.
    if (!a.origin || !embed.allowedOrigins.includes(a.origin)) return { ok: false, error: "This assistant isn't enabled for this website." };
    const rl = await ctx.runMutation(internal.rateLimit.hit, { key: `embed:${embed.id}`, max: 20, windowMs: 60_000 });
    if (!rl.ok) return { ok: false, error: `Too many messages — retry in ${rl.retryAfter}s.`, allowOrigin: a.origin };
    const msgs = a.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (!msgs.length) return { ok: false, error: "Say something first.", allowOrigin: a.origin };
    try {
      const r = await callForUser(ctx, embed.userId, embed.workspaceId, embed.model, msgs, embed.systemPrompt ? { system: embed.systemPrompt } : undefined);
      return { ok: true, reply: r.text || "(no reply)", allowOrigin: a.origin };
    } catch (e: any) {
      return { ok: false, error: e?.data?.detail ?? "The assistant is unavailable right now.", allowOrigin: a.origin };
    }
  },
});
