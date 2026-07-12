"use node";
// Public "add a custom OpenAI-compatible provider" action — the client-callable sibling of the
// connect_custom_provider tool (toolHandlers.ts), so custom endpoints can be added from the UI, not
// only by asking the AI. name → slug, baseURL (SSRF-guarded), key → an api_key cred with a stored
// `endpoint` that modelFor uses (OPENAI_COMPAT[slug] ?? endpoint). Built-in slugs are rejected.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireUser } from "./_shared/auth";
import { encryptSecret } from "./crypto";
import { assertSafeUrl } from "./_shared/ssrf";
import { OPENAI_COMPAT } from "./chatProviders";

const BUILTIN = new Set(["openai", "anthropic", "google", "openrouter", "openai-codex", "anthropic-oauth", "github-copilot", ...Object.keys(OPENAI_COMPAT)]);
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

export const connectCustomProvider = action({
  // protocol: "anthropic" = the endpoint speaks the Anthropic Messages API (POST {baseURL}/messages);
  // anything else = OpenAI /chat/completions (the default).
  args: { name: v.string(), baseURL: v.string(), apiKey: v.string(), protocol: v.optional(v.string()), models: v.optional(v.array(v.string())) },
  handler: async (ctx, a): Promise<{ slug: string }> => {
    const userId = await requireUser(ctx);
    const slug = slugify(a.name);
    if (!slug) throw new ConvexError({ code: "invalid_request", detail: "A name is required (letters/numbers)." });
    if (BUILTIN.has(slug)) throw new ConvexError({ code: "invalid_request", detail: `"${slug}" is a built-in provider — connect it directly, not as a custom provider.` });
    if (!a.apiKey) throw new ConvexError({ code: "invalid_request", detail: "apiKey required." });
    const baseURL = a.baseURL.trim();
    try { assertSafeUrl(baseURL); } catch (e: any) { throw new ConvexError({ code: "invalid_request", detail: `Invalid endpoint: ${e?.data?.detail ?? "bad URL"}` }); }
    const protocol = a.protocol === "anthropic" ? "anthropic" : undefined; // only anthropic is a departure from the default
    const models = a.models ? [...new Set(a.models.map((s) => s.trim()).filter(Boolean))].slice(0, 100) : undefined;
    await ctx.runMutation(internal.credentials._connectForUser, { userId, provider: slug, ciphertext: await encryptSecret(a.apiKey), endpoint: baseURL, protocol, models });
    return { slug };
  },
});
