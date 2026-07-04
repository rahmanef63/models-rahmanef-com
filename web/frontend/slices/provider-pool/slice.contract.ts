/**
 * Slice contract for `provider-pool` — v0.1.0. EXTENDS byok: adds pool fields to modelCreds and a
 * graceful ≤3-attempt failover over the credentials that already exist. Convex logic
 * (providerPool.ts + fallbackRules.ts) is declared in-place via slice.json rootPaths; the ≤3-attempt
 * loop is hand-integrated into callForUser's BYOK branch (the OAuth branches stay single-cred).
 * defineSliceContract inlined until the rr CLI is vendored (mirrors the byok/usage-rollups shape).
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[]; tools?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "provider-pool",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth", "byok"] },
  provides: {
    components: ["CredStatusBadge"],
    convex: ["providerPool.pickCredentials", "providerPool.markCredResult", "fallbackRules.classifyProviderError"],
    tables: ["modelCreds"],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: {
      // portable: fallbackRules.ts + providerPool.ts are pure/props-driven and free of consumer copy;
      // the only coupling is the callForUser hand-integration (an app hot path, not a slice file).
      level: "portable",
      forbiddenTerms: ["models-rahmanef", "rahmanef"],
      requiredProps: [],
    },
  },
});
