import test from "node:test";
import assert from "node:assert/strict";
import { cheapestModel, credentialError } from "./credential-check.ts";
import { catalogMetadata } from "./catalog-meta.ts";
import { deviceLoginSession } from "./device-login.ts";
import { parseCustomProviderConfig } from "../components/custom-provider-config.ts";

test("chat checks skip non-chat catalogs instead of falling back to embeddings", () => {
  const catalog = { p: { models: {
    embedding: { cost: { input: 0 } }, guard: {}, image: { modalities: { output: ["image"] } },
  } } };
  assert.equal(cheapestModel(catalog, "p"), undefined);
  assert.equal(cheapestModel(catalog, "missing"), undefined);
});

test("chat checks prefer finite prices and avoid the shared free pool when possible", () => {
  const catalog = { p: { models: {
    "chat:free": { cost: { input: 0 } }, unknown: {}, bad: { cost: { input: -1 } },
    string: { cost: { input: "0" } }, costly: { cost: { input: 3 } }, cheap: { cost: { input: 0.5 } },
  } } };
  assert.equal(cheapestModel(catalog, "p"), "cheap");
  assert.equal(cheapestModel({ p: { models: { "chat:free": {} } } }, "p"), "chat:free");
});

test("catalog metadata preserves unknown, zero and explicit false distinctly", () => {
  const cells = Object.fromEntries(catalogMetadata({ cost: { input: 0 }, tool_call: false }));
  assert.equal(cells["in $/M"], "$0");
  assert.equal(cells["out $/M"], "unknown");
  assert.equal(cells.tools, "no");
  assert.equal(cells.reasoning, "unknown");
  assert.deepEqual(catalogMetadata(undefined), []);
  const malformed = Object.fromEntries(catalogMetadata({ cost: { input: "0", output: NaN }, tool_call: "false", limit: { context: -1 } }));
  for (const key of ["in $/M", "out $/M", "tools", "context"]) assert.equal(malformed[key], "unknown");
});

test("custom JSON errors never quote secret-bearing input", () => {
  const secret = "synthetic-private-marker";
  for (const json of [`{"apiKey":"${secret}",`, "null", "[]", "42", '{"name":{},"baseURL":"https://example.test","apiKey":"x"}']) {
    assert.throws(() => parseCustomProviderConfig(json), (e) => !e.message.includes(secret));
  }
  for (const extra of [{ protocol: "other" }, { models: [{}] }]) {
    assert.throws(() => parseCustomProviderConfig(JSON.stringify({ name: "x", baseURL: "https://example.test", apiKey: "synthetic", ...extra })));
  }
});

test("credential errors retain actionable codes while dropping raw exception data", () => {
  const marker = "synthetic-private-marker";
  const e = credentialError({ data: { code: "invalid_api_key", detail: marker, request: { apiKey: marker } } }, "p");
  assert.equal(e.data.code, "invalid_api_key");
  assert.equal(JSON.stringify(e).includes(marker), false);
  assert.equal(credentialError(new Error(marker)).data.code, "internal");
});

const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(start, poll) {
  const jobs = new Map(), events = []; let sequence = 0;
  const cancel = deviceLoginSession(start, poll, {
    onFlow: () => events.push("flow"), onDone: (s) => events.push(s), onError: () => events.push("error"),
  }, (run) => { jobs.set(++sequence, run); return sequence; }, (timer) => jobs.delete(timer));
  const tick = () => { const [id, run] = jobs.entries().next().value; jobs.delete(id); run(); };
  return { cancel, events, jobs, tick };
}
const flow = { verificationUrl: "https://example.test/device", userCode: "synthetic", intervalMs: 1000 };

test("device cancellation ignores a late start and schedules no polling", async () => {
  const start = deferred();
  const h = harness(() => start.promise, async () => { throw new Error("must not poll"); });
  h.cancel(); start.resolve(flow); await flush();
  assert.deepEqual(h.events, []); assert.equal(h.jobs.size, 0);
});

test("device polls are serial and a cancelled in-flight poll cannot report success", async () => {
  const pending = deferred(); let polls = 0;
  const h = harness(async () => flow, () => { polls++; return pending.promise; });
  await flush(); assert.equal(h.jobs.size, 1);
  h.tick(); await flush(); assert.equal(polls, 1); assert.equal(h.jobs.size, 0);
  h.cancel(); pending.resolve({ status: "done" }); await flush();
  assert.deepEqual(h.events, ["flow"]); assert.equal(h.jobs.size, 0);
});

test("device pending retries once; completion clears the polling chain", async () => {
  let polls = 0;
  const h = harness(async () => flow, async () => ({ status: ++polls === 1 ? "pending" : "done" }));
  await flush(); h.tick(); await flush(); assert.equal(h.jobs.size, 1);
  h.tick(); await flush(); assert.deepEqual(h.events, ["flow", "done"]); assert.equal(h.jobs.size, 0);
});

test("device start and poll failures report a safe failure and stop", async () => {
  const startFail = harness(async () => { throw new Error("synthetic-private-marker"); }, async () => ({ status: "pending" }));
  await flush(); assert.deepEqual(startFail.events, ["error"]); assert.equal(startFail.jobs.size, 0);
  const pollFail = harness(async () => flow, async () => { throw new Error("synthetic-private-marker"); });
  await flush(); pollFail.tick(); await flush();
  assert.deepEqual(pollFail.events, ["flow", "error"]); assert.equal(pollFail.jobs.size, 0);
});
