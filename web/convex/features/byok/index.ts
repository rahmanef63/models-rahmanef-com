// BYOK slice — Convex-side barrel. Re-exports ONLY the plain (non-registered) helpers so
// they can be imported as `@/convex/features/byok`. The registered Convex functions
// (credentials.ts: listConfiguredProviders/setCredential/deleteCredential + internal store/
// getCiphertext/claimRefresh/_recordCheck) are NOT re-exported — they stay registered under
// their existing api.credentials.* / internal.credentials.* paths to avoid a repo-wide rewrite.
// chatProviders.ts is 'use node' and is intentionally NOT re-exported here (runtime-split).
export { encryptSecret, decryptSecret } from "../../crypto";
