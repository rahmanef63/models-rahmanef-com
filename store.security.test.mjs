import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileCredentialStore } from './src/store.js'
import { parseRef, resolveModel } from './src/resolve.js'

const temp = await mkdtemp(join(tmpdir(), 'models-store-security-'))
const file = join(temp, 'synthetic-creds.json')
const store = fileCredentialStore(file)
try {
  assert.equal(await store.getKey('constructor', 'toString'), null)
  assert.deepEqual(await store.listProviders('__proto__'), [])
  assert.equal(await store.getKey('unknown', 'openai'), null)
  for (const tenant of ['u1', 'u2', '__proto__', 'constructor', 'toString']) {
    for (const provider of ['openai', '__proto__', 'constructor', 'toString'])
      await store.setKey(tenant, provider, 'synthetic-' + tenant + '-' + provider)
  }
  for (const tenant of ['u1', 'u2', '__proto__', 'constructor', 'toString']) {
    assert.equal(await store.getKey(tenant, 'openai'), 'synthetic-' + tenant + '-openai')
    assert.deepEqual((await store.listProviders(tenant)).sort(), ['__proto__', 'constructor', 'openai', 'toString'])
  }
  await store.deleteKey('__proto__', 'openai')
  assert.equal(await store.getKey('__proto__', 'openai'), null)
  assert.equal(await store.getKey('u1', 'openai'), 'synthetic-u1-openai')
  assert.equal((await stat(file)).mode & 0o777, 0o600)
  assert.equal(Object.prototype.openai, undefined)

  const original = await readFile(file, 'utf8')
  await assert.rejects(store.setKey({}, 'openai', 'synthetic'))
  await assert.rejects(store.setKey('u1', 'openai', {}))
  assert.equal(await readFile(file, 'utf8'), original)

  for (const raw of ['{', 'null', '[]', '42', '{"u1":[]}', '{"u1":null}',
    '{"u1":{"openai":{}}}', '{"u1":{"openai":""}}']) {
    await writeFile(file, raw)
    await assert.rejects(store.getKey('u1', 'openai'), /could not be read/)
    await assert.rejects(store.listProviders('u1'), /could not be read/)
    await assert.rejects(store.setKey('u2', 'openai', 'synthetic'), /could not be read/)
    await assert.rejects(store.deleteKey('u1', 'openai'), /could not be read/)
    assert.equal(await readFile(file, 'utf8'), raw, 'corrupt fixture was silently replaced')
  }

  for (const ref of [null, {}, [], 1, 'openai/ ', 'bad provider/model', '__proto__/model'])
    assert.throws(() => parseRef(ref))
  let keyReads = 0
  await assert.rejects(resolveModel('constructor/model', {
    tenantId: 'u1', store: { getKey: async () => { keyReads++; return 'synthetic' } },
  }), /unknown provider/)
  assert.equal(keyReads, 0, 'inherited registry entry was trusted')
  console.log('ok — file-store tenant isolation, prototype keys, permissions, corrupt-store preservation, registry ownership')
} finally {
  await rm(temp, { recursive: true, force: true })
}
