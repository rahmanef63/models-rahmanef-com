// App aggregation barrel. The shared kit now lives in the `core` slice (generic UI/format/error
// helpers) and the `byok` slice (provider-domain metadata); this re-exports both so app internals
// keep their stable `./shared` import with zero churn. Source of truth: @/features/core + @/features/byok.
export { fmt, ago, dt, errData, FRIENDLY, type ChatErrData } from "@/features/core";
export { PROVIDER_LABEL, SUPPORTED, type Cred, type Catalog } from "@/features/byok";

import { ErrorLine as CoreErrorLine } from "@/features/core";
import { PROVIDER_LABEL as LABELS } from "@/features/byok";

// app-wide ErrorLine pre-bound with the provider display names, so every app caller keeps the
// labeled output. Slices import ErrorLine straight from @/features/core and pass their own labels.
export function ErrorLine(props: { e: unknown; isAdmin: boolean }) {
  return <CoreErrorLine {...props} labels={LABELS} />;
}
