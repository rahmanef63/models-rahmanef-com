"use node";
// OAuth 2.1 minting + PKCE (node crypto). Paranoid: PKCE S256 required, redirect_uri must be
// pre-registered, codes single-use w/ 60s TTL bound to client+challenge, tokens stored as sha256.
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha256hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256b64url(s: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
}
const rand = (prefix: string, n = 32) => prefix + b64url(crypto.getRandomValues(new Uint8Array(n)));
const okRedirect = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || x.hostname === "localhost" || x.hostname === "127.0.0.1"; } catch { return false; } };

// Dynamic Client Registration (RFC 7591). Open registration — a client is inert until a USER
// approves it on the consent page and completes PKCE, so this only records redirect_uris.
export const registerClient = action({
  args: { name: v.optional(v.string()), redirectUris: v.array(v.string()) },
  handler: async (ctx, a): Promise<{ client_id: string; redirect_uris: string[] }> => {
    const uris = [...new Set(a.redirectUris.filter(okRedirect))];
    if (uris.length === 0) throw new Error("at least one https redirect_uri required");
    if (uris.length > 8) throw new Error("too many redirect_uris");
    const clientId = rand("mcpc_", 18);
    await ctx.runMutation(internal.mcpOauth._registerClient, { clientId, name: (a.name || "MCP Client").slice(0, 80), redirectUris: uris });
    return { client_id: clientId, redirect_uris: uris };
  },
});

// Called by the consent page AFTER the signed-in user clicks Approve. Issues a single-use code.
export const createAuthCode = action({
  args: { clientId: v.string(), redirectUri: v.string(), codeChallenge: v.string(), codeChallengeMethod: v.string(), scope: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ code: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (a.codeChallengeMethod !== "S256" || !a.codeChallenge) throw new Error("PKCE S256 required");
    const client = await ctx.runQuery(internal.mcpOauth._getClient, { clientId: a.clientId });
    if (!client) throw new Error("unknown client");
    if (!client.redirectUris.includes(a.redirectUri)) throw new Error("redirect_uri not registered for this client");
    const code = rand("mcpa_", 32);
    await ctx.runMutation(internal.mcpOauth._storeAuthCode, {
      codeHash: await sha256hex(code), userId, clientId: a.clientId, redirectUri: a.redirectUri,
      codeChallenge: a.codeChallenge, scope: (a.scope || "mcp").slice(0, 200), expiresAt: Date.now() + 60_000,
    });
    return { code };
  },
});

// Backing for /oauth/token. Validates the code + PKCE verifier, mints the bearer (sha256-stored).
export const exchangeCode = action({
  args: { code: v.string(), clientId: v.string(), redirectUri: v.string(), codeVerifier: v.string() },
  handler: async (ctx, a): Promise<{ access_token: string; token_type: string; scope: string }> => {
    const rec = await ctx.runMutation(internal.mcpOauth._consumeAuthCode, { codeHash: await sha256hex(a.code) });
    if (!rec) throw new Error("invalid_grant");
    if (rec.clientId !== a.clientId || rec.redirectUri !== a.redirectUri) throw new Error("invalid_grant");
    if ((await sha256b64url(a.codeVerifier)) !== rec.codeChallenge) throw new Error("invalid_grant");
    const token = rand("mcp_", 32);
    await ctx.runMutation(internal.mcp._storeToken, { userId: rec.userId, tokenHash: await sha256hex(token), label: `oauth · ${rec.clientId.slice(0, 14)}`, clientId: rec.clientId, scope: rec.scope });
    return { access_token: token, token_type: "Bearer", scope: rec.scope };
  },
});
