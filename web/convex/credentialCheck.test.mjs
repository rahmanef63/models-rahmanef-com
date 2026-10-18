// Run: node --experimental-test-module-mocks --experimental-strip-types --loader ./adapters/convex/test-loader.mjs web/convex/credentialCheck.test.mjs
import assert from "node:assert/strict";
import { mock } from "node:test";
import { getFunctionName } from "convex/server";
import { encryptSecret } from "./crypto.ts";
import { store, _connectForUser, _recordCheck } from "./credentials.ts";
process.env.MODELS_ENC_KEY = btoa("x".repeat(32));
const secretA = "synthetic-primary-key", secretB = "synthetic-replacement-key";
const blobA = await encryptSecret(secretA), blobB = await encryptSecret(secretB);
const originalAi = await import("ai"), originalProviders = await import("./chatProviders.ts");
let generated = [], resolutions = [], failure, duringGeneration;
mock.module("ai", { namedExports: { ...originalAi, generateText: async (options) => {
  generated.push(options); if (duringGeneration) await duringGeneration();
  if (failure) throw failure;
  return { usage: { inputTokens: 3, outputTokens: 1 } };
} } });
const selectedModel = { synthetic: true };
mock.module(new URL("./chatProviders.ts", import.meta.url).href, { namedExports: { ...originalProviders, modelFor: (...args) => { resolutions.push(args); return selectedModel; } } });
const { testCredential } = await import("./chat.ts");
const initial = () => ({ _id: "A", _creationTime: 1, userId: "owner", provider: "custom", kind: "api_key", ciphertext: blobA, updatedAt: 1, endpoint: "https://provider.example/v1", protocol: "anthropic", lastCheckedAt: 1, lastCheckedOk: true, lastCheckedCode: "old", lastCheckedDetail: "old" });
let row = initial(), reads = [], writes = [], logged = [];
const chain = { withIndex() { return this; }, filter() { return this; }, first: async () => row };
const mutationCtx = { db: {
  get: async (id) => row?._id === id ? row : null,
  query: () => { reads.push("db-query"); return chain; },
  patch: async (id, patch) => { assert.equal(id, row._id); writes.push(patch); row = { ...row, ...patch }; },
  insert: async () => { throw new Error("Unexpected insertion"); },
} };
const ctx = (subject = "owner") => ({
  auth: { getUserIdentity: async () => subject === null ? null : { subject } },
  runQuery: async (ref, args) => {
    const name = getFunctionName(ref); reads.push(name);
    assert.equal(name, "credentials:getCiphertext"); assert.deepEqual(args, { userId: "owner", provider: "custom" });
    return row ? { ...row } : null;
  },
  runMutation: async (ref, args) => {
    const name = getFunctionName(ref);
    if (name === "usage:log") { logged.push(args); return; }
    assert.equal(name, "credentials:_recordCheck"); assert(!Object.hasOwn(args, "status"));
    return _recordCheck._handler(mutationCtx, args);
  },
});
const check = () => testCredential._handler(ctx(), { provider: "custom", model: "model" });
await assert.rejects(testCredential._handler(ctx(null), { provider: "custom", model: "model" }));
assert.deepEqual(reads, []);
assert.deepEqual(await check(), { ok: true });
assert.equal(generated.length, 1); assert.equal(resolutions.length, 1);
assert.deepEqual(resolutions[0], ["custom", "model", secretA, initial().endpoint, "anthropic"]);
assert.deepEqual(generated[0], { model: selectedModel, messages: [{ role: "user", content: "ping" }], maxOutputTokens: 1, maxRetries: 0 });
assert.equal(row.lastCheckedOk, true);
assert.deepEqual(logged[0], { userId: "owner", provider: "custom", model: "custom/model", promptTokens: 3, completionTokens: 1, status: "ok" });
assert(!JSON.stringify(await check()).includes(secretA));
// Both key and endpoint rewrites remove every old verdict, including successful checks.
for (const fn of [store, _connectForUser]) {
  row = initial(); writes = [];
  await fn._handler(mutationCtx, { userId: "owner", provider: "custom", kind: "api_key", ciphertext: blobB, endpoint: "https://replacement.example/v1" });
  for (const key of ["lastCheckedAt", "lastCheckedOk", "lastCheckedCode", "lastCheckedDetail"]) {
    assert(Object.hasOwn(writes[0], key)); assert.equal(row[key], undefined);
  }
}
// Compare-and-set rejects key replacement, same-key endpoint changes, deletion, and recreate.
for (const replacement of [
  { ...initial(), ciphertext: blobB }, { ...initial(), updatedAt: 2 },
  { ...initial(), endpoint: "https://replacement.example/v1" }, { ...initial(), protocol: "openai" },
  null, { ...initial(), _id: "recreated" }, { ...initial(), userId: "other" }, { ...initial(), workspaceId: "workspace" },
]) {
  row = replacement; writes = [];
  const saved = await _recordCheck._handler(mutationCtx, { userId: "owner", provider: "custom", credId: "A", ciphertext: blobA, updatedAt: 1, endpoint: initial().endpoint, protocol: "anthropic", ok: true });
  assert.equal(saved, false); assert.deepEqual(writes, []);
}
row = initial(); writes = []; generated = [];
duringGeneration = async () => { await store._handler(mutationCtx, { userId: "owner", provider: "custom", kind: "api_key", ciphertext: blobB }); };
const stale = await check();
assert.equal(stale.code, "credential_changed"); assert.equal(stale.ok, false);
assert.equal(row.lastCheckedOk, undefined); assert.equal(generated.length, 1);
duringGeneration = undefined; row = initial(); generated = []; failure = new Error("401 " + secretA);
const denied = await check();
assert.equal(denied.ok, false); assert.equal(denied.code, "invalid_api_key");
assert.equal(generated.length, 1); assert.equal(row.lastCheckedOk, false);
assert.equal(logged.at(-1).status, "error"); assert(!JSON.stringify(denied).includes(secretA));
failure = undefined;
// Validate tool/internal entry points before querying or writing any credential data.
for (const patch of [
  { provider: "bad/provider" }, { endpoint: "http://provider.example" }, { endpoint: "https://u:p@provider.example" },
  { endpoint: "https://provider.example?key=" + secretA }, { endpoint: "https://provider.example/#secret" },
  { endpoint: "https://127.0.0.1" }, { protocol: "unknown" }, { models: ["x".repeat(257)] },
  { ciphertext: "invalid" }, { ciphertext: "x".repeat(65537) },
]) {
  reads = []; writes = [];
  await assert.rejects(_connectForUser._handler(mutationCtx, { userId: "owner", provider: "custom", ciphertext: blobA, endpoint: initial().endpoint, ...patch }));
  assert.deepEqual(reads, []); assert.deepEqual(writes, []);
}
console.log("OK — actual credential check handler uses only primary snapshot, one output token, no retries/tools/memory; CAS races, resets, accounting, redaction, and internal write validation pass");
