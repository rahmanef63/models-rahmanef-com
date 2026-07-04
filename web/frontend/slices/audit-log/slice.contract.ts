/**
 * Slice contract for `audit-log` — v0.1.0. Append-only trail of sensitive workspace actions. Convex
 * functions (audit.ts) declared in-place via slice.json rootPaths; the record hooks are inlined
 * db.insert calls in the acting mutations (same-transaction). defineSliceContract inlined until the
 * rr CLI is vendored.
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
  id: "audit-log",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth", "workspaces"] },
  provides: {
    components: ["AuditLogCard"],
    convex: ["audit.record", "audit.listAuditEvents", "audit.pruneAudit"],
    tables: ["auditEvents"],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
