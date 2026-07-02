// AES-256-GCM at rest for BYOK keys. Both openclaw and hermes store keys in plaintext files
// (0o600) — acceptable single-user, NOT acceptable in a shared multi-tenant DB. So we encrypt.
// Master key: env MODELS_ENC_KEY = base64 of 32 random bytes  (openssl rand -base64 32).
// Uses Web Crypto (available in the Convex runtime).

const enc = new TextEncoder()
const dec = new TextDecoder()

async function masterKey(): Promise<CryptoKey> {
  const b64 = process.env.MODELS_ENC_KEY
  if (!b64) throw new Error('MODELS_ENC_KEY not set (base64 of 32 bytes; `openssl rand -base64 32`)')
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  if (raw.byteLength !== 32) throw new Error('MODELS_ENC_KEY must decode to exactly 32 bytes')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Returns base64( iv[12] || ciphertext ). */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await masterKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return btoa(String.fromCharCode(...out))
}

export async function decryptSecret(blob: string): Promise<string> {
  const key = await masterKey()
  const raw = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))
  return dec.decode(pt)
}
