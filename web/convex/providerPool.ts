// provider-pool (2.3) — credential SELECTION + COOLDOWN over the modelCreds rows that already
// exist (personal + workspace-shared). Only the BYOK generateText path pools; codex/claude OAuth
// creds are single-cred and never routed through here. pickCredentials returns up to 3 LIVE rows;
// markCredResult records the outcome (clears/cools/kills the cred) using the pure fallbackRules.
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { classifyProviderError } from "./fallbackRules";

const DEFAULT_PRIORITY = 100;
const isLive = (r: { status?: string; cooldownUntil?: number }, now: number) =>
  r.status !== "dead" && !(r.cooldownUntil && r.cooldownUntil > now);

// Pick up to 3 live candidate creds for (userId, [workspaceId,] provider), best first.
// Sources: personal rows (by_user_provider, workspaceId unset) + workspace-shared rows
// (by_ws_provider). Filters out dead / cooling rows, sorts priority asc then updatedAt asc (LRU),
// returns only what callForUser needs to decrypt + report.
export const pickCredentials = internalQuery({
  args: { userId: v.id("users"), workspaceId: v.optional(v.id("workspaces")), provider: v.string() },
  handler: async (ctx, a) => {
    const now = Date.now();
    const personal = await ctx.db
      .query("modelCreds")
      .withIndex("by_user_provider", (q) => q.eq("userId", a.userId).eq("provider", a.provider))
      .filter((q) => q.eq(q.field("workspaceId"), undefined))
      .take(10);
    const shared = a.workspaceId
      ? await ctx.db
          .query("modelCreds")
          .withIndex("by_ws_provider", (q) => q.eq("workspaceId", a.workspaceId!).eq("provider", a.provider))
          .take(10)
      : [];
    const live = [...personal, ...shared].filter((r) => isLive(r, now));
    live.sort((x, y) => (x.priority ?? DEFAULT_PRIORITY) - (y.priority ?? DEFAULT_PRIORITY) || (x.updatedAt ?? 0) - (y.updatedAt ?? 0));
    return live.slice(0, 3).map((r) => ({ credId: r._id, ciphertext: r.ciphertext, endpoint: r.endpoint }));
  },
});

// Record a call's outcome for one cred. ok → clear cooldown/backoff, mark 'ok'. error → run the
// pure rule table off the row's current backoffLevel and persist the verdict (cooldownUntil,
// status, lastErrorCode, backoffLevel). Returns the verdict so callForUser's loop can decide
// whether to try the next candidate without re-classifying.
export const markCredResult = internalMutation({
  args: { credId: v.id("modelCreds"), ok: v.boolean(), code: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.credId);
    if (!row) return { retryable: false, dead: false, cooldownMs: 0, nextBackoffLevel: 0 };
    if (a.ok) {
      await ctx.db.patch(a.credId, { status: "ok", cooldownUntil: undefined, backoffLevel: 0, lastErrorCode: undefined });
      return { retryable: false, dead: false, cooldownMs: 0, nextBackoffLevel: 0 };
    }
    const verdict = classifyProviderError(a.code ?? "internal", row.backoffLevel ?? 0);
    await ctx.db.patch(a.credId, {
      status: verdict.dead ? "dead" : verdict.cooldownMs > 0 ? "exhausted" : "ok",
      cooldownUntil: verdict.cooldownMs > 0 ? Date.now() + verdict.cooldownMs : undefined,
      backoffLevel: verdict.nextBackoffLevel,
      lastErrorCode: a.code,
    });
    return verdict;
  },
});
