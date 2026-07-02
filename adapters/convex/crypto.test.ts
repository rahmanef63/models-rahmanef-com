// ponytail: crypto is non-trivial (AES-GCM + base64), so it gets a runnable check.
// Run: node --experimental-strip-types adapters/convex/crypto.test.ts
import assert from 'node:assert/strict'
import { encryptSecret, decryptSecret } from './crypto.ts'

process.env.MODELS_ENC_KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))

const plain = 'sk-ant-api03-secret-key-value'
const blob = await encryptSecret(plain)
assert.notEqual(blob, plain)
assert.equal(await decryptSecret(blob), plain)

// fresh IV each call → different ciphertext for same plaintext
assert.notEqual(await encryptSecret(plain), await encryptSecret(plain))

// GCM auth tag rejects tampering
await assert.rejects(decryptSecret(blob.slice(0, -4) + (blob.endsWith('AAAA') ? 'BBBB' : 'AAAA')))

// wrong key size rejected
process.env.MODELS_ENC_KEY = btoa('too-short')
await assert.rejects(encryptSecret('x'))

console.log('ok — AES-256-GCM round-trip, unique IV, tamper + bad-key rejection pass')
