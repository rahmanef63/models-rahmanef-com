import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temp = await mkdtemp(join(tmpdir(), 'models-api-security-'))
process.env.MODELS_CACHE_DIR = temp
process.env.MODELS_CREDS_DIR = temp
const originalFetch = globalThis.fetch
let fetches = 0
const catalog = {
  openai: { models: { synthetic: { name: 'Synthetic' } } },
  anthropic: { models: { synthetic: { name: 'Synthetic' } } },
}
globalThis.fetch = async () => { fetches++; return Response.json(catalog) }
try {
  const { createModelsApi } = await import('./src/api.js')
  const { memoryCredentialStore } = await import('./src/store.js')
  const store = memoryCredentialStore()
  await store.setKey('u1', 'openai', 'synthetic-secret')
  const request = (path, method = 'GET', raw) => new Request('https://api.invalid' + path, {
    method, ...(raw === undefined ? {} : { body: raw, headers: { 'content-type': 'application/json' } }),
  })

  // Cold cache: rejected requests must never reach the mocked outbound boundary.
  for (const identity of [null, undefined, '', ' ', true, 1, {}, [], ['u1']]) {
    const api = createModelsApi({ store, authenticate: () => identity })
    for (const path of ['/providers', '/models', '/models?refresh', '/models?all&refresh'])
      assert.equal((await api(request(path))).status, 401, path)
  }
  assert.equal(fetches, 0, 'unauthenticated catalog requests reached fetch')

  // Preserve public ?all without refresh, including an invalid optional identity.
  await writeFile(join(temp, 'catalog.json'), JSON.stringify({ at: Date.now(), data: catalog }))
  const publicApi = createModelsApi({ store, authenticate: () => null })
  assert.equal((await publicApi(request('/models?all'))).status, 200)
  assert.equal(fetches, 0)
  const api = createModelsApi({ store, authenticate: () => 'u1', cors: true })
  const owned = await (await api(request('/models'))).json()
  assert.deepEqual(owned.models.map((m) => m.provider), ['openai'])
  assert.equal((await api(request('/models?all&refresh'))).status, 200)
  assert.equal(fetches, 1)

  for (const raw of ['null', '[]', '"text"', '42', '{', '{}', '{"apiKey":1}', '{"apiKey":"  "}']) {
    const res = await api(request('/providers/openai', 'PUT', raw))
    assert.equal(res.status, 400, raw)
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
  }
  for (const provider of ['%', '%2F', '%00', '%20', '__proto__', 'OpenAI', 'OPENAI', 'Anthropic'])
    assert.equal((await api(request('/providers/' + provider, 'PUT', '{"apiKey":"synthetic"}'))).status, 400)
  assert.equal(await store.getKey('u1', 'openai'), 'synthetic-secret')

  for (const body of [null, [], {}, { model: 4, messages: [] }, { model: 'openai/x', messages: {} },
    { model: 'openai/x', messages: [null] }, { model: 'openai/x', messages: [{ role: 'user' }] }]) {
    assert.equal((await api(request('/chat', 'POST', JSON.stringify(body)))).status, 400)
  }
  assert.equal((await api(request('/chat', 'POST', '{'))).status, 400)
  assert.equal(fetches, 1, 'invalid request reached provider')

  globalThis.fetch = async () => new Response('echo synthetic-secret', { status: 401 })
  const body = JSON.stringify({ model: 'openai/x', messages: [{ role: 'user', content: 'synthetic' }] })
  const failedChat = await api(request('/chat', 'POST', body))
  assert.equal(failedChat.status, 400)
  assert.ok(!(await failedChat.text()).includes('synthetic-secret'))
  for (const authenticate of [() => { throw Error('synthetic-secret') }, () => 'u1']) {
    const broken = createModelsApi({
      authenticate, store: { listProviders: async () => { throw Error('synthetic-secret') } },
    })
    const res = await broken(request('/providers'))
    assert.equal(res.status, 500)
    assert.ok(!(await res.text()).includes('synthetic-secret'))
  }
  console.log('ok — API cold-cache auth, identity types, public catalog, validation, sanitized failures')
} finally {
  globalThis.fetch = originalFetch
  // Let the catalog cache writer finish before removing the isolated fixture directory.
  await new Promise((resolve) => setTimeout(resolve, 20))
  await rm(temp, { recursive: true, force: true })
}
