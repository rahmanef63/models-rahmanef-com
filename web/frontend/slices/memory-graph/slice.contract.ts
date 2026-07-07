/**
 * Slice contract for `memory-graph` — v0.1.0. Portable Obsidian-style force-directed graph over
 * memories + agents + skills + tools. Frontend-only: the wired adapter reuses existing memory +
 * agentDefs queries, so there are no new Convex functions/tables. defineSliceContract inlined
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
  id: "memory-graph",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["MemoryGraph", "MemoryGraphPanel"],
    convex: [],
    tables: [],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    // the <MemoryGraph> renderer is fully portable (props-driven, Convex-free); only the
    // use-graph-data adapter is consumer-locked to this app's queries.
    generalization: { level: "portable", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
