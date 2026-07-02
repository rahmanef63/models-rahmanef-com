// ponytail: one runnable self-check for the money paths — ref parsing + multi-tenant/host-gate.
// Offline (resolveModel does no network unless info:true). Run: npm test
import assert from 'node:assert/strict'
import { parseRef, resolveModel } from './src/resolve.js'
import { memoryCredentialStore } from './src/store.js'
import { PROVIDERS, hostOf } from './src/registry.js'

// registry slug must equal its models.dev catalogId, else /models filter + CLI silently drop it
for (const [slug, conn] of Object.entries(PROVIDERS)) assert.equal(slug, conn.catalogId, `provider "${slug}" slug != catalogId`)

// parseRef splits on FIRST '/', model id may contain '/'
assert.deepEqual(parseRef('openrouter/moonshotai/kimi-k2'), { provider: 'openrouter', model: 'moonshotai/kimi-k2' })
assert.throws(() => parseRef('nope'))
assert.throws(() => parseRef('openai/'))

const store = memoryCredentialStore()
await store.setKey('tenantA', 'openai', 'sk-openai-A')
await store.setKey('tenantA', 'anthropic', 'sk-anthropic-A')
await store.setKey('tenantB', 'openai', 'sk-openai-B')

// per-tenant isolation
const a = await resolveModel('openai/gpt-4o-mini', { tenantId: 'tenantA', store })
assert.equal(a.apiKey, 'sk-openai-A')
const b = await resolveModel('openai/gpt-4o-mini', { tenantId: 'tenantB', store })
assert.equal(b.apiKey, 'sk-openai-B')

// host-gate: key is bound to the provider's own host, never reused cross-provider
assert.equal(a.baseUrl, PROVIDERS.openai.baseUrl)
assert.equal(hostOf(a.baseUrl), 'api.openai.com')
const anth = await resolveModel('anthropic/claude-opus-4-8', { tenantId: 'tenantA', store })
assert.equal(anth.apiKey, 'sk-anthropic-A')
assert.equal(hostOf(anth.baseUrl), 'api.anthropic.com')
assert.equal(anth.protocol, 'anthropic')

// host-gate holds even if caller passes a rogue baseUrl for a KNOWN provider: override ignored
const spoof = await resolveModel('anthropic/claude-opus-4-8', { tenantId: 'tenantA', store, baseUrl: 'https://evil.example' })
assert.equal(spoof.baseUrl, PROVIDERS.anthropic.baseUrl)

// missing key throws — no silent cross-provider fallback
await store.deleteKey('tenantB', 'openai')
await assert.rejects(resolveModel('openai/gpt-4o-mini', { tenantId: 'tenantB', store }))

// unknown provider needs explicit baseUrl
await store.setKey('tenantA', 'localllm', 'x')
await assert.rejects(resolveModel('localllm/foo', { tenantId: 'tenantA', store }))
const custom = await resolveModel('localllm/foo', { tenantId: 'tenantA', store, baseUrl: 'http://127.0.0.1:1234/v1' })
assert.equal(custom.baseUrl, 'http://127.0.0.1:1234/v1')

console.log('ok — parseRef, per-tenant isolation, host-gate, custom endpoint all pass')
