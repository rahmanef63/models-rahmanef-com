/**
 * Slice contract for `spend-caps` — v0.1.0. Optional per-workspace monthly USD budget.
 * Convex functions (spendCaps.ts) declared in-place via slice.json rootPaths. checkSpendCap gates
 * callForUser (quota_exceeded on over-budget). defineSliceContract inlined until the rr CLI is vendored.
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
  id: "spend-caps",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["SpendCapCard"],
    convex: ["spendCaps.checkSpendCap", "spendCaps.setSpendCap", "spendCaps.getSpendStatus"],
    tables: [],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
