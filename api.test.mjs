// ponytail: self-check for the API's money paths — auth gating, CRUD, per-user isolation,
// keys never returned. Offline (never touches /models or /chat network paths). Run via npm test.
import assert from 'node:assert/strict'
import { createModelsApi } from './src/api.js'
import { memoryCredentialStore } from './src/store.js'

const store = memoryCredentialStore()
// authenticate reads x-user header; missing -> null (401)
const api = createModelsApi({ store, authenticate: (req) => req.headers.get('x-user') || null })
const call = (method, path, { user, body } = {}) =>
  api(new Request('http://x' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }))

// health is open
assert.equal((await call('GET', '/health')).status, 200)

// unauthenticated CRUD is rejected
assert.equal((await call('GET', '/providers')).status, 401)
assert.equal((await call('PUT', '/providers/openai', { body: { apiKey: 'x' } })).status, 401)

// upsert + read
assert.equal((await call('PUT', '/providers/openai', { user: 'u1', body: { apiKey: 'sk-u1' } })).status, 200)
assert.equal((await call('PUT', '/providers/anthropic', { user: 'u1', body: { apiKey: 'sk-u1-a' } })).status, 200)
let res = await call('GET', '/providers', { user: 'u1' })
let bodyText = await res.text()
assert.equal(res.status, 200)
assert.deepEqual(JSON.parse(bodyText).providers.map((p) => p.provider).sort(), ['anthropic', 'openai'])
assert.ok(!bodyText.includes('sk-u1'), 'API must never return raw keys')

// per-user isolation: u2 sees nothing of u1
res = await call('GET', '/providers', { user: 'u2' })
assert.deepEqual((await res.json()).providers, [])

// bad PUT body rejected
assert.equal((await call('PUT', '/providers/openai', { user: 'u1', body: {} })).status, 400)

// delete
assert.equal((await call('DELETE', '/providers/openai', { user: 'u1' })).status, 204)
assert.deepEqual((await (await call('GET', '/providers', { user: 'u1' })).json()).providers.map((p) => p.provider), ['anthropic'])

// read-only store (no deleteKey) → DELETE reports 405, not a false 204
const roApi = createModelsApi({
  store: { getKey: async () => null, setKey: async () => {}, listProviders: async () => [] },
  authenticate: () => 'u1',
})
assert.equal((await roApi(new Request('http://x/providers/openai', { method: 'DELETE' }))).status, 405)

// unknown route
assert.equal((await call('GET', '/nope', { user: 'u1' })).status, 404)

console.log('ok — API auth gating, CRUD upsert/delete, per-user isolation, no key leak all pass')
