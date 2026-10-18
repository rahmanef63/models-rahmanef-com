// Run: node --experimental-test-module-mocks --experimental-strip-types --loader ./adapters/convex/test-loader.mjs web/convex/credentialTools.test.mjs
import assert from "node:assert/strict";
import { mock } from "node:test";
import { getFunctionName } from "convex/server";
const actualCrypto = await import("./crypto.ts");
let encrypted = [], mutations = [];
mock.module(new URL("./crypto.ts", import.meta.url).href, { namedExports: { ...actualCrypto, encryptSecret: async (key) => {
  encrypted.push(key); return "synthetic-ciphertext";
} } });
const { TOOL_HANDLERS } = await import("./toolHandlers.ts");
const key = "synthetic-tool-key";
const ctx = { runMutation: async (ref, args) => { mutations.push([getFunctionName(ref), args]); } };
const standard = (patch) => TOOL_HANDLERS.connect_provider(ctx, "owner", { provider: "openai", apiKey: key, ...patch });
const custom = (patch) => TOOL_HANDLERS.connect_custom_provider(ctx, "owner", { name: "Custom", apiKey: key, baseURL: "https://public.example/v1", ...patch });
for (const invoke of [standard, custom]) {
  for (const apiKey of [undefined, null, 123, {}, [], "", " ", "key\nheader", "key\u0000suffix", "x".repeat(16385)]) {
    const result = await invoke({ apiKey });
    assert.equal(typeof result, "string"); assert(!result.startsWith("Connected"));
    assert.deepEqual(encrypted, []); assert.deepEqual(mutations, []);
  }
}
for (const protocol of [null, 0, false, {}, [], "", "unknown", "ANTHROPIC"]) {
  const result = await custom({ protocol });
  assert.equal(result, "Unsupported protocol."); assert.deepEqual(encrypted, []); assert.deepEqual(mutations, []);
}
for (const baseURL of [undefined, null, {}, "http://public.example", "https://u:p@public.example", "https://public.example?key=" + key, "https://public.example/#" + key, "https://127.0.0.1", "https://public.example/" + "x".repeat(2049)]) {
  const result = await custom({ baseURL });
  assert.equal(typeof result, "string"); assert(!result.startsWith("Connected"));
  assert(!result.includes(key)); assert.deepEqual(encrypted, []); assert.deepEqual(mutations, []);
}
assert(!String(await standard({ provider: "unknown-secret-provider" })).includes("unknown-secret-provider"));
assert.deepEqual(encrypted, []); assert.deepEqual(mutations, []);
assert.match(await standard(), /^Connected/);
assert.deepEqual(mutations[0], ["credentials:_connectForUser", { userId: "owner", provider: "openai", ciphertext: "synthetic-ciphertext" }]);
for (const protocol of [undefined, "openai", "anthropic"]) {
  const result = await custom({ protocol, baseURL: "https://public.example/v1/" + key });
  assert.match(result, /^Connected custom provider/); assert(!result.includes(key));
  const [name, args] = mutations.at(-1);
  assert.equal(name, "credentials:_connectForUser"); assert.equal(args.userId, "owner");
  assert.equal(args.provider, "custom"); assert.equal(args.ciphertext, "synthetic-ciphertext");
  assert.equal(args.protocol, protocol === "anthropic" ? "anthropic" : undefined);
  assert(!Object.hasOwn(args, "apiKey"));
}
assert.deepEqual(encrypted, Array(4).fill(key));
console.log("OK — actual provider tool handlers reject malformed plaintext keys, protocols, and endpoints before encryption/mutations; accepted writes contain ciphertext and responses omit endpoint secrets");
