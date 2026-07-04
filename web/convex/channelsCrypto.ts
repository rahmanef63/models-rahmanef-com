"use node";
// Platform webhook signature primitives (crypto.subtle, node runtime). Slack/WhatsApp = HMAC-SHA256;
// Discord = Ed25519 over timestamp+rawBody. Compares are constant-time (no early-out on mismatch).
const te = new TextEncoder();

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// constant-time string compare (length gate, then XOR-accumulate).
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// lowercase-hex HMAC-SHA256(secret, msg).
export async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(msg)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Ed25519 verify — publicKey + signature are hex (Discord's header format). Bad input → false.
export async function verifyEd25519Hex(publicKeyHex: string, signatureHex: string, message: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(publicKeyHex) as unknown as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hexToBytes(signatureHex) as unknown as BufferSource, te.encode(message));
  } catch {
    return false;
  }
}
