/**
 * Slice contract for `combos` — v0.1.0. Model-ref indirection (`combo/<name>` → many `provider/model`
 * refs). Convex functions (combos.ts) declared in-place via slice.json rootPaths; `resolveCombo` is
 * consumed by callForUser's resolveModelRef. defineSliceContract inlined until the rr CLI is vendored.
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
  id: "combos",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth", "workspaces", "byok"] },
  provides: {
    components: ["ComboBuilderCard"],
    convex: ["combos.listCombos", "combos.createCombo", "combos.renameCombo", "combos.removeCombo"],
    tables: ["combos"],
    tools: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
