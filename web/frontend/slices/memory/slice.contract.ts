/**
 * Slice contract for `memory` — v0.2.0. Curated cross-session agent memory. Convex functions
 * (memory.ts) declared in-place via slice.json rootPaths; the `memory`/`recall_memory` tools join
 * the shared toolRegistry. defineSliceContract inlined until the rr CLI is vendored.
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
  id: "memory",
  version: "0.2.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["MemoryPanel"],
    convex: [
      "memory.listMemories", "memory.addMemory", "memory.removeMemory", "memory.setMemoryEnabled", "memory.pinMemory",
      "memoryAutoSummary.maybeSummarize", "memorySummarize.summarizeThread", "memoryCuration.curateMemories",
    ],
    tables: ["memories"],
    tools: ["memory", "recall_memory"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
