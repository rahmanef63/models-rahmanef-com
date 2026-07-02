#!/usr/bin/env node
// Terminal method for per-user model CRUD. Default: a LOCAL file store (no server needed,
// like hermes/openclaw CLIs). Set MODELS_API=<url> [MODELS_TOKEN=..] to drive a remote API.
//
//   models add <provider>           add/update a key (from MODELS_KEY env, piped stdin, or arg)
//   models ls                       list configured providers
//   models rm <provider>            remove a provider
//   models models [--all]           list models (yours, or --all from the catalog)
//   models init [convexDir]         copy the Convex multi-tenant adapter into a project
//
// MODELS_USER selects the local tenant (default "local"). MODELS_CREDS_DIR moves the store.
import { fileCredentialStore } from '../src/store.js'
import { listModels } from '../src/catalog.js'

const argv = process.argv.slice(2)
const [cmd, a, b] = argv
const USER = process.env.MODELS_USER || 'local'
const API = process.env.MODELS_API
const store = fileCredentialStore()

async function remote(method, path, body) {
  const res = await fetch(API.replace(/\/$/, '') + path, {
    method,
    headers: { 'content-type': 'application/json', ...(process.env.MODELS_TOKEN ? { authorization: `Bearer ${process.env.MODELS_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) { console.error(`API ${res.status}: ${await res.text()}`); process.exit(1) }
  return res.status === 204 ? null : res.json()
}

function usage(code = 0) {
  console.log('usage: models <add|ls|rm|models|init> ...\n  add <provider>   (key via MODELS_KEY env, piped stdin, or arg)\n  ls\n  rm <provider>\n  models [--all]\n  init [convexDir]')
  process.exit(code)
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8').trim()
}

async function init(dir) {
  const { cp, mkdir } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join, resolve } = await import('node:path')
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'adapters', 'convex')
  const dest = resolve(dir || 'convex')
  await mkdir(dest, { recursive: true })
  for (const f of ['crypto.ts', 'credentials.ts']) { await cp(join(src, f), join(dest, f)); console.log(`  copied → ${join(dest, f)}`) }
  console.log(`\nNext:\n  1. Merge modelCreds (adapters/convex/schema.ts) into ${dest}/schema.ts\n  2. npx convex env set MODELS_ENC_KEY "$(openssl rand -base64 32)"\n  3. In credentials.ts derive tenantId from YOUR auth (ctx.auth.getUserIdentity().subject)`)
}

switch (cmd) {
  case 'add': {
    if (!a) usage(1)
    let key = b
    if (key) process.stderr.write('warning: key on the command line leaks via shell history / ps — prefer `MODELS_KEY=… models add <provider>` or piping it in\n')
    else key = process.env.MODELS_KEY || (await readStdin())
    if (!key) { console.error('no key: set MODELS_KEY, pipe it in, or pass as an argument'); process.exit(1) }
    if (API) await remote('PUT', `/providers/${encodeURIComponent(a)}`, { apiKey: key }); else await store.setKey(USER, a, key)
    console.log(`added ${a}`); break
  }
  case 'ls': {
    const provs = API ? (await remote('GET', '/providers')).providers.map((p) => p.provider) : await store.listProviders(USER)
    console.log(provs.length ? provs.join('\n') : '(none)'); break
  }
  case 'rm':
    if (!a) usage(1)
    if (API) await remote('DELETE', `/providers/${encodeURIComponent(a)}`); else await store.deleteKey(USER, a)
    console.log(`removed ${a}`); break
  case 'models': {
    const all = argv.includes('--all')
    let models
    if (API) models = (await remote('GET', `/models${all ? '?all' : ''}`)).models
    else { const cat = await listModels().catch(() => []); const mine = new Set(await store.listProviders(USER)); models = all ? cat : cat.filter((m) => mine.has(m.provider)) }
    for (const m of models) console.log(m.ref); break
  }
  case 'init': await init(a); break
  default: usage(cmd ? 1 : 0)
}
