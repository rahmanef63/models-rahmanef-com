// Convex CredentialStore — the multi-tenant BYOK backend.
//
// SECURITY — tenant identity:
//   In production DERIVE tenantId from YOUR auth, do NOT trust it from the client:
//     const id = await ctx.auth.getUserIdentity(); const tenantId = id.subject
//   The args below take tenantId only so the reference stays auth-provider-agnostic — each
//   host keeps its own auth (Clerk / @convex-dev/auth / custom). Replace the `tenantId` arg
//   with a ctx.auth lookup once you've wired yours.
//
// Requires: MODELS_ENC_KEY env var (see crypto.ts). Copy _generated import path to your app.

import { mutation, query, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { encryptSecret, decryptSecret } from './crypto'

// --- CredentialStore usable inside a Convex action (server-side resolveModel) ---
// const store = convexCredentialStore(ctx, api, internal)   // pass BOTH generated objects
// const resolved = await resolveModel(ref, { tenantId, store })
export function convexCredentialStore(ctx: any, api: any, internal: any) {
  return {
    async getKey(tenantId: string, provider: string): Promise<string | null> {
      // _getRow is an internalQuery -> reachable only via `internal`, never `api`
      const row = await ctx.runQuery(internal.credentials._getRow, { tenantId, provider })
      return row ? await decryptSecret(row.ciphertext) : null
    },
    async setKey(tenantId: string, provider: string, key: string): Promise<void> {
      await ctx.runMutation(api.credentials.setCredential, { tenantId, provider, apiKey: key })
    },
  }
}

// internal: returns the ciphertext row — never expose this to clients
export const _getRow = internalQuery({
  args: { tenantId: v.string(), provider: v.string() },
  handler: (ctx, a) =>
    ctx.db
      .query('modelCreds')
      .withIndex('by_tenant_provider', (q) => q.eq('tenantId', a.tenantId).eq('provider', a.provider))
      .unique(),
})

export const setCredential = mutation({
  args: { tenantId: v.string(), provider: v.string(), apiKey: v.string() },
  handler: async (ctx, a) => {
    const ciphertext = await encryptSecret(a.apiKey)
    const existing = await ctx.db
      .query('modelCreds')
      .withIndex('by_tenant_provider', (q) => q.eq('tenantId', a.tenantId).eq('provider', a.provider))
      .unique()
    if (existing) await ctx.db.patch(existing._id, { ciphertext, updatedAt: Date.now() })
    else await ctx.db.insert('modelCreds', { tenantId: a.tenantId, provider: a.provider, ciphertext, updatedAt: Date.now() })
  },
})

export const deleteCredential = mutation({
  args: { tenantId: v.string(), provider: v.string() },
  handler: async (ctx, a) => {
    const row = await ctx.db
      .query('modelCreds')
      .withIndex('by_tenant_provider', (q) => q.eq('tenantId', a.tenantId).eq('provider', a.provider))
      .unique()
    if (row) await ctx.db.delete(row._id)
  },
})

// Which providers a tenant has configured — returns slugs only, never ciphertext.
export const listConfiguredProviders = query({
  args: { tenantId: v.string() },
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query('modelCreds')
      .withIndex('by_tenant', (q) => q.eq('tenantId', a.tenantId))
      .collect()
    return rows.map((r) => r.provider)
  },
})
