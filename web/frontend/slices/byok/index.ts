// BYOK slice public barrel (byok v0.1.0). Consumers import ONLY from `@/features/byok`.
// The Providers UI physically lives here; Convex CRUD stays at api.credentials.* (declared,
// not moved) and is called by consumers through the generated api, not this barrel.
export { ConnectProviders } from "./components/connect-providers";
export { ApiKeyForm, ConnectedCreds, cheapestModel } from "./components/providers";
// re-export the byok-relevant shared types so consumers don't reach into app/_components
export type { Cred, Catalog } from "@/app/app/_components/shared";
export { PROVIDER_LABEL, SUPPORTED } from "@/app/app/_components/shared";
