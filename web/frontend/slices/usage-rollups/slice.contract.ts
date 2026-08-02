/**
 * Slice contract for `usage-rollups` — v0.1.0. Per-workspace daily usage aggregates + estimated cost.
 * Convex functions (usageRollups.ts) declared in-place via slice.json rootPaths; the rollupDay cron
 * joins the app crons. defineSliceContract inlined until the rr CLI is vendored.
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
  id: "usage-rollups",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["WorkspaceUsageCard"],
    convex: ["usageRollups.rollupDay", "usageRollups.workspaceUsage"],
    tables: ["workspaceUsageDaily"],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
