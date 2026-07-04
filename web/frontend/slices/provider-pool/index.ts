// provider-pool slice public barrel (provider-pool v0.1.0). Graceful multi-credential failover +
// error-based cooldown over the EXISTING modelCreds rows. Convex logic lives at
// convex/providerPool.ts + convex/fallbackRules.ts (declared, not moved — the ≤3-attempt loop is
// integrated into callForUser). This barrel exposes only the UI health chip.
export { CredStatusBadge } from "./components/cred-status-badge";
export type { CredPoolStatus } from "./components/cred-status-badge";
