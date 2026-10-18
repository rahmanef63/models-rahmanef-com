// Run from root: node --experimental-strip-types --loader ./adapters/convex/test-loader.mjs web/convex/credentialBackend.test.mjs
import assert from "node:assert/strict";
import { APICallError, RetryError } from "ai";
import { addCredential, addWorkspaceCredential, deleteCredentialById, deleteWorkspaceCredentialById } from "./credsPool.ts";
import { listConfiguredProviders, providersForUser, setCredential, _recordCheck } from "./credentials.ts";
import { connectCustomProvider } from "./customProvider.ts";
import { classifyError } from "./chatErrors.ts";
import { credentialInputError, publicCredential, safeProviderErrorDetail } from "./credentialPolicy.ts";
process.env.MODELS_ENC_KEY = btoa("x".repeat(32));
const canary = "synthetic-secret-that-must-never-be-returned";
const personal = { _id: "personal", _creationTime: 1, userId: "owner", provider: "openai", ciphertext: canary, updatedAt: 1, lastCheckedCode: "invalid_api_key", lastCheckedDetail: canary };
const shared = { ...personal, _id: "shared", workspaceId: "workspace", provider: "shared-only" };
let row = personal, role = "member", writes = [], queries = 0;
const chain = { withIndex() { return this; }, filter() { return this; }, collect: async () => [personal, shared], unique: async () => role ? { role } : null, first: async () => row };
const ctx = (subject = "owner") => ({
  auth: { getUserIdentity: async () => subject === null ? null : { subject } },
  db: { get: async () => row, query: () => { queries++; return chain; }, delete: async (id) => writes.push(["delete", id]), patch: async (...args) => writes.push(["patch", ...args]), insert: async (...args) => writes.push(["insert", ...args]) },
  runQuery: async () => role ? { role } : null,
  runMutation: async (...args) => writes.push(["mutation", ...args]),
});
for (const candidate of [null, { ...personal, userId: "other" }, shared]) {
  row = candidate; writes = [];
  await deleteCredentialById._handler(ctx(), { credId: "test" });
  assert.deepEqual(writes, []);
}
row = personal; writes = [];
await deleteCredentialById._handler(ctx(), { credId: "personal" });
assert.deepEqual(writes, [["delete", "personal"]]);
row = shared; writes = [];
await assert.rejects(deleteWorkspaceCredentialById._handler(ctx(), { credId: "shared" }));
assert.deepEqual(writes, []);
role = "admin";
await deleteWorkspaceCredentialById._handler(ctx(), { credId: "shared" });
assert.equal(writes[0][0], "delete"); assert.equal(writes[1][1], "auditEvents");
role = null; writes = [];
await assert.rejects(addWorkspaceCredential._handler(ctx(), { workspaceId: "workspace", provider: "openai", apiKey: canary }));
assert.deepEqual(writes, []); role = "member";
for (const fn of [setCredential, addCredential]) {
  await assert.rejects(fn._handler(ctx(null), { provider: "openai", apiKey: canary }));
  for (const apiKey of ["", " ", "key\nheader", "x".repeat(16385)]) {
    await assert.rejects(fn._handler(ctx(), { provider: "openai", apiKey }));
  }
}
for (const priority of [NaN, Infinity, -Infinity]) {
  await assert.rejects(addCredential._handler(ctx(), { provider: "openai", apiKey: canary, priority }));
}
assert.deepEqual(writes, []);
for (const args of [
  { baseURL: "http://public.example/v1" }, { baseURL: "https://u:p@public.example/v1" },
  { baseURL: "https://public.example/v1?key=" + canary }, { baseURL: "https://public.example/#" + canary },
  { baseURL: "https://127.0.0.1/v1" }, { protocol: "unsupported" }, { models: [canary.repeat(20)] },
]) {
  await assert.rejects(connectCustomProvider._handler(ctx(), { name: "Custom", baseURL: "https://public.example/v1", apiKey: canary, ...args }));
}
assert.deepEqual(writes, []);
const connected = await connectCustomProvider._handler(ctx(), { name: "Custom", baseURL: "https://public.example/v1", apiKey: canary });
assert.equal(connected.slug, "custom");
assert(!JSON.stringify(writes).includes(canary));
const listed = await listConfiguredProviders._handler(ctx(), {});
assert.equal(listed.length, 1); assert.equal(listed[0].keyCount, 1);
const internalListed = await providersForUser._handler(ctx(), { userId: "owner" });
assert.equal(internalListed.length, 1);
for (const result of [listed, internalListed, publicCredential(personal)]) assert(!JSON.stringify(result).includes(canary));
assert.deepEqual(await listConfiguredProviders._handler(ctx(null), {}), []);
row = personal; writes = [];
await _recordCheck._handler(ctx(), { userId: "owner", provider: "openai", credId: personal._id, ciphertext: personal.ciphertext, updatedAt: personal.updatedAt, ok: false, code: "invalid_api_key", detail: canary });
assert(!JSON.stringify(writes).includes(canary));
for (const [message, code] of [["401 " + canary, "invalid_api_key"], ["429 " + canary, "rate_limited"], ["402 " + canary, "quota_exceeded"], ["404 " + canary, "not_found"], ["400 " + canary, "invalid_request"], ["503 " + canary, "provider_error"], ["ENOTFOUND " + canary, "unreachable"], [canary, "internal"]]) {
  const result = classifyError(new Error(message));
  assert.equal(result.code, code); assert(!JSON.stringify(result).includes(canary));
}
assert.equal(classifyError(new Error("400 API key not valid " + canary), "google").code, "invalid_api_key");
const sdkError = new APICallError({ message: canary, url: "https://public.example/" + canary, requestBodyValues: { key: canary }, statusCode: 429, responseBody: canary });
for (const error of [sdkError, new RetryError({ message: canary, reason: "maxRetriesExceeded", errors: [sdkError] })]) {
  const result = classifyError(error);
  assert.equal(result.code, "rate_limited"); assert.equal(result.status, 429);
  assert(!JSON.stringify(result).includes(canary));
}
assert.equal(safeProviderErrorDetail("__proto__"), safeProviderErrorDetail("internal"));
assert(credentialInputError({ provider: "bad/provider" }));
assert(credentialInputError({ provider: "openai", models: Array(101).fill("model") }));
assert.equal(credentialInputError({ provider: "openai", apiKey: canary, priority: 2, models: ["model"] }), null);
console.log("OK — credential handlers enforce auth, personal/workspace deletion, input bounds, endpoint policy, encrypted writes, personal lists, and provider-error redaction");
