/**
 * Slice contract for `scheduled-agents` — v0.1.0. Run a saved agent on a recurring interval. Convex
 * functions (scheduledAgents.ts CRUD + scheduledAgentsRun.ts runDue cron target) declared in-place via
 * slice.json rootPaths; runDue reuses callForUser (the ONE cred pipeline). defineSliceContract inlined
 * until the rr CLI is vendored.
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
  id: "scheduled-agents",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth", "workspaces", "byok"] },
  provides: {
    components: ["SchedulesCard"],
    convex: ["scheduledAgents.list", "scheduledAgents.create", "scheduledAgents.toggle", "scheduledAgents.remove"],
    tables: ["agentSchedules"],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
