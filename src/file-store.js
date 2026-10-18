import { readFile, writeFile, mkdir, chmod, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { credentialScope, credentialValue, isRecord } from './validation.js'

function normalize(data) {
  if (!isRecord(data)) throw new Error('invalid credential store')
  const out = Object.create(null)
  for (const [tenant, providers] of Object.entries(data)) {
    if (!isRecord(providers)) throw new Error('invalid credential store')
    out[tenant] = Object.create(null)
    for (const [provider, key] of Object.entries(providers)) {
      credentialScope(tenant, provider)
      credentialValue(key)
      out[tenant][provider] = key
    }
  }
  return out
}

/** JSON credentials with own-property tenant isolation and atomic writes (single writer). */
export function createFileStore(filePath) {
  const load = async () => {
    try { return normalize(JSON.parse(await readFile(filePath, 'utf8'))) } catch (error) {
      if (error?.code === 'ENOENT') return Object.create(null)
      // Never replace a corrupt or unreadable store with an empty one on mutation.
      throw new Error('credential store could not be read')
    }
  }
  const save = async (data) => {
    await mkdir(dirname(filePath), { recursive: true })
    const tmp = filePath + '.tmp'
    await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
    await chmod(tmp, 0o600)
    await rename(tmp, filePath)
  }
  return {
    async getKey(id, p) {
      const tenant = credentialScope(id, p)
      return (await load())[tenant]?.[p] ?? null
    },
    async setKey(id, p, key) {
      const tenant = credentialScope(id, p)
      credentialValue(key)
      const data = await load()
      data[tenant] ??= Object.create(null)
      data[tenant][p] = key
      await save(data)
    },
    async deleteKey(id, p) {
      const tenant = credentialScope(id, p)
      const data = await load()
      if (data[tenant]) { delete data[tenant][p]; await save(data) }
    },
    async listProviders(id) {
      const tenant = credentialScope(id, '_')
      return Object.keys((await load())[tenant] ?? {})
    },
  }
}
