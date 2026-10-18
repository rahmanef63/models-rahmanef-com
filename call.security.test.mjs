import assert from 'node:assert/strict'
import { chat } from './src/call.js'

const originalFetch = globalThis.fetch
const secret = 'synthetic-test-credential'
try {
  for (const protocol of ['openai', 'anthropic']) {
    const descriptor = {
      protocol, baseUrl: 'https://provider.invalid', apiKey: secret,
      model: 'pinned-model', provider: protocol,
    }
    const messages = [{ role: 'user', content: 'synthetic' }]
    globalThis.fetch = async (url, options) => {
      assert.equal(options.redirect, 'error')
      assert.equal(url, descriptor.baseUrl + (protocol === 'anthropic' ? '/v1/messages' : '/chat/completions'))
      const body = JSON.parse(options.body)
      assert.equal(body.model, 'pinned-model', 'body overrode resolved model')
      assert.deepEqual(body.messages, messages)
      assert.equal(protocol === 'anthropic' ? options.headers['x-api-key'] : options.headers.authorization,
        protocol === 'anthropic' ? secret : 'Bearer ' + secret)
      return Response.json({ ok: true })
    }
    assert.deepEqual(await chat(descriptor, { messages, model: 'untrusted-model' }), { ok: true })
    globalThis.fetch = async () => new Response(secret, { status: 403 })
    await assert.rejects(chat(descriptor, { messages }), (error) => {
      assert.equal(error.message, 'provider HTTP 403')
      assert.ok(!error.message.includes(secret))
      return true
    })
    globalThis.fetch = async () => { throw new Error('transport echo ' + secret) }
    await assert.rejects(chat(descriptor, { messages }), { message: 'provider request failed' })
    globalThis.fetch = async () => new Response('invalid json ' + secret)
    await assert.rejects(chat(descriptor, { messages }), { message: 'invalid provider response' })
  }
  console.log('ok — both wire protocols pin model, reject redirects, sanitize HTTP/transport/JSON errors')
} finally {
  globalThis.fetch = originalFetch
}
