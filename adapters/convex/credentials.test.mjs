// Run from root: node --experimental-strip-types --loader ./adapters/convex/test-loader.mjs adapters/convex/credentials.test.mjs
import assert from "node:assert/strict";
import { setCredential, deleteCredential, listConfiguredProviders } from "./credentials.ts";
import { decryptSecret } from "./crypto.ts";
process.env.MODELS_ENC_KEY = btoa("x".repeat(32)); // synthetic master key only
let reads = 0, writes = [];
const query = { withIndex() { return this; }, unique: async () => null, collect: async () => [{ provider: "openai", ciphertext: "hidden" }] };
const ctx = (subject) => ({
  auth: { getUserIdentity: async () => subject === null ? null : { subject } },
  db: { query: () => { reads++; return query; }, insert: async (...args) => { writes.push(args); }, delete: async (...args) => { writes.push(args); } },
});
for (const subject of [null, "attacker", ""]) {
  for (const [fn, args] of [
    [setCredential, { tenantId: "victim", provider: "openai", apiKey: "synthetic-key" }],
    [deleteCredential, { tenantId: "victim", provider: "openai" }],
    [listConfiguredProviders, { tenantId: "victim" }],
  ]) await assert.rejects(fn._handler(ctx(subject), args), /access denied/);
}
assert.equal(reads, 0); assert.deepEqual(writes, []);
for (const apiKey of ["", " ", "key\nheader", "x".repeat(16385)]) {
  await assert.rejects(setCredential._handler(ctx("owner"), { tenantId: "owner", provider: "openai", apiKey }), /Invalid API key/);
}
await assert.rejects(setCredential._handler(ctx("owner"), { tenantId: "owner", provider: "bad/provider", apiKey: "synthetic-key" }), /Invalid provider/);
assert.equal(reads, 0);
await setCredential._handler(ctx("owner"), { tenantId: "owner", provider: "openai", apiKey: "synthetic-key" });
assert.equal(writes[0][1].tenantId, "owner");
assert.equal(await decryptSecret(writes[0][1].ciphertext), "synthetic-key");
assert(!JSON.stringify(writes).includes("synthetic-key"));
assert.deepEqual(await listConfiguredProviders._handler(ctx("owner"), { tenantId: "owner" }), ["openai"]);
console.log("OK — adapter handlers deny unauthenticated/cross-tenant CRUD before database access; owner encrypted write and secret-free list pass");
