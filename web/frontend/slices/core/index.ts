// Core slice public barrel (core v0.1.0). The shared UI + helper substrate every feature slice sits
// on. React-only — no Convex, no app-root coupling — so depending on `core` keeps a slice copy-clean.
// Consumers import ONLY from `@/features/core`.
export { ResponsiveDialog, ConfirmDialog, useConfirm } from "./components/responsive-dialog";
export { SectionErrorBoundary } from "./components/error-boundary";
export { useTheme, type Theme } from "./hooks/use-theme";
export { fmt, ago, dt } from "./lib/format";
export { errData, ErrorLine, FRIENDLY, type ChatErrData } from "./lib/errors";
