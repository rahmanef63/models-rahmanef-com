import { ErrorLine as CoreErrorLine } from "@/features/core";
import { PROVIDER_LABEL } from "../lib/provider-meta";

// The app's provider/model error display: core's generic ErrorLine pre-bound with the provider
// display names (byok owns PROVIDER_LABEL). Non-provider errors still render fine — the label map is
// only consulted when the error carries a `provider`, so this is safe for any error the app throws.
export function ErrorLine(props: { e: unknown; isAdmin: boolean }) {
  return <CoreErrorLine {...props} labels={PROVIDER_LABEL} />;
}
