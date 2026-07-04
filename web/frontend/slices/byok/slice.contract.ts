/**
 * Slice contract for `byok` — v0.1.0. First rr vertical slice extracted from
 * models-rahmanef-com. Extracted IN PLACE: the Convex functions keep their existing
 * api.credentials.* / internal.credentials.* paths (physically moving them would rewrite
 * oauth.ts, chat.ts, callForUser.ts, chatTools.ts, page.tsx) — the slice DECLARES ownership
 * via slice.json rootPaths. Only the Providers UI physically moved into the slice.
 * defineSliceContract is inlined (identity) until the rr CLI is vendored — mirrors
 * rahmanef-com/packages/cli/lib/contract's shape.
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
  id: "byok",
  version: "0.1.0",
  requires: { deps: ["@convex-dev/auth"] },
  provides: {
    components: ["ConnectProviders", "ApiKeyForm", "ConnectedCreds"],
    convex: ["credentials.listConfiguredProviders", "credentials.setCredential", "credentials.deleteCredential"],
    tables: ["modelCreds"],
  },
  bidir: {
    syncPolicy: "manual",
    generalization: {
      // consumer-locked: UI still imports the app's shared PROVIDER_LABEL/ErrorLine and the
      // app-owned oauth.ts actions. Generalize (labels + provider registry as props, drop the
      // oauth coupling) before any UP push to rr.
      level: "consumer-locked",
      forbiddenTerms: ["models-rahmanef", "rahmanef"],
      requiredProps: ["setCredential", "testCredential", "deleteCredential", "catalog"],
    },
  },
});
