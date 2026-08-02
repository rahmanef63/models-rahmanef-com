// Merge this table into your host app's convex/schema.ts. One row per (tenant, provider).
// ciphertext = encryptSecret() output (base64 iv||ct). Never store the raw key.
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const modelCredsTables = {
  modelCreds: defineTable({
    tenantId: v.string(),
    provider: v.string(),
    ciphertext: v.string(),
    updatedAt: v.number(),
  })
    .index('by_tenant_provider', ['tenantId', 'provider'])
    .index('by_tenant', ['tenantId']),
}

// If this is the whole schema, just: export default defineSchema(modelCredsTables)
export default defineSchema(modelCredsTables)
