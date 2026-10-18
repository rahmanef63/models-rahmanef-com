// Optional convenience caller. The core hands back a ResolvedModel descriptor; if you'd
// rather use the Vercel AI SDK / your own client, ignore this file. Two wire protocols cover
// nearly everything (openclaw's insight): openai-completions + anthropic-messages.

async function request(url, options) {
  try { return await fetch(url, { ...options, redirect: 'error' }) } catch {
    throw new Error('provider request failed')
  }
}

async function responseJson(res) {
  // Error bodies and transport errors can echo authorization headers.
  if (!res.ok) throw new Error('provider HTTP ' + res.status)
  try { return await res.json() } catch { throw new Error('invalid provider response') }
}

/**
 * @param {import('./resolve.js').ResolvedModel} resolved
 * @param {{messages:Array<{role:string,content:any}>, [k:string]:any}} body
 */
export async function chat(resolved, { messages, ...rest }) {
  if (resolved.protocol === 'anthropic') {
    const res = await request(`${resolved.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': resolved.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ ...rest, model: resolved.model, max_tokens: rest.max_tokens ?? 1024, messages }),
    })
    return responseJson(res)
  }
  const res = await request(`${resolved.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resolved.apiKey}` },
    body: JSON.stringify({ ...rest, model: resolved.model, messages }),
  })
  return responseJson(res)
}
