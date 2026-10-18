"use node";
import { generateText } from "ai";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { decryptSecret } from "./crypto";
import { modelFor } from "./chatProviders";
import { classifyError } from "./chatErrors";

export type CredentialCheckResult = { ok: boolean; code?: string; status?: number; detail?: string };

// A check spends only on the primary API key snapshot; no pool fallback, tools, or recalled memory.
export async function checkPrimaryCredential(ctx: ActionCtx, userId: Id<"users">, a: { provider: string; model: string }): Promise<CredentialCheckResult> {
  let row: Doc<"modelCreds"> | null = null;
  let outcome: CredentialCheckResult;
  let promptTokens = 0, completionTokens = 0;
  try {
    row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider: a.provider });
    if (!row) outcome = { ok: false, code: "not_connected", detail: "No personal API key is connected." };
    else if ((row.kind ?? "api_key") !== "api_key" || ["openai-codex", "anthropic-oauth", "github-copilot"].includes(a.provider)) {
      outcome = { ok: false, code: "invalid_request", detail: "Connectivity checks require an API-key provider." };
    } else {
      const model = modelFor(a.provider, a.model, await decryptSecret(row.ciphertext), row.endpoint, row.protocol);
      if (!model) throw new Error("Unknown provider");
      const result = await generateText({ model, messages: [{ role: "user", content: "ping" }], maxOutputTokens: 1, maxRetries: 0 });
      const usage: any = result.usage ?? {};
      promptTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
      completionTokens = usage.outputTokens ?? usage.completionTokens ?? 0;
      outcome = { ok: true };
    }
  } catch (error) { outcome = { ok: false, ...classifyError(error, a.provider) }; }
  // Telemetry failure must not erase a completed provider verdict or cause another model call.
  try { await ctx.runMutation(internal.usage.log, { userId, provider: a.provider, model: `${a.provider}/${a.model}`, promptTokens, completionTokens, status: outcome.ok ? "ok" : "error" }); } catch { /* best-effort */ }
  if (row) {
    try {
      const saved = await ctx.runMutation(internal.credentials._recordCheck, { userId, provider: a.provider, credId: row._id, ciphertext: row.ciphertext, updatedAt: row.updatedAt, endpoint: row.endpoint, protocol: row.protocol, ok: outcome.ok, code: outcome.code, detail: outcome.detail });
      if (!saved) return { ok: false, code: "credential_changed", detail: "Credential changed during the check. Run the check again." };
    } catch { return { ok: false, code: "check_not_saved", detail: "Check could not be saved. Run the check again." }; }
  }
  return outcome;
}
