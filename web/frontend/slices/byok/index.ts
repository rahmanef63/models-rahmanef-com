// BYOK slice public barrel (byok v0.1.0). Consumers import ONLY from `@/features/byok`.
// The Providers UI physically lives here; Convex CRUD stays at api.credentials.* (declared,
// not moved) and is called by consumers through the generated api, not this barrel.
export { ConnectProviders } from "./components/connect-providers";
export { ApiKeyForm, ConnectedCreds, cheapestModel } from "./components/providers";
// provider/model error display — core's ErrorLine pre-bound with PROVIDER_LABEL (the app imports it from here).
export { ErrorLine } from "./components/error-line";
// provider-domain metadata now owned by the slice (was app/_components/shared) — fixes the leaky barrel.
export type { Cred, Catalog } from "./lib/provider-meta";
export { PROVIDER_LABEL, SUPPORTED } from "./lib/provider-meta";

export { catalogMetadata } from "./lib/catalog-meta";
