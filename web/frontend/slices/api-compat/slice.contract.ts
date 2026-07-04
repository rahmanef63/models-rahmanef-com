/**
 * Slice contract for `api-compat` — v0.1.0. The /v1 OpenAI-compatible gateway. Convex functions
 * (apiKeys.ts, apiV1.ts) + the Next /v1/[...path] route declared in-place via slice.json rootPaths;
 * the API-keys UI lives here. defineSliceContract inlined until the rr CLI is vendored.
 */
type SliceContract = {
  id: string;
  version: string;
  requires: { deps: string[] };
  provides: { components?: string[]; convex?: string[]; tables?: string[]; routes?: string[] };
  bidir: {
    syncPolicy: "manual" | "auto";
    generalization: { level: "consumer-locked" | "portable" | "generic"; forbiddenTerms: string[]; requiredProps: string[] };
  };
};
const defineSliceContract = <T extends SliceContract>(c: T): T => c;

export const contract = defineSliceContract({
  id: "api-compat",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["ApiKeysCard"],
    convex: ["apiKeys.issueApiKey", "apiKeys.listApiKeys", "apiKeys.revokeApiKey", "apiV1.handle"],
    tables: ["apiKeys"],
    routes: ["/v1/[...path]"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: { level: "consumer-locked", forbiddenTerms: ["models-rahmanef", "rahmanef"], requiredProps: [] },
  },
});
