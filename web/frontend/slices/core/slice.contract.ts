/**
 * Slice contract for `core` — v0.1.0. The shared substrate every feature slice depends on, extracted
 * from app/app/_components so feature slices stop reaching into the app root. React-only, no Convex —
 * the most portable slice in the catalog (generalization level `generic`).
 * defineSliceContract is inlined (identity) until the rr CLI is vendored — mirrors the byok contract.
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "core",
  version: "0.1.0",
  requires: { deps: [] },
  provides: {
    components: ["ResponsiveDialog", "ConfirmDialog", "SectionErrorBoundary", "ErrorLine"],
    convex: [],
    tables: [],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "generic", forbiddenTerms: [], requiredProps: [] },
  },
});

export default contract;
