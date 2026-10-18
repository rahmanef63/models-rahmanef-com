export const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const validTenant = (value) => typeof value === 'string' && value.trim().length > 0
// Registry and credential lookup share lowercase slugs; aliases must not bypass host pinning.
export const validProvider = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(value)

export function credentialScope(tenantId, provider) {
  if (tenantId != null && typeof tenantId !== 'string') throw new TypeError('invalid tenant id')
  if (typeof provider !== 'string' || !provider) throw new TypeError('invalid provider')
  return tenantId ?? ''
}

export function credentialValue(key) {
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('invalid credential')
}
