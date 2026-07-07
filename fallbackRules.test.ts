// ponytail: 402/quota failover is a money+reliability path, so it gets a runnable check.
// Lives at repo root (not under web/convex) so neither Convex's nor Next's tsc typechecks it —
// it's run only via node type-stripping, like adapters/convex/crypto.test.ts.
// Run: node --experimental-strip-types fallbackRules.test.ts
import assert from "node:assert/strict";
import { classifyProviderError, _selfCheck } from "./web/convex/fallbackRules.ts";

_selfCheck(); // every documented rule (terminal / 429 / 5xx / 402 / unknown)

// 402/quota must FAIL OVER (retryable) so a multi-cred pool tries the next key instead of aborting.
assert.equal(classifyProviderError(402).retryable, true, "402 fails over");
assert.equal(classifyProviderError("quota_exceeded").retryable, true, "quota fails over");
assert.equal(classifyProviderError(402).dead, false, "402 recoverable, not dead");
assert.ok(classifyProviderError(402).cooldownMs > 0, "402 still cools the exhausted cred");

// regression guard: a plain 400 must NOT fail over (it's the caller's error to surface verbatim)
assert.equal(classifyProviderError(400).retryable, false, "400 surfaces, no failover");

console.log("ok — fallbackRules: 402/quota fail over + cooldown, 400 surfaces, all rules pass");
