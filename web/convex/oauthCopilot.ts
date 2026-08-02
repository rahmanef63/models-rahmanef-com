// GitHub Copilot device-code login (3rd OAuth provider). Kept out of oauth.ts (already 185/200
// lines) but REUSES its shared _setFlow/_getFlow/_clearFlow. userId always from requireUser, never
// the client. See copilotLib for the endpoints + the ToS caveat.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./_shared/auth";
import { encryptSecret, decryptSecret } from "./crypto";
import { COPILOT, ensureFreshCopilot, copilotModels, type CopilotBundle } from "./copilotLib";

const ghHeaders = { "Content-Type": "application/json", Accept: "application/json", "User-Agent": COPILOT.userAgent };

export const startCopilotLogin = action({
  args: {},
  handler: async (ctx): Promise<{ verificationUrl: string; userCode: string; intervalMs: number }> => {
    const userId = await requireUser(ctx);
    const res = await fetch(COPILOT.deviceCodeUrl, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ client_id: COPILOT.clientId, scope: COPILOT.scope }),
    });
    if (!res.ok) throw new Error(`could not start GitHub Copilot login (${res.status})`);
    const j = await res.json();
    if (!j.device_code) throw new Error("GitHub returned no device code");
    // device_code goes in deviceAuthId (the poll credential); user_code is the human display code.
    await ctx.runMutation(internal.oauth._setFlow, { userId, provider: "github-copilot", deviceAuthId: j.device_code, userCode: j.user_code });
    return { verificationUrl: j.verification_uri ?? COPILOT.verificationUrl, userCode: j.user_code, intervalMs: Math.max(5, parseInt(j.interval ?? "5", 10)) * 1000 };
  },
});

// Browser polls this until status !== "pending". GitHub returns {error:"authorization_pending"}
// while the user hasn't approved yet — that maps to pending, not a failure.
export const pollCopilotLogin = action({
  args: {},
  handler: async (ctx): Promise<{ status: "pending" | "done" | "expired" }> => {
    const userId = await requireUser(ctx);
    const flow = await ctx.runQuery(internal.oauth._getFlow, { userId, provider: "github-copilot" });
    if (!flow?.deviceAuthId) return { status: "expired" };
    const res = await fetch(COPILOT.tokenUrl, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ client_id: COPILOT.clientId, device_code: flow.deviceAuthId, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    if (!res.ok) throw new Error(`copilot login poll failed (${res.status})`);
    const j = await res.json();
    if (j.error === "authorization_pending" || j.error === "slow_down") return { status: "pending" };
    if (j.error === "expired_token" || j.error === "access_denied") {
      await ctx.runMutation(internal.oauth._clearFlow, { userId, provider: "github-copilot" });
      return { status: "expired" };
    }
    if (!j.access_token) return { status: "pending" };
    // durable GitHub token in hand → exchange for the first Copilot API token so `expires` is set,
    // then persist the whole bundle (callForUser refreshes the short-lived half thereafter).
    const fresh = await ensureFreshCopilot({ ghToken: j.access_token, expires: 0 });
    await ctx.runMutation(internal.credentials.store, { userId, provider: "github-copilot", kind: "oauth", ciphertext: await encryptSecret(JSON.stringify(fresh.bundle)), expires: fresh.bundle.expires });
    await ctx.runMutation(internal.oauth._clearFlow, { userId, provider: "github-copilot" });
    return { status: "done" };
  },
});

// Best-effort model refs for the picker, e.g. "github-copilot/gpt-4o". Read-only (never refreshes).
export const copilotModelList = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await requireUser(ctx);
    const row = await ctx.runQuery(internal.credentials.getCiphertext, { userId, provider: "github-copilot" });
    if (!row || row.kind !== "oauth") return [];
    try {
      const bundle: CopilotBundle = JSON.parse(await decryptSecret(row.ciphertext));
      return (await copilotModels(bundle)).map((id) => `github-copilot/${id}`);
    } catch {
      return [];
    }
  },
});
