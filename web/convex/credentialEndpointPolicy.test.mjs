// Run: node --experimental-test-module-mocks --experimental-strip-types --loader ./adapters/convex/test-loader.mjs web/convex/credentialEndpointPolicy.test.mjs
import assert from "node:assert/strict";
import { mock } from "node:test";
import { credentialEndpointError } from "./credentialPolicy.ts";
const cryptoModule = await import("./crypto.ts");
let encryptions = 0, mutations = 0, dbOperations = 0;
const ciphertext = "eA==".repeat(10).replaceAll("=", "A");
mock.module(new URL("./crypto.ts", import.meta.url).href, { namedExports: { ...cryptoModule, encryptSecret: async () => { encryptions++; return ciphertext; } } });
const { connectCustomProvider } = await import("./customProvider.ts");
const { TOOL_HANDLERS } = await import("./toolHandlers.ts");
const { _connectForUser } = await import("./credentials.ts");
const privateHosts = [
  "127.0.0.1", "127.255.255.254", "127.1", "2130706433", "0x7f000001", "0177.0.0.1", "127.0.0.1.",
  "0.0.0.0", "0.1.2.3", "10.2.3.4", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.100.100.200",
  "[::]", "[0:0:0:0:0:0:0:0]", "[::1]", "[0:0:0:0:0:0:0:1]", "[fc00::1]", "[fdff::1]", "[fd00:ec2::254]",
  "[fe80::1]", "[fe90::1]", "[febf:ffff::1]", "[fec0::1]", "[ff02::1]",
  "[::ffff:127.0.0.1]", "[::ffff:169.254.169.254]", "[::ffff:7f00:1]", "[::ffff:a9fe:a9fe]",
  "[::ffff:10.0.0.1]", "[::ffff:172.16.0.1]", "[::ffff:192.168.1.1]", "[::127.0.0.1]", "[0:0:0:0:0:ffff:c0a8:101]",
  "localhost", "LOCALHOST.", "sub.localhost", "sub.localhost.", "localhost.localdomain", "service.local.", "service.internal.",
];
const publicHosts = [
  "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.128.0.1", "203.0.113.10",
  "[2001:4860:4860::8888]", "[2606:4700:4700::1111]", "[2001:db8::1]", "[::ffff:8.8.8.8]",
  "provider.example", "provider.example.", "api.example.com", "localhost.example", "public-localhost.example",
];
const chain = { withIndex() { return this; }, filter() { return this; }, first: async () => null };
const ctx = {
  auth: { getUserIdentity: async () => ({ subject: "owner" }) },
  runMutation: async () => { mutations++; },
  db: {
    query: () => { dbOperations++; return chain; },
    insert: async () => { dbOperations++; },
  },
};
for (const host of privateHosts) {
  const endpoint = `https://${host}/v1`;
  assert(credentialEndpointError(endpoint), `pure policy allowed ${host}`);
  await assert.rejects(connectCustomProvider._handler(ctx, { name: "Custom", baseURL: endpoint, apiKey: "synthetic-key" }), undefined, `public action allowed ${host}`);
  const result = await TOOL_HANDLERS.connect_custom_provider(ctx, "owner", { name: "Custom", baseURL: endpoint, apiKey: "synthetic-key" });
  assert.equal(typeof result, "string"); assert(!result.startsWith("Connected"), `tool allowed ${host}`);
  await assert.rejects(_connectForUser._handler(ctx, { userId: "owner", provider: "custom", ciphertext, endpoint }), undefined, `internal mutation allowed ${host}`);
  assert.equal(encryptions, 0, `encrypted before rejecting ${host}`);
  assert.equal(mutations, 0, `mutated before rejecting ${host}`);
  assert.equal(dbOperations, 0, `database accessed before rejecting ${host}`);
}
for (const host of publicHosts) {
  const endpoint = `https://${host}/v1`;
  assert.equal(credentialEndpointError(endpoint), null, `pure policy rejected ${host}`);
  await connectCustomProvider._handler(ctx, { name: "Custom", baseURL: endpoint, apiKey: "synthetic-key" });
  const result = await TOOL_HANDLERS.connect_custom_provider(ctx, "owner", { name: "Custom", baseURL: endpoint, apiKey: "synthetic-key" });
  assert.match(result, /^Connected/);
  await _connectForUser._handler(ctx, { userId: "owner", provider: "custom", ciphertext, endpoint });
}
assert.equal(encryptions, publicHosts.length * 2); assert.equal(mutations, publicHosts.length * 2); assert.equal(dbOperations, publicHosts.length * 2);
// FQDN acceptance is lexical only. These mocks never resolve a name or contact an endpoint.
console.log(`OK — ${privateHosts.length} private/alias forms rejected by action, tool, and internal handlers before encryption/database; ${publicHosts.length} public/doc forms accepted without DNS or network calls`);
